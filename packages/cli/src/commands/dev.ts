import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import chokidar from 'chokidar'
import { join } from 'path'
import { loadConfig } from '../utils/config'
import { loadAgent } from '../utils/agent'
import { AgentExecutor } from '@struere/runtime'
import { isLoggedIn, loadCredentials, getApiKey } from '../utils/credentials'
import { getSyncUrl } from '../utils/api'
import { hasProject, loadProject } from '../utils/project'

export const devCommand = new Command('dev')
  .description('Start development server with cloud sync')
  .option('-p, --port <port>', 'Port to run on', '3000')
  .option('-c, --channel <channel>', 'Channel to open (web, api)', 'web')
  .option('--no-open', 'Do not open browser')
  .action(async (options) => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Struere Dev Server'))
    console.log()

    if (!hasProject(cwd)) {
      console.log(chalk.yellow('No struere.json found'))
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('struere init'), chalk.gray('to initialize this project'))
      console.log()
      process.exit(1)
    }

    const project = loadProject(cwd)
    if (!project) {
      console.log(chalk.red('Failed to load struere.json'))
      process.exit(1)
    }

    console.log(chalk.gray('Agent:'), chalk.cyan(project.agent.name))
    console.log()

    spinner.start('Loading configuration')

    const config = await loadConfig(cwd)
    const port = parseInt(options.port) || config.port || 3000

    spinner.succeed('Configuration loaded')

    spinner.start('Loading agent')

    let agent = await loadAgent(cwd)

    spinner.succeed(`Agent "${agent.name}" loaded`)

    const credentials = loadCredentials()
    const apiKey = getApiKey()

    if (!credentials && !apiKey) {
      spinner.fail('Not logged in')
      console.log()
      console.log(chalk.gray('Run'), chalk.cyan('struere login'), chalk.gray('to authenticate'))
      console.log()
      process.exit(1)
    }

    await runCloudDev(agent, project, cwd, port, options, spinner)
  })

