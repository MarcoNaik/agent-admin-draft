import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { PlatformError, generateId, chatRequestSchema } from '@struere/platform-shared'
import { chatHandler } from './handlers/chat'
import { devSyncHandler } from './handlers/dev-sync'
import { apiKeyAuth } from './middleware/auth'
import { resolveAgent } from './middleware/resolve'
import { DevSessionDO } from './durable-objects/DevSession'
import { executeAgent, streamAgent } from './executor'
import { api } from './api'
import type { Env } from './types'

export { DevSessionDO }

interface GatewayVariables {
  agentSlug: string
  environment: 'development' | 'production'
}

const app = new Hono<{ Bindings: Env; Variables: GatewayVariables }>()

app.use('*', async (c, next) => {
  const host = c.req.header('host') || ''
  if (host === 'api.struere.dev' || host.startsWith('api.')) {
    return api.fetch(c.req.raw, c.env, c.executionCtx)
  }
  return next()
})

app.use('*', cors({
  origin: '*',
  credentials: true
}))

app.use('*', async (c, next) => {
  const host = c.req.header('host') || ''
  const reservedSubdomains = ['api', 'gateway', 'app', 'www', 'dashboard', 'admin']

  if (host.endsWith('-dev.struere.dev')) {
    const slug = host.replace('-dev.struere.dev', '')
    if (!reservedSubdomains.includes(slug)) {
      c.set('agentSlug', slug)
      c.set('environment', 'development')
    }
    return next()
  }

  if (host.endsWith('.struere.dev')) {
    const slug = host.replace('.struere.dev', '')
    if (!reservedSubdomains.includes(slug)) {
      c.set('agentSlug', slug)
      c.set('environment', 'production')
    }
  }

  return next()
})

app.get('/health', (c) => c.json({ status: 'ok', service: 'gateway' }))

