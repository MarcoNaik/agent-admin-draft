import { Command } from 'commander'
import chalk from 'chalk'
import { confirm } from '@inquirer/prompts'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { hasProject } from '../utils/project'
import { performLogin } from './login'
import { runInit } from './init'
import { isInteractive, createOutput } from '../utils/runtime'
import {
  getIntegrationConfig,
  updateIntegrationConfig,
  testIntegrationConnection,
  deleteIntegrationConfig,
  listIntegrationConfigs,
  setIntegrationStatus,
} from '../utils/integrations'
import { renderTable } from '../utils/table'

type Environment = 'development' | 'production'

const VALID_PROVIDERS = ['airtable', 'resend', 'flow'] as const

async function ensureAuth(): Promise<boolean> {
  const cwd = process.cwd()
  const nonInteractive = !isInteractive()

  if (!hasProject(cwd)) {
    if (nonInteractive) {
      console.error(chalk.red('No struere.json found. Run struere init first.'))
      process.exit(1)
    }
    console.log(chalk.yellow('No struere.json found - initializing project...'))
    console.log()
    const success = await runInit(cwd)
    if (!success) {
      process.exit(1)
    }
    console.log()
  }

  let credentials = loadCredentials()
  const apiKey = getApiKey()

  if (!credentials && !apiKey) {
    if (nonInteractive) {
      console.error(chalk.red('Not authenticated. Set STRUERE_API_KEY or run struere login.'))
      process.exit(1)
    }
    console.log(chalk.yellow('Not logged in - authenticating...'))
    console.log()
    credentials = await performLogin()
    if (!credentials) {
      console.log(chalk.red('Authentication failed'))
      process.exit(1)
    }
    console.log()
  }

  return true
}

function statusColor(status: string): string {
  switch (status) {
    case 'active': return chalk.green(status)
    case 'inactive': return chalk.yellow(status)
    case 'error': return chalk.red(status)
    default: return chalk.gray(status)
  }
}

function getProviderHelp(provider: string): string {
  switch (provider) {
    case 'airtable':
      return `Usage: struere integration airtable --token <pat> [--base-id <id>] [--test]`
    case 'resend':
      return `Usage: struere integration resend --from-email <email> [--from-name <name>] [--reply-to <email>]`
    case 'flow':
      return `Usage: struere integration flow --api-url <url> --api-key <key> --secret-key <secret> [--return-url <url>]`
    default:
      return ''
  }
}

function buildConfigFromOpts(provider: string, opts: Record<string, unknown>): Record<string, unknown> | null {
  if (provider === 'airtable') {
    const config: Record<string, unknown> = {}
    if (opts.token) config.personalAccessToken = opts.token
    if (opts.baseId) config.defaultBaseId = opts.baseId
    if (Object.keys(config).length === 0) return null
    return config
  }

  if (provider === 'resend') {
    const config: Record<string, unknown> = {}
    if (opts.fromEmail) config.fromEmail = opts.fromEmail
    if (opts.fromName) config.fromName = opts.fromName
    if (opts.replyTo) config.replyTo = opts.replyTo
    if (Object.keys(config).length === 0) return null
    return config
  }

  if (provider === 'flow') {
    const config: Record<string, unknown> = {}
    if (opts.apiUrl) config.apiUrl = opts.apiUrl
    if (opts.apiKey) config.apiKey = opts.apiKey
    if (opts.secretKey) config.secretKey = opts.secretKey
    if (opts.returnUrl) config.returnUrl = opts.returnUrl
    if (Object.keys(config).length === 0) return null
    return config
  }

  return null
}

