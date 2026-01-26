import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import chokidar from 'chokidar'
import { join } from 'path'
import { loadConfig } from '../utils/config'
import { loadAgent } from '../utils/agent'
import { AgentExecutor } from '@marco-kueks/agent-factory-runtime'
import type { StreamChunk } from '@marco-kueks/agent-factory-runtime'

export const devCommand = new Command('dev')
  .description('Start development server with hot reload')
  .option('-p, --port <port>', 'Port to run on', '3000')
  .option('-c, --channel <channel>', 'Channel to open (web, api)', 'web')
  .option('--no-open', 'Do not open browser')
  .action(async (options) => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Agent Factory Dev Server'))
    console.log()

    spinner.start('Loading configuration')

    const config = await loadConfig(cwd)
    const port = parseInt(options.port) || config.port || 3000

    spinner.succeed('Configuration loaded')

    spinner.start('Loading agent')

    let agent = await loadAgent(cwd)
    let executor = new AgentExecutor(agent)

    spinner.succeed(`Agent "${agent.name}" loaded`)

    const server = Bun.serve({
      port,
      async fetch(req) {
        const url = new URL(req.url)

        if (url.pathname === '/health') {
          return Response.json({ status: 'ok', agent: agent.name })
        }

        if (url.pathname === '/api/chat' && req.method === 'POST') {
          const body = await req.json() as { message: string; conversationId?: string; stream?: boolean }
          const conversationId = body.conversationId || crypto.randomUUID()

          if (body.stream) {
            const stream = new ReadableStream({
              async start(controller) {
                const encoder = new TextEncoder()

                const sendEvent = (event: string, data: unknown) => {
                  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
                }

                sendEvent('start', { conversationId })

                for await (const chunk of executor.stream({ conversationId, message: body.message })) {
                  sendEvent(chunk.type, chunk)
                }

                controller.close()
              }
            })

            return new Response(stream, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
              }
            })
          }

          const response = await executor.execute({ conversationId, message: body.message })
          return Response.json({
            response: response.message,
            conversationId: response.conversationId,
            toolCalls: response.toolCalls,
            usage: response.usage
          })
        }

        if (url.pathname === '/' && options.channel === 'web') {
          return new Response(getDevHtml(agent.name), {
            headers: { 'Content-Type': 'text/html' },
          })
        }

        return new Response('Not Found', { status: 404 })
      },
    })

    console.log()
    console.log(chalk.green('Server running at'), chalk.cyan(`http://localhost:${port}`))
    console.log()

    if (options.channel === 'web' && options.open) {
      const openUrl = `http://localhost:${port}`
      if (process.platform === 'darwin') {
        Bun.spawn(['open', openUrl])
      } else if (process.platform === 'linux') {
        Bun.spawn(['xdg-open', openUrl])
      }
    }

    spinner.start('Watching for changes')

    const watcher = chokidar.watch([join(cwd, 'src'), join(cwd, 'af.config.ts')], {
      ignoreInitial: true,
      ignored: /node_modules/,
    })

    watcher.on('change', async (path) => {
      spinner.text = `Reloading (${path.replace(cwd, '.')})`
      try {
        agent = await loadAgent(cwd)
        executor = new AgentExecutor(agent)
        spinner.succeed(`Reloaded "${agent.name}"`)
        spinner.start('Watching for changes')
      } catch (error) {
        spinner.fail(`Reload failed: ${error}`)
        spinner.start('Watching for changes')
      }
    })

    process.on('SIGINT', () => {
      console.log()
      spinner.stop()
      watcher.close()
      server.stop()
      console.log(chalk.gray('Server stopped'))
      process.exit(0)
    })
  })

function getDevHtml(agentName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${agentName} - Dev</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fafafa; height: 100vh; display: flex; flex-direction: column; }
    header { padding: 1rem; border-bottom: 1px solid #333; }
    header h1 { font-size: 1rem; font-weight: 500; }
    header span { color: #888; font-size: 0.875rem; }
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
    <span>Development Mode</span>
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
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.conversationId) {
                conversationId = data.conversationId;
              }

              if (data.type === 'text-delta' && data.textDelta) {
                fullText += data.textDelta;
                assistantDiv.textContent = fullText;
                messages.scrollTop = messages.scrollHeight;
              } else if (data.type === 'tool-call-start') {
                addMessage('tool', '🔧 Calling tool: ' + data.toolName);
              } else if (data.type === 'tool-result') {
                const resultText = typeof data.toolResult === 'string'
                  ? data.toolResult
                  : JSON.stringify(data.toolResult, null, 2);
                addMessage('tool', '✓ ' + data.toolName + ': ' + resultText);
              } else if (data.type === 'finish') {
                assistantDiv.classList.remove('streaming');
              } else if (data.type === 'error') {
                assistantDiv.textContent = 'Error: ' + data.error;
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
          addMessage('tool', '🔧 ' + tc.name + ': ' + resultText);
        }
      }

      addMessage('assistant', data.response);
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
