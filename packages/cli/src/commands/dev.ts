import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import chokidar from 'chokidar'
import { join } from 'path'
import { loadConfig } from '../utils/config'
import { loadAgent } from '../utils/agent'

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

    spinner.succeed(`Agent "${agent.name}" loaded`)

    const server = Bun.serve({
      port,
      async fetch(req) {
        const url = new URL(req.url)

        if (url.pathname === '/health') {
          return Response.json({ status: 'ok', agent: agent.name })
        }

        if (url.pathname === '/api/chat' && req.method === 'POST') {
          const body = await req.json() as { message: string; conversationId?: string }
          return Response.json({
            response: `[Dev Mode] Received: ${body.message}`,
            conversationId: body.conversationId || crypto.randomUUID(),
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
    .message { max-width: 80%; padding: 0.75rem 1rem; border-radius: 0.75rem; line-height: 1.5; }
    .message.user { align-self: flex-end; background: #2563eb; }
    .message.assistant { align-self: flex-start; background: #27272a; }
    form { padding: 1rem; border-top: 1px solid #333; display: flex; gap: 0.5rem; }
    input { flex: 1; padding: 0.75rem 1rem; background: #18181b; border: 1px solid #333; border-radius: 0.5rem; color: #fafafa; font-size: 1rem; outline: none; }
    input:focus { border-color: #2563eb; }
    button { padding: 0.75rem 1.5rem; background: #2563eb; border: none; border-radius: 0.5rem; color: white; font-size: 1rem; cursor: pointer; }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <header>
    <h1>${agentName}</h1>
    <span>Development Mode</span>
  </header>
  <div id="messages"></div>
  <form id="chat-form">
    <input type="text" id="input" placeholder="Type a message..." autocomplete="off" />
    <button type="submit">Send</button>
  </form>
  <script>
    const messages = document.getElementById('messages');
    const form = document.getElementById('chat-form');
    const input = document.getElementById('input');
    let conversationId = null;

    function addMessage(role, content) {
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.textContent = content;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = input.value.trim();
      if (!message) return;

      addMessage('user', message);
      input.value = '';

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, conversationId }),
        });
        const data = await res.json();
        conversationId = data.conversationId;
        addMessage('assistant', data.response);
      } catch (err) {
        addMessage('assistant', 'Error: ' + err.message);
      }
    });

    input.focus();
  </script>
</body>
</html>`
}
