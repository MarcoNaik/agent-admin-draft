import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { confirm } from '@inquirer/prompts'
import { loadCredentials, getApiKey, clearCredentials } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { syncOrganization, getSiteUrl, type SyncResult } from '../utils/convex'
import { loadAllResources } from '../utils/loader'
import { extractSyncPayload } from '../utils/extractor'
import { performLogin } from './login'
import { runInit } from './init'
import { checkForDeletions } from './sync'
import { isInteractive, isAuthError, isOrgAccessError } from '../utils/runtime'

export const deployCommand = new Command('deploy')
  .description('Deploy all resources to production')
  .option('--dry-run', 'Show what would be deployed without deploying')
  .option('--force', 'Skip destructive sync confirmation')
  .option('--json', 'Output results as JSON')
  .action(async (options) => {
    const spinner = ora()
    const cwd = process.cwd()
    const nonInteractive = !isInteractive()
    const shouldForce = options.force || nonInteractive
    const jsonMode = !!options.json

    if (!jsonMode) {
      console.log()
      console.log(chalk.bold('Deploying to Production'))
      console.log()
    }

    if (!hasProject(cwd)) {
      if (nonInteractive) {
        if (jsonMode) {
          console.log(JSON.stringify({ success: false, error: 'No struere.json found' }))
        } else {
          console.log(chalk.red('No struere.json found. Run struere init first.'))
        }
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

    const project = loadProject(cwd)
    if (!project) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error: 'Failed to load struere.json' }))
      } else {
        console.log(chalk.red('Failed to load struere.json'))
      }
      process.exit(1)
    }

    if (!jsonMode) {
      console.log(chalk.gray('Organization:'), chalk.cyan(project.organization.name))
      console.log(chalk.gray('Environment:'), chalk.cyan('production'))
      console.log()
    }

    let credentials = loadCredentials()
    const apiKey = getApiKey()

    if (!credentials && !apiKey) {
      if (nonInteractive) {
        if (jsonMode) {
          console.log(JSON.stringify({ success: false, error: 'Not authenticated. Set STRUERE_API_KEY or run struere login.' }))
        } else {
          console.log(chalk.red('Not authenticated. Set STRUERE_API_KEY or run struere login.'))
        }
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

    if (!jsonMode) spinner.start('Loading resources')

    let resources
    try {
      resources = await loadAllResources(cwd)
      if (!jsonMode) spinner.succeed(`Loaded ${resources.agents.length} agents, ${resources.entityTypes.length} entity types, ${resources.roles.length} roles, ${resources.customTools.length} custom tools, ${resources.evalSuites.length} eval suites`)

      for (const err of resources.errors) {
        if (!jsonMode) console.log(chalk.red('  ✖'), err)
      }

      if (resources.errors.length > 0) {
        if (jsonMode) {
          console.log(JSON.stringify({ success: false, error: `${resources.errors.length} resource loading error(s)`, errors: resources.errors }))
        }
        process.exit(1)
      }
    } catch (error) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }))
      } else {
        spinner.fail('Failed to load resources')
        console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      }
      process.exit(1)
    }

    if (resources.agents.length === 0) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: false, error: 'No agents found to deploy' }))
      } else {
        console.log()
        console.log(chalk.yellow('No agents found to deploy'))
        console.log()
        console.log(chalk.gray('Run'), chalk.cyan('struere add agent my-agent'), chalk.gray('to create an agent'))
        console.log()
      }
      return
    }

    const payload = extractSyncPayload(resources)

    if (!jsonMode) spinner.start('Checking remote state')
    let deletions: Array<{ type: string; remote: number; local: number; deleted: string[] }> = []
    try {
      deletions = await checkForDeletions(resources, project.organization.id, 'production')
      if (!jsonMode) spinner.stop()
    } catch {
      if (!jsonMode) spinner.stop()
    }

    if (options.dryRun) {
      if (jsonMode) {
        console.log(JSON.stringify({
          success: true,
          dryRun: true,
          agents: resources.agents.map((a) => ({ name: a.name, slug: a.slug, version: a.version })),
          entityTypes: resources.entityTypes.map((et) => ({ name: et.name, slug: et.slug })),
          roles: resources.roles.map((r) => ({ name: r.name })),
          deletions: deletions.flatMap((d) => d.deleted.map((name) => ({ type: d.type.toLowerCase(), name }))),
        }))
        return
      }
      console.log()
      console.log(chalk.yellow('Dry run mode - no changes will be made'))
      console.log()
      console.log('Would deploy:')
      for (const agent of resources.agents) {
        console.log(chalk.gray('  -'), `${chalk.cyan(agent.name)} (${agent.slug}) v${agent.version}`)
      }
      console.log()
      console.log('Entity types:')
      for (const et of resources.entityTypes) {
        console.log(chalk.gray('  -'), chalk.cyan(et.name), `(${et.slug})`)
      }
      console.log()
      console.log('Roles:')
      for (const role of resources.roles) {
        console.log(chalk.gray('  -'), chalk.cyan(role.name))
      }
      if (resources.evalSuites.length > 0) {
        console.log()
        console.log('Eval suites:')
        for (const suite of resources.evalSuites) {
          console.log(chalk.gray('  -'), chalk.cyan(suite.suite), chalk.gray(`(${suite.cases.length} cases)`))
        }
      }
      if (deletions.length > 0) {
        console.log()
        console.log(chalk.red.bold('Would DELETE:'))
        for (const d of deletions) {
          for (const name of d.deleted) {
            console.log(chalk.red(`  - ${d.type.toLowerCase()}: ${name}`))
          }
        }
      }
      console.log()
      return
    }

    if (deletions.length > 0 && !shouldForce) {
      console.log(chalk.yellow.bold('  Warning: this deploy will DELETE production resources:'))
      console.log()
      for (const d of deletions) {
        console.log(chalk.yellow(`    ${d.type}:`.padEnd(20)), `${d.remote} remote → ${d.local} local`, chalk.red(`(${d.deleted.length} will be deleted)`))
        for (const name of d.deleted) {
          console.log(chalk.red(`      - ${name}`))
        }
      }
      console.log()

      const shouldContinue = await confirm({ message: 'Continue anyway?', default: false })
      if (!shouldContinue) {
        console.log()
        console.log(chalk.gray('Aborted.'))
        process.exit(0)
      }
      console.log()
    }

    if (!jsonMode) spinner.start('Deploying to production')

    try {
      const syncResult = await syncOrganization({
        ...payload,
        organizationId: project.organization.id,
        environment: 'production',
      })
      if (!syncResult.success) {
        throw new Error(syncResult.error || 'Deploy failed')
      }
      if (!jsonMode) spinner.succeed('Deployed to production')

      if (jsonMode) {
        console.log(JSON.stringify({
          success: true,
          environment: 'production',
          agents: {
            created: syncResult.agents?.created || [],
            updated: syncResult.agents?.updated || [],
            deleted: syncResult.agents?.deleted || [],
          },
          entityTypes: {
            created: syncResult.entityTypes?.created || [],
            updated: syncResult.entityTypes?.updated || [],
            deleted: syncResult.entityTypes?.deleted || [],
          },
          roles: {
            created: syncResult.roles?.created || [],
            updated: syncResult.roles?.updated || [],
            deleted: syncResult.roles?.deleted || [],
          },
        }))
      } else {
        console.log()
        console.log(chalk.green('Success!'), 'All resources deployed to production')
        console.log()

        if (syncResult.agents?.created && syncResult.agents.created.length > 0) {
          console.log('New agents:')
          for (const slug of syncResult.agents.created) {
            const agent = resources.agents.find((a) => a.slug === slug)
            console.log(chalk.gray('  -'), chalk.cyan(agent?.name || slug))
          }
        }

        if (syncResult.agents?.updated && syncResult.agents.updated.length > 0) {
          console.log('Updated agents:')
          for (const slug of syncResult.agents.updated) {
            const agent = resources.agents.find((a) => a.slug === slug)
            console.log(chalk.gray('  -'), chalk.cyan(agent?.name || slug))
          }
        }

        console.log()
        console.log(chalk.gray('Test your agents:'))
        console.log(chalk.gray('  $'), chalk.cyan(`curl -X POST ${getSiteUrl()}/v1/agents/<agent-slug>/chat -H "Authorization: Bearer YOUR_API_KEY" -d '{"message": "Hello"}'`))
        console.log()
      }
    } catch (error) {
      if (isAuthError(error) && !nonInteractive) {
        if (!jsonMode) spinner.fail('Session expired - re-authenticating...')
        clearCredentials()
        credentials = await performLogin()
        if (!credentials) {
          if (jsonMode) {
            console.log(JSON.stringify({ success: false, error: 'Authentication failed' }))
          } else {
            console.log(chalk.red('Authentication failed'))
          }
          process.exit(1)
        }
        if (!jsonMode) spinner.start('Deploying to production')
        try {
          const syncResult = await syncOrganization({
            ...payload,
            organizationId: project.organization.id,
            environment: 'production',
              })
          if (!syncResult.success) {
            throw new Error(syncResult.error || 'Deploy failed')
          }
          if (!jsonMode) {
            spinner.succeed('Deployed to production')
            console.log()
            console.log(chalk.green('Success!'), 'All resources deployed to production')
            console.log()
          } else {
            console.log(JSON.stringify({ success: true, environment: 'production' }))
          }
        } catch (retryError) {
          if (jsonMode) {
            console.log(JSON.stringify({ success: false, error: retryError instanceof Error ? retryError.message : String(retryError) }))
          } else {
            spinner.fail('Deployment failed')
            console.log(chalk.red('Error:'), retryError instanceof Error ? retryError.message : String(retryError))
          }
          process.exit(1)
        }
      } else if (isOrgAccessError(error)) {
        if (jsonMode) {
          console.log(JSON.stringify({ success: false, error: `Organization access denied: ${project.organization.name}` }))
        } else {
          spinner.fail('Organization access denied')
          console.log()
          console.log(chalk.red('You do not have access to organization:'), chalk.cyan(project.organization.name))
          console.log()
          console.log(chalk.gray('To fix this:'))
          console.log(chalk.gray('  1.'), 'Check that you have access to this organization')
          console.log(chalk.gray('  2.'), 'Or run', chalk.cyan('struere init'), 'to select a different organization')
          console.log()
        }
        process.exit(1)
      } else {
        if (jsonMode) {
          console.log(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }))
        } else {
          spinner.fail('Deployment failed')
          console.log()
          console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
          console.log()
        }
        process.exit(1)
      }
    }
  })
