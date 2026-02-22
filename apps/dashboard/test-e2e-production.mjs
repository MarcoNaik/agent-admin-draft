/**
 * E2E Production Test for Studio
 *
 * Tests the actual deployed app.struere.dev API routes end-to-end.
 * Requires a Clerk session token (get from browser DevTools → Application → Cookies → __session).
 *
 * Usage:
 *   bun run test-e2e-production.mjs <clerk_session_token>
 *   bun run test-e2e-production.mjs <clerk_session_token> --base https://app.struere.dev
 */

const CLERK_TOKEN = process.argv[2];
const BASE_URL = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "https://app.struere.dev";

if (!CLERK_TOKEN || CLERK_TOKEN.startsWith("--")) {
  console.error("Usage: bun run test-e2e-production.mjs <clerk_session_token> [--base URL]");
  console.error("");
  console.error("Get your session token from browser DevTools:");
  console.error("  Application → Cookies → __session (on app.struere.dev)");
  process.exit(1);
}

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

async function apiRequest(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    Cookie: `__session=${CLERK_TOKEN}`,
  };
  const opts = { method, headers };
  if (body) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  return res;
}

function openSseStream(path, signal) {
  const url = `${BASE_URL}${path}`;
  const events = [];
  const ready = new Promise((resolve, reject) => {
    (async () => {
      try {
        const res = await fetch(url, {
          headers: {
            Cookie: `__session=${CLERK_TOKEN}`,
            Accept: "text/event-stream",
          },
          signal,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          reject(new Error(`SSE ${res.status}: ${body.slice(0, 200)}`));
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
  console.log(`${ts()} E2E Production Test — ${BASE_URL}`);
  console.log(`${ts()} ═══════════════════════════════════════════════\n`);

  let sessionId = null;

  try {
    console.log(`${ts()} STEP 1: Auth check`);
    const authRes = await apiRequest("GET", "/api/studio/sessions?check=1");
    if (authRes.status === 401) {
      fail("auth check", "Session token is invalid or expired. Get a fresh __session cookie.");
      return;
    }
    pass("auth check", `status=${authRes.status}`);

    console.log(`\n${ts()} STEP 2: Create studio session`);
    console.log(`  ℹ️  This provisions an E2B sandbox (may take 30-60s)...`);
    const createRes = await apiRequest("POST", "/api/studio/sessions", {
      agentType: "opencode",
      environment: "development",
    });
    const createText = await createRes.text();
    let createBody;
    try { createBody = JSON.parse(createText); } catch {
      fail("create session", `status=${createRes.status} non-JSON response: ${createText.slice(0, 500)}`);
      return;
    }
    if (createRes.status === 200 && createBody.sessionId) {
      sessionId = createBody.sessionId;
      pass("create session", `sessionId=${sessionId}`);
    } else {
      fail("create session", `status=${createRes.status} body=${JSON.stringify(createBody).slice(0, 300)}`);
      return;
    }

    console.log(`\n${ts()} STEP 3: Open SSE event stream`);
    const sseAbort = new AbortController();
    const { events: sseEvents, ready: sseReady } = openSseStream(
      `/api/studio/sessions/${sessionId}/events`,
      sseAbort.signal
    );
    try {
      await Promise.race([
        sseReady,
        new Promise((_, rej) => setTimeout(() => rej(new Error("SSE connect timeout (15s)")), 15_000)),
      ]);
      pass("SSE connected");
    } catch (e) {
      fail("SSE connected", e.message);
      return;
    }

    await new Promise((r) => setTimeout(r, 2000));
    console.log(`  ℹ️  SSE received ${sseEvents.length} initial events`);

    console.log(`\n${ts()} STEP 4: Send message`);
    const eventsBefore = sseEvents.length;
    const msgRes = await apiRequest("POST", `/api/studio/sessions/${sessionId}/message`, {
      message: "What is 2 + 2? Reply with just the number, nothing else.",
    });
    const msgBody = await msgRes.json();
    if (msgRes.status === 200 && msgBody.success) {
      pass("send message", "status=200");
    } else {
      fail("send message", `status=${msgRes.status} body=${JSON.stringify(msgBody).slice(0, 300)}`);
    }

    console.log(`\n${ts()} STEP 5: Verify SSE events (waiting up to 15s for agent response)...`);
    let agentText = "";
    const updateTypes = new Set();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const newEvents = sseEvents.slice(eventsBefore);
      for (const evt of newEvents) {
        const update = evt.params?.update?.sessionUpdate;
        if (update) updateTypes.add(update);
        if (update === "agent_message_chunk") {
          agentText += evt.params?.update?.content?.text || "";
        }
      }
      if (agentText.trim()) break;
    }

    const promptEvents = sseEvents.slice(eventsBefore);
    if (promptEvents.length > 0) {
      pass("SSE events received", `count=${promptEvents.length} types=[${[...updateTypes].join(", ")}]`);
    } else {
      fail("SSE events received", "no events received within 15s");
    }

    if (agentText.trim()) {
      pass("agent response", `"${agentText.trim().slice(0, 100)}"`);
    } else {
      fail("agent response", "no agent_message_chunk text in SSE events");
    }

    console.log(`\n${ts()} STEP 6: Second message (verify conversation context)`);
    const events2Before = sseEvents.length;
    const msg2Res = await apiRequest("POST", `/api/studio/sessions/${sessionId}/message`, {
      message: "Multiply that by 3. Reply with just the number.",
    });
    const msg2Body = await msg2Res.json();
    if (msg2Res.status === 200 && msg2Body.success) {
      pass("send second message");
    } else {
      fail("send second message", `status=${msg2Res.status}`);
    }

    let agent2Text = "";
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      for (const evt of sseEvents.slice(events2Before)) {
        if (evt.params?.update?.sessionUpdate === "agent_message_chunk") {
          agent2Text += evt.params?.update?.content?.text || "";
        }
      }
      if (agent2Text.trim()) break;
    }

    if (agent2Text.trim()) {
      pass("second response", `"${agent2Text.trim().slice(0, 100)}"`);
    } else {
      fail("second response", "no agent response for second message");
    }

    console.log(`\n${ts()} STEP 7: SSE reconnect (close + reopen)`);
    sseAbort.abort();
    await new Promise((r) => setTimeout(r, 500));

    const sse2Abort = new AbortController();
    const { events: sse2Events, ready: sse2Ready } = openSseStream(
      `/api/studio/sessions/${sessionId}/events`,
      sse2Abort.signal
    );
    try {
      await Promise.race([
        sse2Ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error("SSE reconnect timeout")), 15_000)),
      ]);
      pass("SSE reconnect");
    } catch (e) {
      fail("SSE reconnect", e.message);
    }

    await new Promise((r) => setTimeout(r, 1000));
    console.log(`  ℹ️  SSE reconnect received ${sse2Events.length} replay events`);

    const events3Before = sse2Events.length;
    await apiRequest("POST", `/api/studio/sessions/${sessionId}/message`, {
      message: "What is 10 - 3? Reply with just the number.",
    });

    let agent3Text = "";
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      for (const evt of sse2Events.slice(events3Before)) {
        if (evt.params?.update?.sessionUpdate === "agent_message_chunk") {
          agent3Text += evt.params?.update?.content?.text || "";
        }
      }
      if (agent3Text.trim()) break;
    }

    if (agent3Text.trim()) {
      pass("prompt after reconnect", `"${agent3Text.trim().slice(0, 100)}"`);
    } else {
      fail("prompt after reconnect", "no response after SSE reconnect");
    }

    sse2Abort.abort();

    console.log(`\n${ts()} STEP 8: Keepalive`);
    const keepRes = await apiRequest("POST", `/api/studio/sessions/${sessionId}/keepalive`);
    if (keepRes.status === 200) {
      pass("keepalive");
    } else {
      fail("keepalive", `status=${keepRes.status}`);
    }

    console.log(`\n${ts()} STEP 9: Stop session`);
    const stopRes = await apiRequest("DELETE", `/api/studio/sessions/${sessionId}`);
    if (stopRes.status === 200) {
      pass("stop session");
      sessionId = null;
    } else {
      fail("stop session", `status=${stopRes.status} body=${await stopRes.text().catch(() => "")}`);
    }

  } catch (err) {
    fail("UNHANDLED", err.message);
    console.error(err);
  } finally {
    if (sessionId) {
      console.log(`\n${ts()} ⚠️  Session ${sessionId} was not cleaned up. Stop it manually.`);
    }

    console.log(`\n${"═".repeat(50)}`);
    console.log(`RESULTS: ${results.filter(r => r.status === "PASS").length} passed, ${results.filter(r => r.status === "FAIL").length} failed`);
    console.log(`TARGET:  ${BASE_URL}`);
    console.log("═".repeat(50));
    for (const r of results) {
      console.log(`  ${r.status === "PASS" ? "✅" : "❌"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    }
    console.log("═".repeat(50));

    if (results.some(r => r.status === "FAIL")) {
      process.exit(1);
    }
  }
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
