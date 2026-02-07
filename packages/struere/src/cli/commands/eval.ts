import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { join } from 'path'
import { readdir, readFile } from 'fs/promises'
import YAML from 'yaml'
import { hasProject, loadProject } from '../utils/project'
import { syncEvalSuites, startEvalRun, pollEvalRun, getEvalRunResults } from '../utils/convex'
import type { EvalSuiteDefinition, EvalRunStatus, EvalResultSummary } from '../../types'

export const evalCommand = new Command('eval')
  .description('Run agent evaluations with LLM judge support')
  .option('-s, --suite <name>', 'Run a specific suite by name')
  .option('-v, --verbose', 'Show detailed output including judge reasoning')
  .option('--dry-run', 'Parse eval files without executing')
  .option('--json', 'Output results as JSON')
  .option('--no-sync', 'Skip syncing eval files to Convex')
  .action(async (options) => {
    const spinner = ora()
    const cwd = process.cwd()

    if (!options.json) {
      console.log()
      console.log(chalk.bold('Running Evaluations'))
      console.log()
    }

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

    spinner.start('Finding eval files')

    const evalsDir = join(cwd, 'evals')
    let evalFiles: string[] = []

    try {
      const files = await readdir(evalsDir)
      evalFiles = files.filter((f) => f.endsWith('.eval.yaml') || f.endsWith('.eval.yml'))
    } catch {
      spinner.warn('No evals directory found')
      console.log()
      console.log(chalk.gray('Create eval files in'), chalk.cyan('evals/*.eval.yaml'))
      console.log()
      return
    }

    if (evalFiles.length === 0) {
      spinner.warn('No eval files found')
      console.log()
      return
    }

    spinner.succeed(`Found ${evalFiles.length} eval file(s)`)

    const suites: EvalSuiteDefinition[] = []
    for (const file of evalFiles) {
      const filePath = join(evalsDir, file)
      const content = await readFile(filePath, 'utf-8')
      const parsed = YAML.parse(content) as EvalSuiteDefinition
      suites.push(parsed)
    }

    if (options.suite) {
      const filtered = suites.filter((s) =>
        s.suite.toLowerCase() === options.suite.toLowerCase() ||
        s.slug === options.suite
      )
      if (filtered.length === 0) {
        console.log(chalk.red(`Suite "${options.suite}" not found`))
        process.exit(1)
      }
      suites.length = 0
      suites.push(...filtered)
    }

    if (options.dryRun) {
      console.log()
      console.log(chalk.yellow('Dry run mode — parsed successfully'))
      console.log()
      for (const suite of suites) {
        console.log(chalk.cyan(`  ${suite.suite}`), chalk.gray(`(${suite.cases.length} cases)`))
        for (const c of suite.cases) {
          const assertionCount = (c.turns || []).reduce((sum, t) => sum + (t.assertions?.length || 0), 0) + (c.finalAssertions?.length || 0)
          console.log(chalk.gray(`    - ${c.name}`), chalk.gray(`(${c.turns.length} turns, ${assertionCount} assertions)`))
        }
      }
      console.log()
      return
    }

    if (options.sync !== false) {
      spinner.start('Syncing eval suites to Convex')
      const syncResult = await syncEvalSuites(suites)
      if (syncResult.error) {
        spinner.fail(`Sync failed: ${syncResult.error}`)
        process.exit(1)
      }
      spinner.succeed('Eval suites synced')
    }

    const allResults: Array<{ suite: string; run: EvalRunStatus; results: EvalResultSummary[] }> = []

    for (const suite of suites) {
      if (!options.json) {
        console.log()
        console.log(chalk.bold(`  ${suite.suite}`), chalk.gray(`(${suite.cases.length} cases)`))
      }

      spinner.start(`Starting run for "${suite.suite}"`)

      const { runId, suiteId, error: startError } = await startEvalRun(suite.slug)
      if (startError || !runId) {
        spinner.fail(`Failed to start: ${startError}`)
        continue
      }
      spinner.succeed(`Run started`)

      spinner.start('Executing cases...')

      const { run, error: pollError } = await pollEvalRun(runId, (status) => {
        spinner.text = `Executing cases... ${status.completedCases}/${status.totalCases}`
      })

      if (pollError || !run) {
        spinner.fail(`Run failed: ${pollError}`)
        continue
      }

      spinner.succeed(`Run completed: ${run.passedCases}/${run.totalCases} passed`)

      const { results, error: resultsError } = await getEvalRunResults(runId)
      if (resultsError) {
        console.log(chalk.red(`  Failed to get results: ${resultsError}`))
        continue
      }

      allResults.push({ suite: suite.suite, run, results: results || [] })

      if (!options.json) {
        for (let ri = 0; ri < (results || []).length; ri++) {
          const result = results![ri]
          const caseName = ri < suite.cases.length ? suite.cases[ri].name : result.caseId

          if (result.overallPassed) {
            console.log(chalk.green('    ✓'), caseName, result.overallScore !== undefined ? chalk.gray(`(${result.overallScore.toFixed(1)}/5)`) : '')
          } else {
            console.log(chalk.red('    ✗'), caseName, result.overallScore !== undefined ? chalk.gray(`(${result.overallScore.toFixed(1)}/5)`) : '')

            if (result.errorMessage) {
              console.log(chalk.red('      Error:'), result.errorMessage)
            }

            if (options.verbose && result.turnResults) {
              for (const turn of result.turnResults) {
                if (turn.assertionResults) {
                  for (const ar of turn.assertionResults) {
                    if (!ar.passed) {
                      console.log(chalk.red(`      [${ar.type}]`), ar.reason || '')
                      if (ar.criteria) {
                        console.log(chalk.gray(`        Criteria: ${ar.criteria}`))
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (options.json) {
      console.log(JSON.stringify(allResults, null, 2))
      const anyFailed = allResults.some((r) => r.run.failedCases > 0)
      process.exit(anyFailed ? 1 : 0)
      return
    }

    const totalPassed = allResults.reduce((sum, r) => sum + r.run.passedCases, 0)
    const totalCases = allResults.reduce((sum, r) => sum + r.run.totalCases, 0)
    const totalFailed = allResults.reduce((sum, r) => sum + r.run.failedCases, 0)

    console.log()
    if (totalFailed === 0) {
      console.log(chalk.green('All evaluations passed!'), chalk.gray(`(${totalPassed}/${totalCases})`))
    } else {
      console.log(chalk.red('Evaluations failed:'), chalk.gray(`${totalPassed}/${totalCases} passed`))
    }

    const totalTokens = allResults.reduce((sum, r) => {
      if (r.run.totalTokens) return sum + r.run.totalTokens.agent + r.run.totalTokens.judge
      return sum
    }, 0)
    if (totalTokens > 0) {
      console.log(chalk.gray(`  Total tokens used: ${totalTokens.toLocaleString()}`))
    }
    console.log()

    if (totalFailed > 0) {
      process.exit(1)
    }
  })
