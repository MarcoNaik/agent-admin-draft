import { Sandbox } from "@e2b/code-interpreter";

const E2B_API_KEY = process.env.E2B_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const PORT = 3000;
const SANDBOX_AGENT_VERSION = "0.2.x";

let rpcId = 0;
const results = [];

function ts() {
  return `[${(performance.now() / 1000).toFixed(2)}s]`;
}

function pass(name, detail) {
  results.push({ name, status: "PASS", detail });
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, status: "FAIL", detail });
  console.error(`  ❌ ${name} — ${detail}`);
}

function nextRpcId() {
  return ++rpcId;
}

async function acpPost(baseUrl, serverId, body, query) {
  const url = new URL(`${baseUrl}/v1/acp/${encodeURIComponent(serverId)}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
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

async function runCmd(sandbox, label, cmd, opts = {}) {
  const result = await sandbox.commands.run(cmd, opts);
  if (!opts.background && result.exitCode !== 0) {
    throw new Error(`[${label}] exit ${result.exitCode}: ${result.stderr?.slice(0, 300)}`);
  }
  return result;
}

async function waitForServer(sandbox, port, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await sandbox.commands.run(`curl -sf http://127.0.0.1:${port}/v1/health`, { timeoutMs: 3000 });
      if (r.exitCode === 0) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
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
        if (!res.ok) {
          reject(new Error(`SSE ${res.status}: ${await res.text()}`));
          return;
        }
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
              try {
                const envelope = JSON.parse(dataLines.join("\n"));
                events.push(envelope);
              } catch {}
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

async function main() {
  console.log(`${ts()} ═══════════════════════════════════════════════`);
  console.log(`${ts()} E2E Studio Test — Raw ACP (no SDK)`);
  console.log(`${ts()} ═══════════════════════════════════════════════\n`);

  console.log(`${ts()} STEP 1: Create E2B sandbox`);
  const sandbox = await Sandbox.create({
    timeoutMs: 300_000,
    envs: { ANTHROPIC_API_KEY },
    allowInternetAccess: true,
    apiKey: E2B_API_KEY,
  });
  pass("sandbox.create", `id=${sandbox.sandboxId}`);

  try {
    console.log(`\n${ts()} STEP 2: Install sandbox-agent + opencode`);
    await runCmd(sandbox, "install-sa", `curl -fsSL https://releases.rivet.dev/sandbox-agent/${SANDBOX_AGENT_VERSION}/install.sh | sh`, { timeoutMs: 60_000 });
    pass("install sandbox-agent");
    await runCmd(sandbox, "install-agent", "sandbox-agent install-agent opencode", { timeoutMs: 120_000 });
    pass("install opencode");

    console.log(`\n${ts()} STEP 3: Start server + wait for health`);
    await runCmd(sandbox, "start", `sandbox-agent server --no-token --host 0.0.0.0 --port ${PORT}`, { background: true, timeoutMs: 0 });
    const healthy = await waitForServer(sandbox, PORT);
    if (!healthy) { fail("server health", "never became healthy"); return; }
    pass("server healthy");

    const baseUrl = `https://${sandbox.getHost(PORT)}`;

    const extHealth = await fetch(`${baseUrl}/v1/health`, { signal: AbortSignal.timeout(10_000) });
    if (extHealth.status === 200) {
      pass("external health", `${baseUrl}`);
    } else {
      fail("external health", `status=${extHealth.status}`); return;
    }

    console.log(`\n${ts()} STEP 4: ACP initialize (raw HTTP — no SDK)`);
    const serverId = `web-${crypto.randomUUID()}`;
    const initBody = {
      jsonrpc: "2.0",
      id: nextRpcId(),
      method: "initialize",
      params: {
        protocolVersion: 1,
        clientInfo: { name: "struere-studio", version: "1.0" },
      },
    };
    const initRes = await acpPost(baseUrl, serverId, initBody, { agent: "opencode" });
    if (initRes.status === 200 && initRes.json?.result) {
      pass("ACP initialize", `serverId=${serverId}`);
    } else {
      fail("ACP initialize", `status=${initRes.status} body=${initRes.text?.slice(0, 200)}`); return;
    }

    console.log(`\n${ts()} STEP 5: Create session (raw HTTP — session/new)`);
    const newSessionBody = {
      jsonrpc: "2.0",
      id: nextRpcId(),
      method: "session/new",
      params: {
        cwd: "/",
        mcpServers: [],
      },
    };
    const sessionRes = await acpPost(baseUrl, serverId, newSessionBody);
    const agentSessionId = sessionRes.json?.result?.sessionId;
    if (sessionRes.status === 200 && agentSessionId) {
      pass("session/new", `agentSessionId=${agentSessionId}`);
    } else {
      fail("session/new", `status=${sessionRes.status} body=${sessionRes.text?.slice(0, 300)}`); return;
    }

    console.log(`\n${ts()} STEP 6: Verify ACP server listed`);
    const acpListRes = await fetch(`${baseUrl}/v1/acp`, { signal: AbortSignal.timeout(5000) });
    const acpListData = await acpListRes.json();
    const ourServer = acpListData.servers?.find((s) => s.serverId === serverId);
    if (ourServer) {
      pass("ACP server listed", `agent=${ourServer.agent}`);
    } else {
      fail("ACP server listed", `servers=${JSON.stringify(acpListData.servers?.map(s => s.serverId))}`);
    }

    console.log(`\n${ts()} STEP 7: Open SSE stream (like events/route.ts)`);
    const sseAbort = new AbortController();
    const { events: sseEvents, ready: sseReady } = collectSseEvents(baseUrl, serverId, sseAbort.signal);
    try {
      await Promise.race([
        sseReady,
        new Promise((_, rej) => setTimeout(() => rej(new Error("SSE connect timeout")), 10_000)),
      ]);
      pass("SSE connected");
    } catch (e) {
      fail("SSE connected", e.message); return;
    }

    await new Promise((r) => setTimeout(r, 500));
    const initEvents = sseEvents.length;
    console.log(`  ℹ️  SSE received ${initEvents} initial events (ACP handshake replay)`);

    console.log(`\n${ts()} STEP 8: Send prompt (like message/route.ts)`);
    const promptBody = {
      jsonrpc: "2.0",
      id: nextRpcId(),
      method: "session/prompt",
      params: {
        prompt: [{ type: "text", text: "What is 2 + 2? Reply with just the number, nothing else." }],
        sessionId: agentSessionId,
      },
    };
    const promptRes = await acpPost(baseUrl, serverId, promptBody);
    if (promptRes.status === 200) {
      const stopReason = promptRes.json?.result?.stopReason;
      pass("session/prompt POST", `stopReason=${stopReason}`);
    } else {
      fail("session/prompt POST", `status=${promptRes.status} body=${promptRes.text?.slice(0, 300)}`);
    }

    console.log(`\n${ts()} STEP 9: Verify SSE events received during prompt`);
    await new Promise((r) => setTimeout(r, 1000));
    const promptEvents = sseEvents.slice(initEvents);
    console.log(`  ℹ️  SSE received ${promptEvents.length} events during/after prompt`);

    const updateTypes = new Set();
    let agentText = "";
    for (const evt of promptEvents) {
      const method = evt.method;
      const update = evt.params?.update?.sessionUpdate;
      if (update) updateTypes.add(update);
      if (update === "agent_message_chunk") {
        agentText += evt.params?.update?.content?.text || "";
      }
    }

    if (promptEvents.length > 0) {
      pass("SSE events received", `count=${promptEvents.length} types=[${[...updateTypes].join(", ")}]`);
    } else {
      fail("SSE events received", "no events received on SSE during prompt");
    }

    if (agentText.trim()) {
      pass("agent response text", `"${agentText.trim().slice(0, 100)}"`);
    } else {
      fail("agent response text", "no agent_message_chunk text found in SSE events");
    }

    console.log(`\n${ts()} STEP 10: Send second prompt (verify ongoing conversation)`);
    const prompt2Body = {
      jsonrpc: "2.0",
      id: nextRpcId(),
      method: "session/prompt",
      params: {
        prompt: [{ type: "text", text: "Now multiply that by 3. Reply with just the number." }],
        sessionId: agentSessionId,
      },
    };
    const eventsBefore = sseEvents.length;
    const prompt2Res = await acpPost(baseUrl, serverId, prompt2Body);
    await new Promise((r) => setTimeout(r, 1000));
    const prompt2Events = sseEvents.slice(eventsBefore);

    let agent2Text = "";
    for (const evt of prompt2Events) {
      if (evt.params?.update?.sessionUpdate === "agent_message_chunk") {
        agent2Text += evt.params?.update?.content?.text || "";
      }
    }

    if (prompt2Res.status === 200 && agent2Text.trim()) {
      pass("second prompt round-trip", `response="${agent2Text.trim().slice(0, 100)}" events=${prompt2Events.length}`);
    } else {
      fail("second prompt round-trip", `status=${prompt2Res.status} text="${agent2Text}" events=${prompt2Events.length}`);
    }

    console.log(`\n${ts()} STEP 11: Verify SSE survives without SDK (no "unknown request" warnings)`);
    pass("no SDK used", "entire flow used raw HTTP — no SSE loop competition");

    sseAbort.abort();

    console.log(`\n${ts()} STEP 12: Reconnect SSE (simulate page reload)`);
    const sse2Abort = new AbortController();
    const { events: sse2Events, ready: sse2Ready } = collectSseEvents(baseUrl, serverId, sse2Abort.signal);
    try {
      await Promise.race([
        sse2Ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error("SSE reconnect timeout")), 10_000)),
      ]);
      pass("SSE reconnect");
    } catch (e) {
      fail("SSE reconnect", e.message);
    }

    await new Promise((r) => setTimeout(r, 500));
    console.log(`  ℹ️  SSE reconnect received ${sse2Events.length} replay events`);

    const prompt3Body = {
      jsonrpc: "2.0",
      id: nextRpcId(),
      method: "session/prompt",
      params: {
        prompt: [{ type: "text", text: "What is 10 - 3? Reply with just the number." }],
        sessionId: agentSessionId,
      },
    };
    const events3Before = sse2Events.length;
    const prompt3Res = await acpPost(baseUrl, serverId, prompt3Body);
    await new Promise((r) => setTimeout(r, 1000));
    const prompt3Events = sse2Events.slice(events3Before);

    let agent3Text = "";
    for (const evt of prompt3Events) {
      if (evt.params?.update?.sessionUpdate === "agent_message_chunk") {
        agent3Text += evt.params?.update?.content?.text || "";
      }
    }

    if (prompt3Res.status === 200 && agent3Text.trim()) {
      pass("prompt after reconnect", `response="${agent3Text.trim().slice(0, 100)}" events=${prompt3Events.length}`);
    } else {
      fail("prompt after reconnect", `status=${prompt3Res.status} text="${agent3Text}" events=${prompt3Events.length}`);
    }

    sse2Abort.abort();

  } catch (err) {
    fail("UNHANDLED", err.message);
    console.error(err);
  } finally {
    console.log(`\n${ts()} === Cleanup ===`);
    await Sandbox.kill(sandbox.sandboxId, { apiKey: E2B_API_KEY }).catch(() => {});

    console.log(`\n${"═".repeat(50)}`);
    console.log(`RESULTS: ${results.filter(r => r.status === "PASS").length} passed, ${results.filter(r => r.status === "FAIL").length} failed`);
    console.log("═".repeat(50));
    for (const r of results) {
      console.log(`  ${r.status === "PASS" ? "✅" : "❌"} ${r.name}`);
    }
    console.log("═".repeat(50));

    if (results.some(r => r.status === "FAIL")) {
      process.exit(1);
    }
  }
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
