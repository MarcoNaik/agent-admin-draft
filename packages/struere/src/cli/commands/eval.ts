import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { loadCredentials, getApiKey } from '../utils/credentials'
import { hasProject, loadProject } from '../utils/project'
import { performLogin } from './login'
import { syncOrganization } from '../utils/convex'
import { loadAllResources } from '../utils/loader'
import { extractSyncPayload } from '../utils/extractor'
import { runInit } from './init'
import {
  listAllSuites,
  listCases,
  startRun,
  getRun,
  getRunResults,
  type EvalResult,
  type EvalRun,
} from '../utils/evals'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

function formatScore(score: number | undefined): string {
  if (score === undefined) return '-'
  return `${score.toFixed(1)}/5`
}

function statusLabel(result: EvalResult): string {
  if (result.status === 'error') return 'ERROR'
  return result.overallPassed ? 'PASS' : 'FAIL'
}

function statusColor(status: string): (s: string) => string {
  if (status === 'PASS') return chalk.green
  if (status === 'FAIL') return chalk.red
  return chalk.yellow
}

function generateSummaryMd(
  suiteName: string,
  suiteSlug: string,
  agentSlug: string,
  run: EvalRun,
  results: EvalResult[]
): string {
  const timestamp = run.startedAt ? new Date(run.startedAt).toISOString() : new Date().toISOString()
  const duration = run.totalDurationMs ? formatDuration(run.totalDurationMs) : '-'
  const errorCount = results.filter((r) => r.status === 'error').length

  let md = `# Eval Run: ${suiteName}\n\n`
  md += `| Field | Value |\n|-------|-------|\n`
  md += `| Suite | ${suiteName} (\`${suiteSlug}\`) |\n`
  md += `| Agent | ${agentSlug} |\n`
  md += `| Timestamp | ${timestamp} |\n`
  md += `| Duration | ${duration} |\n`
  md += `| Status | ${run.status} |\n`

  md += `\n## Results\n\n`
  md += `| Case | Status | Score | Duration |\n|------|--------|-------|----------|\n`
  for (const r of results) {
    const label = statusLabel(r)
    const score = formatScore(r.overallScore)
    const dur = r.totalDurationMs ? formatDuration(r.totalDurationMs) : '-'
    md += `| ${r.caseName} | ${label} | ${score} | ${dur} |\n`
  }

  const passed = results.filter((r) => r.overallPassed).length
  const failed = results.filter((r) => !r.overallPassed && r.status !== 'error').length

  md += `\n## Totals\n\n`
  md += `| Metric | Value |\n|--------|-------|\n`
  md += `| Passed | ${passed} |\n`
  md += `| Failed | ${failed} |\n`
  md += `| Errors | ${errorCount} |\n`
  md += `| Overall score | ${formatScore(run.overallScore)} |\n`
  md += `| Agent tokens | ${run.totalTokens?.agent ?? 0} |\n`
  md += `| Judge tokens | ${run.totalTokens?.judge ?? 0} |\n`

  return md
}

function generateCaseMd(result: EvalResult): string {
  const label = statusLabel(result)
  const score = formatScore(result.overallScore)
  const dur = result.totalDurationMs ? formatDuration(result.totalDurationMs) : '-'

  let md = `# ${result.caseName}\n\n`
  md += `| Field | Value |\n|-------|-------|\n`
  md += `| Status | ${label} |\n`
  md += `| Score | ${score} |\n`
  md += `| Duration | ${dur} |\n`

  if (result.status === 'error') {
    md += `\n## Error\n\n${result.errorMessage || 'Unknown error'}\n`
    return md
  }

  if (result.turnResults) {
    for (const turn of result.turnResults) {
      md += `\n## Turn ${turn.turnIndex + 1}\n`

      md += `\n### User\n${turn.userMessage}\n`
      md += `\n### Assistant\n${turn.assistantResponse}\n`

      if (turn.toolCalls && turn.toolCalls.length > 0) {
        md += `\n### Tool Calls\n`
        for (const tc of turn.toolCalls) {
          md += `**${tc.name}**\n`
          md += '```json\n' + JSON.stringify(tc.arguments, null, 2) + '\n```\n'
          if (tc.result !== undefined) {
            md += 'Result:\n```json\n' + JSON.stringify(tc.result, null, 2) + '\n```\n'
          }
        }
      }

      if (turn.assertionResults && turn.assertionResults.length > 0) {
        md += `\n### Assertions\n\n`
        md += `| Type | Result | Details |\n|------|--------|--------|\n`
        for (const a of turn.assertionResults) {
          const aLabel = a.passed ? 'PASS' : 'FAIL'
          const scoreStr = a.score !== undefined ? ` (${a.score}/5)` : ''
          md += `| ${a.type} | ${aLabel}${scoreStr} | ${a.reason || ''} |\n`
        }
      }
    }
  }

  if (result.finalAssertionResults && result.finalAssertionResults.length > 0) {
    md += `\n## Final Assertions\n\n`
    md += `| Type | Result | Details |\n|------|--------|--------|\n`
    for (const a of result.finalAssertionResults) {
      const aLabel = a.passed ? 'PASS' : 'FAIL'
      const scoreStr = a.score !== undefined ? ` (${a.score}/5)` : ''
      md += `| ${a.type} | ${aLabel}${scoreStr} | ${a.reason || ''} |\n`
    }
  }

  return md
}