export const integrationCommand = new Command('integration')
  .description('Manage integrations')
  .argument('[provider]', 'Integration provider (airtable, resend, flow)')
  .option('--env <environment>', 'Environment (development|production)', 'development')
  .option('--token <pat>', 'Personal access token (airtable)')
  .option('--base-id <id>', 'Default base ID (airtable)')
  .option('--from-email <email>', 'From email address (resend)')
  .option('--from-name <name>', 'From display name (resend)')
  .option('--reply-to <email>', 'Reply-to address (resend)')
  .option('--api-url <url>', 'API URL (flow)')
  .option('--api-key <key>', 'API key (flow)')
  .option('--secret-key <secret>', 'Secret key (flow)')
  .option('--return-url <url>', 'Return URL after payment (flow)')
  .option('--test', 'Test the connection after saving')
  .option('--remove', 'Remove integration config')
  .option('--enable', 'Enable integration')
  .option('--disable', 'Disable integration')
  .option('--status', 'Show current config status')
  .option('--yes', 'Skip confirmation prompts')
  .option('--json', 'Output raw JSON')
  .action(async (provider, opts) => {
    await ensureAuth()
    const env = opts.env as Environment
    const out = createOutput()

    if (!provider || provider === 'list') {
      out.start('Fetching integrations')
      const { data, error } = await listIntegrationConfigs(env)

      if (error) {
        out.fail('Failed to fetch integrations')
        out.error(error)
        process.exit(1)
      }

      const configs = (data ?? []) as Array<Record<string, unknown>>
      out.succeed(`Found ${configs.length} integration${configs.length !== 1 ? 's' : ''}`)

      if (opts.json) {
        console.log(JSON.stringify(configs, null, 2))
        return
      }

      console.log()

      if (configs.length === 0) {
        console.log(chalk.gray('  No integrations configured'))
        console.log()
        console.log(`  ${chalk.gray('Available:')} ${VALID_PROVIDERS.join(', ')}`)
        console.log(`  ${chalk.gray('Example:')}   struere integration airtable --token <pat>`)
        console.log()
        return
      }

      renderTable(
        [
          { key: 'provider', label: 'Provider', width: 16 },
          { key: 'status', label: 'Status', width: 12 },
          { key: 'lastVerified', label: 'Last Verified', width: 22 },
        ],
        configs.map((c) => ({
          provider: c.provider,
          status: statusColor(String(c.status ?? '')),
          lastVerified: c.lastVerifiedAt
            ? new Date(c.lastVerifiedAt as number).toLocaleString()
            : chalk.gray('never'),
        }))
      )
      console.log()
      return
    }

    if (!VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
      out.fail(`Unknown provider: ${provider}`)
      console.log(`  ${chalk.gray('Available:')} ${VALID_PROVIDERS.join(', ')}`)
      process.exit(1)
    }

    if (opts.remove) {
      if (!opts.yes && isInteractive()) {
        const confirmed = await confirm({
          message: `Remove ${provider} integration config? This cannot be undone.`,
          default: false,
        })
        if (!confirmed) {
          console.log(chalk.gray('Cancelled'))
          return
        }
      }

      out.start(`Removing ${provider} config`)
      const { data, error } = await deleteIntegrationConfig(provider, env)

      if (error) {
        out.fail(`Failed to remove ${provider} config`)
        out.error(error)
        process.exit(1)
      }

      const result = data as { success: boolean } | null
      if (result?.success) {
        out.succeed(`${provider} config removed`)
      } else {
        out.fail(`No ${provider} config found`)
      }
      console.log()
      return
    }

    if (opts.enable || opts.disable) {
      const newStatus = opts.enable ? 'active' as const : 'inactive' as const
      out.start(`Setting ${provider} to ${newStatus}`)
      const { data, error } = await setIntegrationStatus(provider, env, newStatus)

      if (error) {
        out.fail(`Failed to update ${provider} status`)
        out.error(error)
        process.exit(1)
      }

      const result = data as { success: boolean } | null
      if (result?.success) {
        out.succeed(`${provider} set to ${statusColor(newStatus)}`)
      } else {
        out.fail(`No ${provider} config found`)
      }
      console.log()
      return
    }

    const config = buildConfigFromOpts(provider, opts)

    if (config) {
      out.start(`Saving ${provider} config`)
      const { error } = await updateIntegrationConfig(provider, env, config)

      if (error) {
        out.fail(`Failed to save ${provider} config`)
        out.error(error)
        process.exit(1)
      }

      out.succeed(`${provider} config saved`)

      if (opts.test) {
        out.start(`Testing ${provider} connection`)
        const { data: testData, error: testError } = await testIntegrationConnection(provider, env)

        if (testError) {
          out.fail(`Connection test failed`)
          out.error(testError)
          process.exit(1)
        }

        const testResult = testData as { success: boolean; message: string }
        if (testResult.success) {
          out.succeed(testResult.message)
        } else {
          out.fail(testResult.message)
          process.exit(1)
        }
      }

      console.log()
      return
    }

    if (opts.test) {
      out.start(`Testing ${provider} connection`)
      const { data: testData, error: testError } = await testIntegrationConnection(provider, env)

      if (testError) {
        out.fail(`Connection test failed`)
        out.error(testError)
        process.exit(1)
      }

      const testResult = testData as { success: boolean; message: string }
      if (testResult.success) {
        out.succeed(testResult.message)
      } else {
        out.fail(testResult.message)
        process.exit(1)
      }
      console.log()
      return
    }

    out.start(`Fetching ${provider} config`)
    const { data: configData, error: configError } = await getIntegrationConfig(provider, env)

    if (configError) {
      out.fail(`Failed to fetch ${provider} config`)
      out.error(configError)
      process.exit(1)
    }

    if (!configData) {
      out.fail(`No ${provider} config found`)
      console.log()
      console.log(`  ${chalk.gray(getProviderHelp(provider))}`)
      console.log()
      return
    }

    out.succeed(`${provider} config loaded`)

    if (opts.json) {
      console.log(JSON.stringify(configData, null, 2))
      return
    }

    const cfg = configData as Record<string, unknown>
    const cfgData = cfg.config as Record<string, unknown> | undefined

    console.log()
    console.log(chalk.bold(`  ${provider}`))
    console.log(chalk.gray('  ' + '─'.repeat(48)))
    console.log(`  ${chalk.gray('Status:')}        ${statusColor(String(cfg.status ?? ''))}`)
    console.log(`  ${chalk.gray('Environment:')}   ${cfg.environment}`)
    console.log(`  ${chalk.gray('Last Verified:')} ${cfg.lastVerifiedAt ? new Date(cfg.lastVerifiedAt as number).toLocaleString() : chalk.gray('never')}`)
    console.log(`  ${chalk.gray('Updated:')}       ${new Date(cfg.updatedAt as number).toLocaleString()}`)

    if (cfgData && Object.keys(cfgData).length > 0) {
      console.log()
      console.log(chalk.bold('  Config'))
      console.log(chalk.gray('  ' + '─'.repeat(48)))
      const maxKeyLen = Math.max(...Object.keys(cfgData).map((k) => k.length))
      for (const [key, value] of Object.entries(cfgData)) {
        console.log(`  ${chalk.gray(key.padEnd(maxKeyLen))}  ${String(value ?? '')}`)
      }
    }
    console.log()
  })
