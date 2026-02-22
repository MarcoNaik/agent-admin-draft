import { Sandbox } from "@e2b/code-interpreter";

const E2B_API_KEY = process.env.E2B_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;
const CONVEX_URL = process.env.STRUERE_CONVEX_URL || "https://rapid-wildebeest-172.convex.cloud";
const STRUERE_API_KEY = process.env.STRUERE_API_KEY;

if (!E2B_API_KEY || !XAI_API_KEY || !STRUERE_API_KEY) {
  console.error("Required env vars: E2B_API_KEY, XAI_API_KEY, STRUERE_API_KEY");
  process.exit(1);
}

const PORT = 3000;
const SANDBOX_AGENT_VERSION = "0.2.x";
let rpcId = 0;

function ts() {
  return `[${(performance.now() / 1000).toFixed(2)}s]`;
}

function nextRpcId() { return ++rpcId; }

async function runCmd(sandbox, label, cmd, opts = {}) {
  console.log(`${ts()} Running: ${label}`);
  const result = await sandbox.commands.run(cmd, { timeoutMs: 120_000, ...opts });
  if (!opts.background && result.exitCode !== 0) {
    console.error(`  ❌ ${label} failed (exit ${result.exitCode})`);
    if (result.stderr) console.error(`  stderr: ${result.stderr.slice(0, 2000)}`);
    if (result.stdout) console.log(`  stdout: ${result.stdout.slice(0, 2000)}`);
    return result;
  }
  if (!opts.background) {
    console.log(`  ✅ ${label}`);
  }
  return result;
}

async function acpPost(baseUrl, serverId, body, query) {
  const url = new URL(`${baseUrl}/v1/acp/${encodeURIComponent(serverId)}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text };
}

function collectSseEvents(baseUrl, serverId, signal) {
  const events = [];
  const ready = new Promise((resolve, reject) => {
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/v1/acp/${encodeURIComponent(serverId)}`, {
          headers: { Accept: "text/event-stream" },
          signal,
        });
        if (!res.ok) { reject(new Error(`SSE ${res.status}`)); return; }
        resolve();
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let sep = buf.indexOf("\n\n");
          while (sep !== -1) {
            const chunk = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            const dataLines = [];
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
            }
            if (dataLines.length > 0) {
              try { events.push(JSON.parse(dataLines.join("\n"))); } catch {}
            }
            sep = buf.indexOf("\n\n");
          }
        }
      } catch (e) {
        if (e.name !== "AbortError") reject(e);
      }
    })();
  });
  return { events, ready };
}