const runCommand = new Command('run')
  .description('Run an eval suite')
  .argument('<suite-slug>', 'Eval suite slug to run')
  .option('--case <name...>', 'Run specific case(s) by name')
  .option('--tag <tag...>', 'Run cases matching tag(s)')
  .option('--timeout <seconds>', 'Max seconds to wait for results (default: 300)')
  .action(async (suiteSlug: string, options: { case?: string[]; tag?: string[]; timeout?: string }) => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Struere Eval Run'))
    console.log()

    if (!hasProject(cwd)) {
      console.log(chalk.yellow('No struere.json found - initializing project...'))
      console.log()
      await runInit(cwd)
      console.log()
    }

    const project = loadProject(cwd)
    if (!project) {
      console.log(chalk.red('Failed to load struere.json'))
      process.exit(1)
    }

    let credentials = loadCredentials()
    const apiKey = getApiKey()

    if (!credentials && !apiKey) {
      console.log(chalk.yellow('Not logged in - authenticating...'))
      console.log()
      credentials = await performLogin()
      if (!credentials) {
        console.log(chalk.red('Authentication failed'))
        process.exit(1)
      }
      console.log()
    }

    console.log(chalk.gray('Organization:'), chalk.cyan(project.organization.name))

    spinner.start('Syncing to eval environment')
    try {
      const resources = await loadAllResources(cwd)
      if (resources.errors.length > 0) {
        spinner.fail('Failed to load resources')
        for (const err of resources.errors) {
          console.log(chalk.red('  ✖'), err)
        }
        process.exit(1)
      }

      const payload = extractSyncPayload(resources)
      const result = await syncOrganization({
        agents: payload.agents,
        entityTypes: payload.entityTypes,
        roles: payload.roles,
        evalSuites: payload.evalSuites,
        fixtures: payload.fixtures,
        organizationId: project.organization.id,
        environment: 'eval',
      })

      if (!result.success) {
        throw new Error(result.error || 'Sync failed')
      }

      spinner.succeed('Synced to eval environment')
    } catch (error) {
      spinner.fail('Sync failed')
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

    spinner.start('Resolving suite')
    let suites
    try {
      suites = await listAllSuites('eval')
    } catch (error) {
      spinner.fail('Failed to list suites')
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

    const suite = suites.find((s) => s.slug === suiteSlug)
    if (!suite) {
      spinner.fail(`Suite "${suiteSlug}" not found`)
      if (suites.length > 0) {
        console.log(chalk.gray('  Available suites:'))
        for (const s of suites) {
          console.log(chalk.gray(`    - ${s.slug}`), chalk.dim(`(${s.name})`))
        }
      } else {
        console.log(chalk.gray('  No eval suites found. Create one in evals/*.eval.yaml'))
      }
      process.exit(1)
    }

    console.log(chalk.gray('Suite:'), chalk.cyan(`${suite.name} (${suite.slug})`))
    console.log()

    let cases
    try {
      cases = await listCases(suite._id)
    } catch (error) {
      spinner.fail('Failed to list cases')
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

    let filteredCaseIds: string[] | undefined

    if (options.case && options.case.length > 0) {
      const patterns = options.case.map((n) => n.toLowerCase())
      const matched = cases.filter((c) => {
        const name = c.name.toLowerCase()
        return patterns.some((p) => name.includes(p))
      })
      if (matched.length === 0) {
        spinner.fail('No cases matched')
        console.log(chalk.gray('  Available cases:'))
        for (const c of cases) {
          console.log(chalk.gray(`    - "${c.name}"`))
        }
        process.exit(1)
      }
      filteredCaseIds = matched.map((c) => c._id)
      spinner.succeed(`Suite resolved (${matched.length}/${cases.length} cases matched by name)`)
    } else if (options.tag && options.tag.length > 0) {
      const tagSet = new Set(options.tag.map((t) => t.toLowerCase()))
      const matched = cases.filter((c) =>
        c.tags?.some((t) => tagSet.has(t.toLowerCase()))
      )
      if (matched.length === 0) {
        spinner.fail('No cases matched tags')
        const allTags = new Set(cases.flatMap((c) => c.tags || []))
        if (allTags.size > 0) {
          console.log(chalk.gray('  Available tags:'))
          for (const t of allTags) {
            console.log(chalk.gray(`    - "${t}"`))
          }
        }
        process.exit(1)
      }
      filteredCaseIds = matched.map((c) => c._id)
      spinner.succeed(`Suite resolved (${matched.length}/${cases.length} cases matched by tag)`)
    } else {
      spinner.succeed(`Suite resolved (${cases.length} cases)`)
    }

    let runId: string
    try {
      runId = await startRun(suite._id, filteredCaseIds)
    } catch (error) {
      console.log(chalk.red('Failed to start run:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

    console.log(chalk.gray('Run ID:'), chalk.cyan(runId))

    const timeoutMs = (options.timeout ? parseInt(options.timeout, 10) : 300) * 1000
    const startTime = Date.now()

    spinner.start('Running...')
    let run: EvalRun | null = null
    while (true) {
      await new Promise((r) => setTimeout(r, 3000))
      run = await getRun(runId)
      if (!run) {
        spinner.fail('Run not found')
        process.exit(1)
      }

      if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
        break
      }

      if (Date.now() - startTime > timeoutMs) {
        spinner.fail(`Timed out after ${options.timeout || 300}s — run is still in progress`)
        console.log(chalk.gray('Run ID:'), chalk.cyan(runId))
        process.exit(2)
      }

      spinner.text = `Running: ${run.completedCases}/${run.totalCases} cases (${run.passedCases} passed, ${run.failedCases} failed)`
    }

    const duration = run.totalDurationMs ? formatDuration(run.totalDurationMs) : '-'
    if (run.status === 'completed') {
      spinner.succeed(`Run completed in ${duration}`)
    } else {
      spinner.fail(`Run ${run.status}`)
    }

    const results = await getRunResults(runId)
    results.sort((a, b) => {
      const caseA = cases.find((c) => c._id === a.caseId)
      const caseB = cases.find((c) => c._id === b.caseId)
      return (caseA?.order ?? 0) - (caseB?.order ?? 0)
    })

    console.log()
    console.log(chalk.bold('Results:'))
    for (const r of results) {
      const label = statusLabel(r)
      const color = statusColor(label)
      const score = r.overallScore !== undefined ? `${r.overallScore.toFixed(1)}/5` : '-'
      const dur = r.totalDurationMs ? formatDuration(r.totalDurationMs) : '-'
      console.log(
        `  ${color(label.padEnd(5))} ${r.caseName.padEnd(35)} ${score.padStart(7)}  ${dur.padStart(6)}`
      )
    }

    const passed = results.filter((r) => r.overallPassed).length
    const failed = results.filter((r) => !r.overallPassed && r.status !== 'error').length
    const errors = results.filter((r) => r.status === 'error').length
    const overallScore = formatScore(run.overallScore)

    console.log()
    console.log(
      `${passed} passed, ${failed} failed, ${errors} error${errors !== 1 ? 's' : ''} | Score: ${overallScore}`
    )

    const agentSlug = suiteSlug
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '')
    const folderName = `${timestamp}_${suiteSlug}`
    const outDir = join(cwd, 'evals', 'runs', folderName)
    mkdirSync(outDir, { recursive: true })

    const summaryMd = generateSummaryMd(suite.name, suite.slug, agentSlug, run, results)
    writeFileSync(join(outDir, '_summary.md'), summaryMd)

    for (const r of results) {
      const label = statusLabel(r)
      const fileName = `${label}_${slugify(r.caseName)}.md`
      const caseMd = generateCaseMd(r)
      writeFileSync(join(outDir, fileName), caseMd)
    }

    const relativePath = `evals/runs/${folderName}/`
    console.log()
    console.log(`Results saved to ${chalk.cyan(relativePath)}`)

    const hasFailures = failed > 0 || errors > 0
    process.exit(hasFailures ? 1 : 0)
  })

export const evalCommand = new Command('eval')
  .description('Eval suite management')

evalCommand.addCommand(runCommand)
