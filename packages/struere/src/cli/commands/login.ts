import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { getUserInfo } from '../utils/convex'
import { saveCredentials, loadCredentials, Credentials } from '../utils/credentials'

const AUTH_CALLBACK_PORT = 9876

export const loginCommand = new Command('login')
  .description('Log in to Struere')
  .action(async () => {
    const spinner = ora()

    console.log()
    console.log(chalk.bold('Struere Login'))
    console.log()

    const existing = loadCredentials()
    if (existing) {
      console.log(chalk.yellow('Already logged in as'), chalk.cyan(existing.user.email))
      console.log(chalk.gray('Run'), chalk.cyan('struere logout'), chalk.gray('to log out first'))
      console.log()
      return
    }

    await browserLogin(spinner)
  })

export async function performLogin(): Promise<Credentials | null> {
  const spinner = ora()

  console.log()
  console.log(chalk.bold('Struere Login'))
  console.log()

  return browserLoginInternal(spinner)
}

async function browserLogin(spinner: ReturnType<typeof ora>) {
  const result = await browserLoginInternal(spinner)
  if (result) {
    printNextSteps()
  }
}

async function browserLoginInternal(spinner: ReturnType<typeof ora>): Promise<Credentials | null> {
  spinner.start('Starting authentication server')

  const authPromise = new Promise<{ token: string; sessionId: string }>((resolve, reject) => {
    const server = Bun.serve({
      port: AUTH_CALLBACK_PORT,
      async fetch(req) {
        const url = new URL(req.url)

        if (url.pathname === '/callback') {
          const token = url.searchParams.get('token')
          const sessionId = url.searchParams.get('session_id')

          if (token && sessionId) {
            resolve({ token, sessionId })

            setTimeout(() => server.stop(), 1000)

            return new Response(getSuccessHtml(), {
              headers: { 'Content-Type': 'text/html' }
            })
          }

          return new Response(getErrorHtml('Missing token'), {
            status: 400,
            headers: { 'Content-Type': 'text/html' }
          })
        }

        if (url.pathname === '/') {
          const authUrl = getAuthUrl()
          return Response.redirect(authUrl, 302)
        }

        return new Response('Not Found', { status: 404 })
      }
    })

    setTimeout(() => {
      server.stop()
      reject(new Error('Authentication timed out'))
    }, 5 * 60 * 1000)
  })

  spinner.succeed('Authentication server started')

  const loginUrl = `http://localhost:${AUTH_CALLBACK_PORT}`

  console.log()
  console.log(chalk.gray('Opening browser to log in...'))
  console.log(chalk.gray('If browser does not open, visit:'), chalk.cyan(loginUrl))
  console.log()

  if (process.platform === 'darwin') {
    Bun.spawn(['open', loginUrl])
  } else if (process.platform === 'linux') {
    Bun.spawn(['xdg-open', loginUrl])
  } else if (process.platform === 'win32') {
    Bun.spawn(['cmd', '/c', 'start', loginUrl])
  }

  spinner.start('Waiting for authentication')

  try {
    const { token } = await authPromise

    spinner.text = 'Fetching user info'

    const { userInfo, error } = await getUserInfo(token)

    if (error || !userInfo) {
      throw new Error(error || 'Failed to fetch user info')
    }

    const { user, organization } = userInfo

    const credentials: Credentials = {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email,
        organizationId: user.organizationId
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    saveCredentials(credentials)

    spinner.succeed('Logged in successfully')

    console.log()
    console.log(chalk.green('Welcome,'), chalk.cyan(user.name || user.email))
    console.log(chalk.gray('Organization:'), organization.name)
    console.log()

    return credentials
  } catch (error) {
    spinner.fail('Login failed')
    console.log()
    console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
    console.log()
    return null
  }
}

function printNextSteps() {
  console.log(chalk.gray('You can now use:'))
  console.log(chalk.gray('  •'), chalk.cyan('struere dev'), chalk.gray('- Start cloud-connected dev server'))
  console.log(chalk.gray('  •'), chalk.cyan('struere deploy'), chalk.gray('- Deploy your agent'))
  console.log(chalk.gray('  •'), chalk.cyan('struere logs'), chalk.gray('- View agent logs'))
  console.log()
}

function getAuthUrl(): string {
  const baseUrl = process.env.STRUERE_AUTH_URL || 'https://app.struere.dev'
  const callbackUrl = `http://localhost:${AUTH_CALLBACK_PORT}/callback`
  return `${baseUrl}/authorize?callback=${encodeURIComponent(callbackUrl)}`
}

function getSuccessHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Login Successful</title>
  <style>
    body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
    .container { text-align: center; }
    h1 { color: #22c55e; }
    p { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Login Successful</h1>
    <p>You can close this window and return to the terminal.</p>
  </div>
  <script>setTimeout(() => window.close(), 3000)</script>
</body>
</html>`
}

function getErrorHtml(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Login Failed</title>
  <style>
    body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
    .container { text-align: center; }
    h1 { color: #ef4444; }
    p { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Login Failed</h1>
    <p>${message}</p>
  </div>
</body>
</html>`
}
