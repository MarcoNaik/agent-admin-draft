import ora from 'ora'
import chalk from 'chalk'
import { getApiKey } from './credentials'

export function isInteractive(): boolean {
  return process.stdout.isTTY === true && !process.env.CI && !getApiKey()
}

export interface Output {
  start(msg: string): void
  succeed(msg: string): void
  fail(msg: string): void
  stop(): void
  info(msg: string): void
  warn(msg: string): void
  error(msg: string): void
  json(data: unknown): void
}

export function createOutput(): Output {
  if (isInteractive()) {
    const spinner = ora()
    return {
      start(msg) { spinner.start(msg) },
      succeed(msg) { spinner.succeed(msg) },
      fail(msg) { spinner.fail(msg) },
      stop() { spinner.stop() },
      info(msg) { console.log(chalk.gray(msg)) },
      warn(msg) { console.log(chalk.yellow(msg)) },
      error(msg) { console.error(chalk.red(msg)) },
      json(data) { console.log(JSON.stringify(data, null, 2)) },
    }
  }

  return {
    start(msg) { console.log(msg) },
    succeed(msg) { console.log(msg) },
    fail(msg) { console.error(msg) },
    stop() {},
    info(msg) { console.log(msg) },
    warn(msg) { console.log(msg) },
    error(msg) { console.error(msg) },
    json(data) { console.log(JSON.stringify(data)) },
  }
}

export function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Unauthenticated') ||
         message.includes('OIDC') ||
         message.includes('token') ||
         message.includes('expired')
}

export function isOrgAccessError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Access denied') ||
         message.includes('not a member') ||
         message.includes('Organization not found')
}
