import { Sandbox } from "@e2b/code-interpreter";

const E2B_API_KEY = process.env.E2B_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const PORT = 3000;
const SANDBOX_AGENT_VERSION = "0.2.x";

function ts() {
  return `[${((performance.now()) / 1000).toFixed(2)}s]`;
}

async function runCmd(sandbox, label, cmd, opts = {}) {
  console.log(`${ts()} [cmd:${label}] starting...`);
  const result = await sandbox.commands.run(cmd, opts);
  if (!opts.background && result.exitCode !== 0) {
    console.error(`${ts()} [cmd:${label}] FAILED (exit ${result.exitCode})`);
    console.error("  stdout:", result.stdout?.slice(0, 500));
    console.error("  stderr:", result.stderr?.slice(0, 500));
    throw new Error(`${label} failed with exit code ${result.exitCode}`);
  }
  console.log(`${ts()} [cmd:${label}] OK`);
  return result;
}

async function checkHealth(sandbox, port, label) {
  try {
    const result = await sandbox.commands.run(`curl -sf http://127.0.0.1:${port}/v1/health`, { timeoutMs: 3000 });
    console.log(`${ts()} [health:${label}] exit=${result.exitCode} stdout=${result.stdout?.trim()}`);
    return result.exitCode === 0;
  } catch (e) {
    console.log(`${ts()} [health:${label}] error: ${e.message}`);
    return false;
  }
}

async function checkProcess(sandbox, label) {
  try {
    const result = await sandbox.commands.run("ps aux | grep sandbox-agent | grep -v grep", { timeoutMs: 3000 });
    console.log(`${ts()} [ps:${label}] ${result.stdout?.trim() || "(no process found)"}`);
    return result.exitCode === 0;
  } catch (e) {
    console.log(`${ts()} [ps:${label}] error: ${e.message}`);
    return false;
  }
}

