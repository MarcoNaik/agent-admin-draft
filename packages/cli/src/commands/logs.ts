import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'

export const logsCommand = new Command('logs')
  .description('Stream production logs')
  .option('-e, --env <environment>', 'Environment to stream from', 'production')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <number>', 'Number of lines to show', '100')
  .action(async (options) => {
    const spinner = ora()

    console.log()
    console.log(chalk.bold('Streaming Logs'))
    console.log()

    const apiKey = process.env.AGENT_FACTORY_API_KEY

    if (!apiKey) {
      console.log(chalk.red('Error:'), 'Missing AGENT_FACTORY_API_KEY environment variable')
      console.log()
      console.log('Set your API key:')
      console.log(chalk.gray('  $'), chalk.cyan('export AGENT_FACTORY_API_KEY=your_api_key'))
      console.log()
      process.exit(1)
    }

    const apiUrl = process.env.AGENT_FACTORY_API_URL || 'https://api.agent-factory.dev'

    if (options.follow) {
      spinner.start(`Connecting to ${options.env} logs`)

      try {
        const wsUrl = apiUrl.replace('https://', 'wss://').replace('http://', 'ws://')
        const ws = new WebSocket(`${wsUrl}/v1/logs/stream?env=${options.env}`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        } as WebSocketInit)

        ws.onopen = () => {
          spinner.succeed(`Connected to ${options.env}`)
          console.log()
          console.log(chalk.gray('Streaming logs... (Ctrl+C to stop)'))
          console.log()
        }

        ws.onmessage = (event) => {
          const log = JSON.parse(event.data as string) as {
            level: string
            timestamp: string
            message: string
          }
          const levelColor =
            log.level === 'error'
              ? chalk.red
              : log.level === 'warn'
                ? chalk.yellow
                : chalk.gray
          console.log(
            chalk.gray(new Date(log.timestamp).toISOString()),
            levelColor(`[${log.level}]`),
            log.message
          )
        }

        ws.onerror = () => {
          spinner.fail('Connection error')
          process.exit(1)
        }

        ws.onclose = () => {
          console.log()
          console.log(chalk.gray('Connection closed'))
          process.exit(0)
        }

        process.on('SIGINT', () => {
          console.log()
          ws.close()
        })
      } catch (error) {
        spinner.fail('Failed to connect')
        console.log()
        console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
        console.log()
        process.exit(1)
      }
    } else {
      spinner.start('Fetching logs')

      try {
        const response = await fetch(
          `${apiUrl}/v1/logs?env=${options.env}&lines=${options.lines}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        )

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const logs = (await response.json()) as Array<{
          level: string
          timestamp: string
          message: string
        }>

        spinner.succeed(`Fetched ${logs.length} log entries`)
        console.log()

        for (const log of logs) {
          const levelColor =
            log.level === 'error'
              ? chalk.red
              : log.level === 'warn'
                ? chalk.yellow
                : chalk.gray
          console.log(
            chalk.gray(new Date(log.timestamp).toISOString()),
            levelColor(`[${log.level}]`),
            log.message
          )
        }

        console.log()
      } catch (error) {
        spinner.fail('Failed to fetch logs')
        console.log()
        console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
        console.log()
        process.exit(1)
      }
    }
  })

interface WebSocketInit {
  headers?: Record<string, string>
}