async function runCloudDev(
  agent: ReturnType<typeof loadAgent> extends Promise<infer T> ? T : never,
  project: { agentId: string; team: string; agent: { slug: string; name: string } },
  cwd: string,
  port: number,
  options: { channel: string; open: boolean },
  spinner: ReturnType<typeof ora>
) {
  const credentials = loadCredentials()
  const apiKey = getApiKey()

  spinner.start('Connecting to Struere Cloud')

  const syncUrl = getSyncUrl()
  const ws = new WebSocket(`${syncUrl}/v1/dev/sync`)

  let cloudUrl: string | null = null
  let sessionId: string | null = null
  let isConnected = false

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'auth',
      apiKey: apiKey || credentials?.token
    }))
  }

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data as string) as {
      type: string
      organizationId?: string
      agentId?: string
      url?: string
      level?: string
      message?: string
      code?: string
      timestamp?: string
    }

    switch (data.type) {
      case 'authenticated':
        spinner.text = 'Syncing agent'
        const bundle = await bundleAgent(cwd)
        const configHash = hashString(bundle)
        ws.send(JSON.stringify({
          type: 'sync',
          agentId: project.agentId,
          agentSlug: project.agent.slug,
          bundle,
          configHash
        }))
        break

      case 'synced':
        isConnected = true
        cloudUrl = data.url || null
        sessionId = data.agentId || null
        spinner.succeed('Connected to Struere Cloud')
        console.log()
        console.log(chalk.gray('Mode:'), chalk.green('Cloud'))
        console.log(chalk.green('Agent running at'), chalk.cyan(cloudUrl))
        console.log(chalk.green('Local server at'), chalk.cyan(`http://localhost:${port}`))
        console.log()
        spinner.start('Watching for changes')
        break

      case 'log':
        const logColor = data.level === 'error' ? chalk.red
          : data.level === 'warn' ? chalk.yellow
          : data.level === 'debug' ? chalk.gray
          : chalk.blue
        spinner.stop()
        console.log(logColor(`[${data.level}]`), data.message)
        spinner.start('Watching for changes')
        break

      case 'error':
        spinner.fail(`Cloud error: ${data.message}`)
        if (data.code === 'INVALID_API_KEY' || data.code === 'NOT_AUTHENTICATED') {
          console.log()
          console.log(chalk.gray('Run'), chalk.cyan('struere login'), chalk.gray('to authenticate'))
        }
        break
    }
  }

  ws.onerror = () => {
    spinner.fail('WebSocket error')
    console.log(chalk.red('Connection error'))
  }

  ws.onclose = () => {
    if (isConnected) {
      spinner.stop()
      console.log(chalk.yellow('Disconnected from cloud'))
    }
  }

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)

      if (url.pathname === '/health') {
        return Response.json({
          status: 'ok',
          agent: agent.name,
          mode: 'cloud',
          cloudUrl
        })
      }

      if (url.pathname === '/api/chat' && req.method === 'POST') {
        if (!cloudUrl || !sessionId) {
          return Response.json({ error: 'Not connected to cloud' }, { status: 503 })
        }

        const body = await req.json() as { message: string; conversationId?: string; stream?: boolean }

        const response = await fetch(`${process.env.STRUERE_GATEWAY_URL || 'https://gateway.struere.dev'}/v1/dev/${sessionId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey || credentials?.token}`
          },
          body: JSON.stringify(body)
        })

        if (body.stream) {
          return new Response(response.body, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            }
          })
        }

        const responseData = await response.json()
        return Response.json(responseData)
      }

      if (url.pathname === '/' && options.channel === 'web') {
        return new Response(getDevHtml(agent.name, 'cloud', cloudUrl), {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      return new Response('Not Found', { status: 404 })
    }
  })

  if (options.channel === 'web' && options.open) {
    const openUrl = `http://localhost:${port}`
    if (process.platform === 'darwin') {
      Bun.spawn(['open', openUrl])
    } else if (process.platform === 'linux') {
      Bun.spawn(['xdg-open', openUrl])
    }
  }

  const watcher = chokidar.watch([join(cwd, 'src'), join(cwd, 'struere.config.ts')], {
    ignoreInitial: true,
    ignored: /node_modules/,
  })

  watcher.on('change', async (path) => {
    spinner.text = `Syncing (${path.replace(cwd, '.')})`
    try {
      agent = await loadAgent(cwd)
      const bundle = await bundleAgent(cwd)
      const configHash = hashString(bundle)

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'sync',
          agentId: project.agentId,
          agentSlug: project.agent.slug,
          bundle,
          configHash
        }))
      }
    } catch (error) {
      spinner.fail(`Sync failed: ${error}`)
      spinner.start('Watching for changes')
    }
  })

  process.on('SIGINT', () => {
    console.log()
    spinner.stop()
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'unsync' }))
      ws.close()
    }
    watcher.close()
    server.stop()
    console.log(chalk.gray('Server stopped'))
    process.exit(0)
  })
}

async function bundleAgent(cwd: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(cwd, 'src', 'agent.ts')],
    target: 'browser',
    minify: true
  })

  if (!result.success) {
    throw new Error('Bundle failed: ' + result.logs.join('\n'))
  }

  return await result.outputs[0].text()
}

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