async function waitForServer(sandbox, port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await sandbox.commands.run(`curl -sf http://127.0.0.1:${port}/v1/health`, { timeoutMs: 3000 });
      if (r.exitCode === 0) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const bootstrapFiles = [
  {
    path: "/workspace/struere.json",
    content: JSON.stringify({ version: "2.0", organization: { id: "test", slug: "mathland", name: "Mathland" } }, null, 2),
  },
  {
    path: "/workspace/package.json",
    content: JSON.stringify({ name: "mathland", version: "0.1.0", type: "module", scripts: { dev: "struere dev" }, devDependencies: { "bun-types": "^1.0.0", typescript: "^5.3.0" } }, null, 2),
  },
  {
    path: "/workspace/.env",
    content: `STRUERE_API_KEY=${STRUERE_API_KEY}\nSTRUERE_CONVEX_URL=${CONVEX_URL}\n`,
  },
  {
    path: "/workspace/CLAUDE.md",
    content: `# Struere Project — Mathland

## Environment
- This is a Struere AI agent project
- Use \`struere dev --force\` to sync changes to the platform

## File Structure
- \`agents/\` — Agent definitions (defineAgent)
- \`entity-types/\` — Entity type schemas (defineEntityType)
- \`roles/\` — RBAC role definitions (defineRole)
- \`triggers/\` — Event triggers (defineTrigger)

## SDK Imports
\`\`\`typescript
import { defineAgent, defineEntityType, defineRole, defineTrigger, defineTools } from 'struere'
\`\`\`

## Key Conventions
- After making changes to files, run: \`struere dev --force\`
`,
  },
  {
    path: "/workspace/opencode.json",
    content: JSON.stringify({
      $schema: "https://opencode.ai/config.json",
      provider: {
        openai: {
          models: {
            "grok-4-1-fast": { name: "Grok 4.1 Fast" },
          },
        },
      },
      model: "openai/grok-4-1-fast",
      instructions: ["CLAUDE.md"],
    }, null, 2),
  },
];

async function main() {
  console.log(`${ts()} ═══════════════════════════════════════════════`);
  console.log(`${ts()} Full Sandbox Test: struere pull + dev + Agent Prompt`);
  console.log(`${ts()} ═══════════════════════════════════════════════\n`);

  console.log(`${ts()} STEP 1: Create E2B sandbox`);
  const sandbox = await Sandbox.create({
    timeoutMs: 300_000,
    apiKey: E2B_API_KEY,
    envs: {
      STRUERE_API_KEY,
      STRUERE_CONVEX_URL: CONVEX_URL,
      OPENAI_API_KEY: XAI_API_KEY,
      OPENAI_BASE_URL: "https://api.x.ai/v1",
    },
    allowInternetAccess: true,
  });
  console.log(`  ✅ Sandbox created: ${sandbox.sandboxId}\n`);

  try {
    console.log(`${ts()} STEP 2: Write bootstrap files`);
    for (const file of bootstrapFiles) {
      await sandbox.files.write(file.path, file.content);
    }
    console.log(`  ✅ Wrote ${bootstrapFiles.length} bootstrap files\n`);

    console.log(`${ts()} STEP 3: Install bun + struere + sandbox-agent`);
    await runCmd(sandbox, "install-bun",
      "curl -fsSL https://bun.sh/install | bash && ln -sf $HOME/.bun/bin/bun /usr/local/bin/bun && ln -sf $HOME/.bun/bin/bunx /usr/local/bin/bunx",
      { timeoutMs: 30_000 }
    );
    await runCmd(sandbox, "install-struere",
      'export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && sudo npm install -g struere@latest',
      { timeoutMs: 60_000 }
    );
    await runCmd(sandbox, "install-sandbox-agent",
      `curl -fsSL https://releases.rivet.dev/sandbox-agent/${SANDBOX_AGENT_VERSION}/install.sh | sh`,
      { timeoutMs: 60_000 }
    );
    await runCmd(sandbox, "install-opencode",
      "sandbox-agent install-agent opencode",
      { timeoutMs: 120_000 }
    );

    console.log(`\n${ts()} STEP 4: Run struere pull --force`);
    const pullResult = await runCmd(sandbox, "struere-pull",
      'export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:/usr/local/bin:$PATH" && cd /workspace && struere pull --force',
      { timeoutMs: 60_000 }
    );
    if (pullResult.exitCode !== 0) {
      console.error(`  ❌ struere pull failed — aborting`);
      return;
    }

    const lsResult = await sandbox.commands.run("find /workspace -name '*.ts' | sort", { timeoutMs: 5000 });
    console.log(`\n--- FILES AFTER PULL ---`);
    console.log(lsResult.stdout);
    console.log(`--- END ---\n`);

    console.log(`${ts()} STEP 5: Start struere dev in background`);
    await sandbox.commands.run(
      'export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:/usr/local/bin:$PATH" && cd /workspace && struere dev --force > /tmp/struere-dev.log 2>&1',
      { background: true, timeoutMs: 0 }
    );
    console.log(`  ✅ struere dev started in background`);

    console.log(`\n${ts()} STEP 6: Start sandbox-agent server`);
    await sandbox.commands.run(
      `sandbox-agent server --no-token --host 0.0.0.0 --port ${PORT} > /tmp/sandbox-agent.log 2>&1`,
      { background: true, timeoutMs: 0 }
    );
    await new Promise(r => setTimeout(r, 2000));

    const healthy = await waitForServer(sandbox, PORT);
    if (!healthy) {
      const saLog = await sandbox.commands.run("cat /tmp/sandbox-agent.log 2>&1", { timeoutMs: 5000 });
      console.error("  ❌ sandbox-agent never became healthy");
      console.error(`  sandbox-agent log:\n${saLog.stdout}\n${saLog.stderr}`);
      return;
    }
    console.log(`  ✅ sandbox-agent healthy`);

    const baseUrl = `https://${sandbox.getHost(PORT)}`;
    console.log(`  URL: ${baseUrl}`);

    console.log(`\n${ts()} Waiting 10s for struere dev initial sync...`);
    await new Promise(r => setTimeout(r, 10000));

    const logResult = await sandbox.commands.run("cat /tmp/struere-dev.log", { timeoutMs: 5000 });
    console.log(`\n--- STRUERE DEV OUTPUT ---`);
    console.log(logResult.stdout);
    console.log(`--- END ---\n`);

    console.log(`${ts()} STEP 7: ACP initialize + create session`);
    const serverId = `test-${crypto.randomUUID()}`;

    const initRes = await acpPost(baseUrl, serverId, {
      jsonrpc: "2.0", id: nextRpcId(), method: "initialize",
      params: { protocolVersion: 1, clientInfo: { name: "struere-test", version: "1.0" } },
    }, { agent: "opencode" });

    if (initRes.status !== 200 || !initRes.json?.result) {
      console.error(`  ❌ ACP init failed: ${initRes.text?.slice(0, 300)}`);
      return;
    }
    console.log(`  ✅ ACP initialized`);

    const sessionRes = await acpPost(baseUrl, serverId, {
      jsonrpc: "2.0", id: nextRpcId(), method: "session/new",
      params: { cwd: "/workspace", mcpServers: [] },
    });
    const agentSessionId = sessionRes.json?.result?.sessionId;
    if (!agentSessionId) {
      console.error(`  ❌ session/new failed: ${sessionRes.text?.slice(0, 300)}`);
      return;
    }
    console.log(`  ✅ Session created: ${agentSessionId}`);

    console.log(`\n${ts()} STEP 8: Open SSE stream`);
    const sseAbort = new AbortController();
    const { events: sseEvents, ready: sseReady } = collectSseEvents(baseUrl, serverId, sseAbort.signal);
    try {
      await Promise.race([
        sseReady,
        new Promise((_, rej) => setTimeout(() => rej(new Error("SSE timeout")), 10_000)),
      ]);
      console.log(`  ✅ SSE connected`);
    } catch (e) {
      console.error(`  ❌ SSE failed: ${e.message}`);
      return;
    }
    await new Promise(r => setTimeout(r, 500));

    console.log(`\n${'='.repeat(60)}`);
    console.log(`${ts()} STEP 9: Send prompt — "change booking agent model to xai grok-4-1-fast"`);
    console.log(`${'='.repeat(60)}\n`);

    const eventsBefore = sseEvents.length;
    const promptRes = await acpPost(baseUrl, serverId, {
      jsonrpc: "2.0", id: nextRpcId(), method: "session/prompt",
      params: {
        prompt: [{ type: "text", text: "Change the booking agent model to use xai provider with grok-4-1-fast. Edit the file agents/booking.ts and update the model config. Then run struere dev --force to sync." }],
        sessionId: agentSessionId,
      },
    });

    if (promptRes.status === 200) {
      const stopReason = promptRes.json?.result?.stopReason;
      console.log(`${ts()} ✅ Prompt completed (stopReason=${stopReason})`);
    } else {
      console.error(`${ts()} ❌ Prompt failed: ${promptRes.text?.slice(0, 500)}`);
    }

    console.log(`\n${ts()} STEP 10: Collect SSE events`);
    await new Promise(r => setTimeout(r, 2000));
    const promptEvents = sseEvents.slice(eventsBefore);
    console.log(`  Received ${promptEvents.length} events during prompt`);

    const updateTypes = new Set();
    let agentText = "";
    let thinkingText = "";
    for (const evt of promptEvents) {
      const update = evt.params?.update?.sessionUpdate;
      if (update) updateTypes.add(update);
      if (update === "agent_message_chunk") {
        agentText += evt.params?.update?.content?.text || "";
      }
      if (update === "agent_thought_chunk") {
        thinkingText += evt.params?.update?.content?.text || "";
      }
    }

    console.log(`  Event types: [${[...updateTypes].join(", ")}]`);
    if (thinkingText) console.log(`\n--- AGENT THINKING (first 500 chars) ---\n${thinkingText.slice(0, 500)}\n--- END ---`);
    if (agentText) console.log(`\n--- AGENT RESPONSE ---\n${agentText.slice(0, 1000)}\n--- END ---`);

    console.log(`\n${ts()} STEP 11: Verify file was changed`);
    const fileResult = await sandbox.commands.run("cat /workspace/agents/booking.ts", { timeoutMs: 5000 });
    console.log(`\n--- agents/booking.ts AFTER ---`);
    console.log(fileResult.stdout);
    console.log(`--- END ---`);

    const hasXai = fileResult.stdout.includes("xai") && fileResult.stdout.includes("grok");
    if (hasXai) {
      console.log(`\n  ✅ Agent successfully changed model to xai/grok!`);
    } else {
      console.log(`\n  ❌ Model was NOT changed — file still has original content`);
    }

    console.log(`\n${ts()} STEP 12: Check struere dev log for re-sync`);
    await new Promise(r => setTimeout(r, 3000));
    const finalLog = await sandbox.commands.run("cat /tmp/struere-dev.log", { timeoutMs: 5000 });
    console.log(`\n--- FINAL STRUERE DEV LOG ---`);
    console.log(finalLog.stdout);
    console.log(`--- END ---`);

    sseAbort.abort();

  } finally {
    console.log(`\n${ts()} Killing sandbox...`);
    await Sandbox.kill(sandbox.sandboxId, { apiKey: E2B_API_KEY }).catch(() => {});
    console.log(`${ts()} Done.`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