app.all('*', async (c, next) => {
  const slug = c.get('agentSlug')
  const environment = c.get('environment') as 'development' | 'production' | undefined

  if (!slug || !environment) {
    return next()
  }

  const path = new URL(c.req.url).pathname

  if (path === '/' || path === '') {
    const agent = await c.env.DB.prepare(`
      SELECT a.id, a.name, a.slug, a.development_version_id, a.production_version_id
      FROM agents a
      WHERE a.slug = ? AND a.status = 'active'
    `).bind(slug).first<{ id: string; name: string; slug: string; development_version_id: string | null; production_version_id: string | null }>()

    if (!agent) {
      return c.html(`<html><body><h1>Agent not found</h1><p>No agent with slug "${slug}" exists.</p></body></html>`, 404)
    }

    const versionId = environment === 'development' ? agent.development_version_id : agent.production_version_id

    if (!versionId) {
      return c.html(getNotDeployedHtml(agent.name, environment), 200)
    }

    return c.html(getChatHtml(agent.name, agent.slug, environment), 200)
  }

  if (path === '/chat' && c.req.method === 'POST') {
    const agent = await c.env.DB.prepare(`
      SELECT a.id, a.name, a.slug, a.organization_id,
        CASE WHEN ? = 'development' THEN a.development_version_id ELSE a.production_version_id END as version_id
      FROM agents a
      WHERE a.slug = ? AND a.status = 'active'
    `).bind(environment, slug).first<{ id: string; name: string; slug: string; organization_id: string; version_id: string | null }>()

    if (!agent || !agent.version_id) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Agent not deployed to this environment' } }, 404)
    }

    const version = await c.env.DB.prepare(`
      SELECT bundle_key FROM agent_versions WHERE id = ?
    `).bind(agent.version_id).first<{ bundle_key: string }>()

    if (!version) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Agent version not found' } }, 404)
    }

    const bundle = await c.env.BUNDLES.get(version.bundle_key)
    if (!bundle) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Agent bundle not found' } }, 404)
    }

    const bundleCode = await bundle.text()
    const body = await c.req.json()
    const parsed = chatRequestSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } }, 400)
    }

    const { message, conversationId, userId, stream, metadata } = parsed.data
    const convId = conversationId || generateId('conv')

    const agentContext = {
      agentId: agent.id,
      versionId: agent.version_id,
      bundleKey: version.bundle_key,
      organizationId: agent.organization_id,
      slug: agent.slug
    }

    if (stream) {
      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      const encoder = new TextEncoder()

      streamAgent({
        bundleCode,
        message,
        conversationId: convId,
        userId,
        metadata,
        env: c.env,
        agent: agentContext,
        onChunk: async (chunk) => {
          await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        },
        onComplete: async () => {
          await writer.close()
        },
        onError: async (error) => {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`))
          await writer.close()
        }
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    }

    const result = await executeAgent({
      bundleCode,
      message,
      conversationId: convId,
      userId,
      metadata,
      env: c.env,
      agent: agentContext
    })

    return c.json({
      id: generateId('msg'),
      conversationId: convId,
      content: result.content,
      toolCalls: result.toolCalls,
      usage: result.usage,
      finishReason: result.finishReason
    })
  }

  return c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404)
})

app.post('/v1/agents/:slug/chat', apiKeyAuth, resolveAgent, chatHandler)

app.get('/v1/dev/sync', (c) => {
  const upgradeHeader = c.req.header('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket', 426)
  }

  const sessionId = c.req.query('session') || crypto.randomUUID()
  const id = c.env.DEV_SESSIONS.idFromName(sessionId)
  const stub = c.env.DEV_SESSIONS.get(id)

  return stub.fetch(c.req.raw)
})

app.post('/v1/dev/:sessionId/chat', devSyncHandler)

app.onError((err, c) => {
  if (err instanceof PlatformError) {
    return c.json(err.toJSON(), err.statusCode as 400)
  }
  console.error('Gateway error:', err)
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
})

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))

function getNotDeployedHtml(agentName: string, environment: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${agentName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fafafa; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    p { color: #888; margin-bottom: 0.5rem; }
    code { background: #1e1e1e; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${agentName}</h1>
    <p>Not deployed to ${environment} yet.</p>
    <p>Run <code>struere ${environment === 'development' ? 'dev' : 'deploy'}</code> to deploy.</p>
  </div>
</body>
</html>`
}

function getChatHtml(agentName: string, slug: string, environment: string): string {
  const envBadge = environment === 'production'
    ? '<span style="background: #166534; color: #bbf7d0; padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem;">Production</span>'
    : '<span style="background: #854d0e; color: #fef08a; padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem;">Development</span>'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${agentName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fafafa; height: 100vh; display: flex; flex-direction: column; }
    header { padding: 1rem 1.5rem; border-bottom: 1px solid #262626; display: flex; justify-content: space-between; align-items: center; background: #0a0a0a; }
    header h1 { font-size: 1.125rem; font-weight: 600; display: flex; align-items: center; gap: 0.75rem; }
    #messages { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .message { max-width: 80%; padding: 0.875rem 1rem; border-radius: 1rem; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; }
    .message.user { align-self: flex-end; background: #2563eb; border-bottom-right-radius: 0.25rem; }
    .message.assistant { align-self: flex-start; background: #1c1c1c; border-bottom-left-radius: 0.25rem; }
    .message.tool { align-self: flex-start; background: #172554; font-family: monospace; font-size: 0.875rem; border-left: 3px solid #3b82f6; border-radius: 0.5rem; max-width: 90%; }
    .message.error { background: #450a0a; border-left: 3px solid #ef4444; }
    .message.streaming::after { content: '▋'; animation: blink 1s infinite; }
    @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
    .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #525252; }
    .empty-state h2 { font-size: 1.25rem; margin-bottom: 0.5rem; color: #737373; }
    .empty-state p { font-size: 0.875rem; }
    form { padding: 1rem 1.5rem; border-top: 1px solid #262626; display: flex; gap: 0.75rem; background: #0a0a0a; }
    input { flex: 1; padding: 0.875rem 1rem; background: #171717; border: 1px solid #262626; border-radius: 0.75rem; color: #fafafa; font-size: 1rem; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: #3b82f6; }
    input:disabled { opacity: 0.5; }
    input::placeholder { color: #525252; }
    button { padding: 0.875rem 1.5rem; background: #2563eb; border: none; border-radius: 0.75rem; color: white; font-size: 1rem; font-weight: 500; cursor: pointer; transition: background 0.2s; }
    button:hover:not(:disabled) { background: #1d4ed8; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <header>
    <h1>${agentName} ${envBadge}</h1>
  </header>
  <div id="messages">
    <div class="empty-state">
      <h2>Start a conversation</h2>
      <p>Send a message to begin chatting with ${agentName}</p>
    </div>
  </div>
  <form id="chat-form">
    <input type="text" id="input" placeholder="Type a message..." autocomplete="off" autofocus />
    <button type="submit">Send</button>
  </form>
  <script>
    const messages = document.getElementById('messages');
    const form = document.getElementById('chat-form');
    const input = document.getElementById('input');
    const button = form.querySelector('button');
    let conversationId = null;
    let isProcessing = false;
    let hasMessages = false;

    function clearEmptyState() {
      if (!hasMessages) {
        messages.innerHTML = '';
        hasMessages = true;
      }
    }

    function addMessage(role, content, isStreaming = false) {
      clearEmptyState();
      const div = document.createElement('div');
      div.className = 'message ' + role + (isStreaming ? ' streaming' : '');
      div.textContent = content;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
      return div;
    }

    function setProcessing(processing) {
      isProcessing = processing;
      input.disabled = processing;
      button.disabled = processing;
    }

    async function sendMessage(message) {
      const assistantDiv = addMessage('assistant', '', true);

      try {
        const response = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, conversationId, stream: true }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.conversationId) conversationId = data.conversationId;

                if (data.type === 'text-delta' && data.textDelta) {
                  fullText += data.textDelta;
                  assistantDiv.textContent = fullText;
                  messages.scrollTop = messages.scrollHeight;
                } else if (data.type === 'tool-call-start') {
                  addMessage('tool', '🔧 ' + (data.toolName || 'Tool call'));
                } else if (data.type === 'tool-result') {
                  const result = typeof data.toolResult === 'string' ? data.toolResult : JSON.stringify(data.toolResult, null, 2);
                  addMessage('tool', '→ ' + result);
                } else if (data.type === 'finish') {
                  assistantDiv.classList.remove('streaming');
                } else if (data.type === 'error') {
                  assistantDiv.textContent = data.error || data.message || 'An error occurred';
                  assistantDiv.classList.remove('streaming');
                  assistantDiv.classList.add('error');
                }
              } catch {}
            }
          }
        }

        if (!fullText && !assistantDiv.classList.contains('error')) {
          assistantDiv.textContent = 'No response';
          assistantDiv.classList.remove('streaming');
        }
      } catch (err) {
        assistantDiv.textContent = 'Error: ' + err.message;
        assistantDiv.classList.remove('streaming');
        assistantDiv.classList.add('error');
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isProcessing) return;

      const message = input.value.trim();
      if (!message) return;

      addMessage('user', message);
      input.value = '';
      setProcessing(true);

      await sendMessage(message);
      setProcessing(false);
      input.focus();
    });
  </script>
</body>
</html>`
}

export default app