function getDevHtml(agentName: string, mode: 'local' | 'cloud', cloudUrl?: string | null): string {
  const modeLabel = mode === 'cloud'
    ? `<span style="color: #22c55e;">Cloud</span>${cloudUrl ? ` - <a href="${cloudUrl}" target="_blank" style="color: #60a5fa;">${cloudUrl}</a>` : ''}`
    : '<span style="color: #eab308;">Local</span>'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${agentName} - Dev</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fafafa; height: 100vh; display: flex; flex-direction: column; }
    header { padding: 1rem; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
    header h1 { font-size: 1rem; font-weight: 500; }
    header .mode { font-size: 0.875rem; }
    header a { text-decoration: none; }
    #messages { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .message { max-width: 80%; padding: 0.75rem 1rem; border-radius: 0.75rem; line-height: 1.5; white-space: pre-wrap; }
    .message.user { align-self: flex-end; background: #2563eb; }
    .message.assistant { align-self: flex-start; background: #27272a; }
    .message.tool { align-self: flex-start; background: #1e3a5f; font-family: monospace; font-size: 0.875rem; border-left: 3px solid #3b82f6; }
    .message.streaming { opacity: 0.9; }
    form { padding: 1rem; border-top: 1px solid #333; display: flex; gap: 0.5rem; }
    input { flex: 1; padding: 0.75rem 1rem; background: #18181b; border: 1px solid #333; border-radius: 0.5rem; color: #fafafa; font-size: 1rem; outline: none; }
    input:focus { border-color: #2563eb; }
    input:disabled { opacity: 0.5; }
    button { padding: 0.75rem 1.5rem; background: #2563eb; border: none; border-radius: 0.5rem; color: white; font-size: 1rem; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .toggle-container { padding: 0.5rem 1rem; display: flex; align-items: center; gap: 0.5rem; border-top: 1px solid #333; }
    .toggle-container label { font-size: 0.875rem; color: #888; }
    .toggle-container input[type="checkbox"] { width: 1rem; height: 1rem; }
  </style>
</head>
<body>
  <header>
    <h1>${agentName}</h1>
    <span class="mode">${modeLabel}</span>
  </header>
  <div id="messages"></div>
  <div class="toggle-container">
    <input type="checkbox" id="stream-toggle" checked />
    <label for="stream-toggle">Enable streaming</label>
  </div>
  <form id="chat-form">
    <input type="text" id="input" placeholder="Type a message..." autocomplete="off" />
    <button type="submit">Send</button>
  </form>
  <script>
    const messages = document.getElementById('messages');
    const form = document.getElementById('chat-form');
    const input = document.getElementById('input');
    const button = form.querySelector('button');
    const streamToggle = document.getElementById('stream-toggle');
    let conversationId = null;
    let isProcessing = false;

    function addMessage(role, content, isStreaming = false) {
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

    async function sendWithStreaming(message) {
      const assistantDiv = addMessage('assistant', '', true);

      const response = await fetch('/api/chat', {
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

              if (data.conversationId) {
                conversationId = data.conversationId;
              }

              if (data.type === 'text-delta' && (data.textDelta || data.content)) {
                fullText += data.textDelta || data.content;
                assistantDiv.textContent = fullText;
                messages.scrollTop = messages.scrollHeight;
              } else if (data.type === 'tool-call-start') {
                addMessage('tool', 'Calling tool: ' + (data.toolName || data.toolCall?.name));
              } else if (data.type === 'tool-result') {
                const resultText = typeof data.toolResult === 'string'
                  ? data.toolResult
                  : JSON.stringify(data.toolResult || data.toolCall?.result, null, 2);
                addMessage('tool', 'Result: ' + resultText);
              } else if (data.type === 'finish') {
                assistantDiv.classList.remove('streaming');
              } else if (data.type === 'error') {
                assistantDiv.textContent = 'Error: ' + (data.error || data.message);
                assistantDiv.classList.remove('streaming');
              }
            } catch (e) {}
          }
        }
      }

      if (!fullText) {
        assistantDiv.remove();
      }
    }

    async function sendWithoutStreaming(message) {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId }),
      });
      const data = await res.json();
      conversationId = data.conversationId;

      if (data.toolCalls && data.toolCalls.length > 0) {
        for (const tc of data.toolCalls) {
          const resultText = typeof tc.result === 'string'
            ? tc.result
            : JSON.stringify(tc.result, null, 2);
          addMessage('tool', tc.name + ': ' + resultText);
        }
      }

      addMessage('assistant', data.response || data.content);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isProcessing) return;

      const message = input.value.trim();
      if (!message) return;

      addMessage('user', message);
      input.value = '';
      setProcessing(true);

      try {
        if (streamToggle.checked) {
          await sendWithStreaming(message);
        } else {
          await sendWithoutStreaming(message);
        }
      } catch (err) {
        addMessage('assistant', 'Error: ' + err.message);
      } finally {
        setProcessing(false);
      }
    });

    input.focus();
  </script>
</body>
</html>`
}