async function waitForServer(sandbox, port, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const ok = await checkHealth(sandbox, port, `wait-${i}`);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  console.log(`${ts()} === Creating sandbox ===`);
  const sandbox = await Sandbox.create({
    timeoutMs: 300_000,
    envs: { ANTHROPIC_API_KEY },
    allowInternetAccess: true,
    apiKey: E2B_API_KEY,
  });
  console.log(`${ts()} sandboxId: ${sandbox.sandboxId}`);

  try {
    await runCmd(sandbox, "install-sandbox-agent",
      `curl -fsSL https://releases.rivet.dev/sandbox-agent/${SANDBOX_AGENT_VERSION}/install.sh | sh`,
      { timeoutMs: 60_000 });

    await runCmd(sandbox, "install-agent",
      "sandbox-agent install-agent opencode",
      { timeoutMs: 120_000 });

    await checkProcess(sandbox, "before-start");

    await runCmd(sandbox, "start-server",
      `sandbox-agent server --no-token --host 0.0.0.0 --port ${PORT}`,
      { background: true, timeoutMs: 0 });

    console.log(`${ts()} === Waiting for server health ===`);
    const healthy = await waitForServer(sandbox, PORT);
    if (!healthy) {
      console.error(`${ts()} Server never became healthy`);
      await checkProcess(sandbox, "after-health-fail");
      return;
    }

    await checkProcess(sandbox, "after-healthy");

    const baseUrl = `https://${sandbox.getHost(PORT)}`;
    console.log(`${ts()} baseUrl: ${baseUrl}`);

    console.log(`\n${ts()} === Phase 1: External health check via E2B proxy ===`);
    try {
      const extHealth = await fetch(`${baseUrl}/v1/health`, { signal: AbortSignal.timeout(10_000) });
      const extHealthBody = await extHealth.text();
      console.log(`${ts()} external health: ${extHealth.status} ${extHealthBody}`);
    } catch (e) {
      console.error(`${ts()} external health FAILED: ${e.message}`);
      await checkProcess(sandbox, "after-ext-health-fail");
      return;
    }

    console.log(`\n${ts()} === Phase 2: List agents ===`);
    try {
      const agentsRes = await fetch(`${baseUrl}/v1/agents`, { signal: AbortSignal.timeout(10_000) });
      const agentsBody = await agentsRes.json();
      console.log(`${ts()} agents: ${JSON.stringify(agentsBody, null, 2).slice(0, 500)}`);
    } catch (e) {
      console.error(`${ts()} list agents FAILED: ${e.message}`);
    }

    console.log(`\n${ts()} === Phase 3: SDK connect + createSession ===`);
    await checkProcess(sandbox, "pre-sdk");

    const { SandboxAgent } = await import("sandbox-agent");
    console.log(`${ts()} SandboxAgent.connect()...`);
    const sdk = await SandboxAgent.connect({ baseUrl });
    console.log(`${ts()} connect done (no network call — just constructor)`);

    console.log(`${ts()} sdk.getHealth()...`);
    try {
      const h = await sdk.getHealth();
      console.log(`${ts()} sdk health: ${JSON.stringify(h)}`);
    } catch (e) {
      console.error(`${ts()} sdk.getHealth() FAILED: ${e.message}`);
    }

    console.log(`${ts()} sdk.createSession()...`);
    let session;
    try {
      session = await sdk.createSession({
        agent: "opencode",
        sessionInit: { cwd: "/", mcpServers: [] },
      });
      console.log(`${ts()} session created!`);
      console.log(`  session.id: ${session.id}`);
      console.log(`  session.agentSessionId: ${session.agentSessionId}`);
    } catch (e) {
      console.error(`${ts()} createSession FAILED: ${e.message}`);
      console.error(`  full error:`, e);
      await checkProcess(sandbox, "after-create-fail");
      await checkHealth(sandbox, PORT, "after-create-fail");
      console.log(`${ts()} disposing SDK...`);
      await sdk.dispose().catch(() => {});
      return;
    }

    await checkProcess(sandbox, "after-create");

    console.log(`\n${ts()} === Phase 4: List ACP servers ===`);
    let acpServerId;
    try {
      const acpServers = await sdk.listAcpServers();
      console.log(`${ts()} ACP servers: ${JSON.stringify(acpServers)}`);
      acpServerId = acpServers.servers?.find((s) => s.agent === "opencode")?.serverId;
      console.log(`${ts()} acpServerId: ${acpServerId}`);
    } catch (e) {
      console.error(`${ts()} listAcpServers FAILED: ${e.message}`);
    }

    if (!acpServerId) {
      console.log(`${ts()} Falling back to raw /v1/acp fetch...`);
      try {
        const acpRes = await fetch(`${baseUrl}/v1/acp`, { signal: AbortSignal.timeout(5000) });
        const acpData = await acpRes.json();
        console.log(`${ts()} raw /v1/acp: ${JSON.stringify(acpData)}`);
        acpServerId = acpData.servers?.[0]?.serverId;
      } catch (e) {
        console.error(`${ts()} raw /v1/acp FAILED: ${e.message}`);
      }
    }

    console.log(`\n${ts()} === Phase 5: SDK prompt (using SDK session.prompt) ===`);
    try {
      console.log(`${ts()} session.prompt("Say hello in one word")...`);
      const promptResult = await session.prompt([{ type: "text", text: "Say hello in one word" }]);
      console.log(`${ts()} prompt result: ${JSON.stringify(promptResult).slice(0, 500)}`);
    } catch (e) {
      console.error(`${ts()} session.prompt FAILED: ${e.message}`);
      await checkProcess(sandbox, "after-prompt-fail");
    }

    console.log(`\n${ts()} === Phase 6: SDK event streaming ===`);
    try {
      console.log(`${ts()} Registering onEvent listener...`);
      let eventCount = 0;
      const unsubscribe = session.onEvent((event) => {
        eventCount++;
        const method = event.payload?.method;
        const update = event.payload?.params?.update?.sessionUpdate;
        console.log(`${ts()}   event[${eventCount}] sender=${event.sender} method=${method} update=${update}`);
      });

      console.log(`${ts()} Sending another prompt to generate events...`);
      try {
        await session.prompt([{ type: "text", text: "What is 2+2? Answer with just the number." }]);
        console.log(`${ts()} prompt done, received ${eventCount} events during prompt`);
      } catch (e) {
        console.error(`${ts()} second prompt FAILED: ${e.message}`);
      }

      unsubscribe();
    } catch (e) {
      console.error(`${ts()} event streaming FAILED: ${e.message}`);
    }

    if (acpServerId) {
      console.log(`\n${ts()} === Phase 7: Raw SSE proxy (like events/route.ts) ===`);
      console.log(`${ts()} NOT disposing SDK — ACP server must stay alive for SSE proxy`);

      const sseUrl = `${baseUrl}/v1/acp/${acpServerId}`;
      console.log(`${ts()} SSE GET ${sseUrl}`);
      try {
        const sseRes = await fetch(sseUrl, {
          headers: { Accept: "text/event-stream" },
          signal: AbortSignal.timeout(5000),
        });
        console.log(`${ts()} SSE status: ${sseRes.status}`);
        console.log(`${ts()} SSE content-type: ${sseRes.headers.get("content-type")}`);

        if (sseRes.ok && sseRes.body) {
          const reader = sseRes.body.getReader();
          const decoder = new TextDecoder();
          let chunks = 0;
          try {
            while (chunks < 5) {
              const { done, value } = await reader.read();
              if (done) {
                console.log(`${ts()} SSE stream ended`);
                break;
              }
              const text = decoder.decode(value, { stream: true });
              console.log(`${ts()}   SSE chunk[${chunks}]: ${text.slice(0, 300)}`);
              chunks++;
            }
          } catch (e) {
            if (e.name !== "AbortError") {
              console.log(`${ts()} SSE read error: ${e.message}`);
            } else {
              console.log(`${ts()} SSE timeout (expected — no events without a prompt)`);
            }
          }
          reader.cancel().catch(() => {});
        } else {
          const body = await sseRes.text();
          console.error(`${ts()} SSE failed: ${body}`);
        }
      } catch (e) {
        console.error(`${ts()} SSE fetch FAILED: ${e.message}`);
        await checkProcess(sandbox, "after-sse-fail");
      }
    } else {
      console.log(`\n${ts()} Skipping raw SSE test — no acpServerId`);
    }

    console.log(`\n${ts()} === Cleanup: disposing SDK ===`);
    await sdk.dispose().catch(() => {});

    console.log(`\n${ts()} === Phase 8: Final diagnostics ===`);
    await checkProcess(sandbox, "final");
    await checkHealth(sandbox, PORT, "final");

  } catch (err) {
    console.error(`\n${ts()} UNHANDLED ERROR:`, err);
    await checkProcess(sandbox, "unhandled-error").catch(() => {});
    await checkHealth(sandbox, PORT, "unhandled-error").catch(() => {});
  } finally {
    console.log(`\n${ts()} === Killing sandbox ===`);
    await Sandbox.kill(sandbox.sandboxId, { apiKey: E2B_API_KEY }).catch(() => {});
    console.log(`${ts()} Done.`);
  }
}

main().catch(console.error);
