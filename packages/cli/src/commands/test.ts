import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { join } from 'path'
import { readdir, readFile } from 'fs/promises'
import YAML from 'yaml'
import { loadAgent } from '../utils/agent'
import { AgentExecutor } from '@struere/runtime'
import type { AgentConfig, TestAssertion } from '@struere/core'
import type { ToolCallResult } from '@struere/runtime'

interface TestFile {
  name: string
  description?: string
  conversation: Array<{
    role: 'user' | 'assistant'
    content: string
    assertions?: TestAssertion[]
  }>
  assertions?: TestAssertion[]
}

interface TestResult {
  name: string
  passed: boolean
  errors: string[]
}

interface ExecutionContext {
  lastResponse: string
  toolCalls: ToolCallResult[]
  state: Record<string, unknown>
}

export const testCommand = new Command('test')
  .description('Run test conversations')
  .argument('[pattern]', 'Test file pattern', '*.test.yaml')
  .option('-v, --verbose', 'Show detailed output')
  .option('--dry-run', 'Parse tests without executing (no API calls)')
  .action(async (pattern, options) => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Running Tests'))
    console.log()

    spinner.start('Loading agent')
    const agent = await loadAgent(cwd)
    spinner.succeed(`Agent "${agent.name}" loaded`)

    spinner.start('Finding test files')

    const testsDir = join(cwd, 'tests')
    let testFiles: string[] = []

    try {
      const files = await readdir(testsDir)
      testFiles = files.filter((f) => f.endsWith('.test.yaml') || f.endsWith('.test.yml'))
    } catch {
      spinner.warn('No tests directory found')
      console.log()
      console.log(chalk.gray('Create tests in'), chalk.cyan('tests/*.test.yaml'))
      console.log()
      return
    }

    if (testFiles.length === 0) {
      spinner.warn('No test files found')
      console.log()
      return
    }

    spinner.succeed(`Found ${testFiles.length} test file(s)`)

    if (options.dryRun) {
      console.log()
      console.log(chalk.yellow('Dry run mode - skipping execution'))
      console.log()
    }

    const results: TestResult[] = []

    for (const file of testFiles) {
      const filePath = join(testsDir, file)
      const content = await readFile(filePath, 'utf-8')
      const testCase = YAML.parse(content) as TestFile

      if (options.verbose) {
        console.log()
        console.log(chalk.gray('Running:'), testCase.name)
      }

      const result = options.dryRun
        ? await runDryTest(testCase)
        : await runTest(testCase, agent, options.verbose)
      results.push(result)

      if (result.passed) {
        console.log(chalk.green('  ✓'), result.name)
      } else {
        console.log(chalk.red('  ✗'), result.name)
        for (const error of result.errors) {
          console.log(chalk.red('    →'), error)
        }
      }
    }

    const passed = results.filter((r) => r.passed).length
    const failed = results.filter((r) => !r.passed).length

    console.log()
    if (failed === 0) {
      console.log(chalk.green('All tests passed!'), chalk.gray(`(${passed}/${results.length})`))
    } else {
      console.log(chalk.red('Tests failed:'), chalk.gray(`${passed}/${results.length} passed`))
    }
    console.log()

    if (failed > 0) {
      process.exit(1)
    }
  })

async function runDryTest(testCase: TestFile): Promise<TestResult> {
  return {
    name: testCase.name,
    passed: true,
    errors: [],
  }
}

async function runTest(
  testCase: TestFile,
  agent: AgentConfig,
  verbose: boolean
): Promise<TestResult> {
  const errors: string[] = []
  const executor = new AgentExecutor(agent)
  const conversationId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const context: ExecutionContext = {
    lastResponse: '',
    toolCalls: [],
    state: {},
  }

  try {
    for (const message of testCase.conversation || []) {
      if (message.role === 'user') {
        if (verbose) {
          console.log(chalk.cyan('    User:'), message.content.slice(0, 50) + (message.content.length > 50 ? '...' : ''))
        }

        const result = await executor.execute({
          conversationId,
          message: message.content,
        })

        context.lastResponse = result.message
        context.toolCalls = result.toolCalls || []

        if (verbose) {
          console.log(chalk.green('    Assistant:'), result.message.slice(0, 50) + (result.message.length > 50 ? '...' : ''))
          if (result.toolCalls && result.toolCalls.length > 0) {
            console.log(chalk.yellow('    Tools:'), result.toolCalls.map((t) => t.name).join(', '))
          }
        }
      }

      if (message.assertions) {
        for (const assertion of message.assertions) {
          const passed = checkAssertion(assertion, context)
          if (!passed) {
            errors.push(formatAssertionError(assertion, context))
          }
        }
      }
    }

    if (testCase.assertions) {
      for (const assertion of testCase.assertions) {
        const passed = checkAssertion(assertion, context)
        if (!passed) {
          errors.push(formatAssertionError(assertion, context))
        }
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    errors.push(`Execution error: ${errorMsg}`)
  }

  return {
    name: testCase.name,
    passed: errors.length === 0,
    errors,
  }
}

function checkAssertion(assertion: TestAssertion, context: ExecutionContext): boolean {
  switch (assertion.type) {
    case 'contains':
      return typeof assertion.value === 'string' && context.lastResponse.toLowerCase().includes(assertion.value.toLowerCase())

    case 'matches':
      return typeof assertion.value === 'string' && new RegExp(assertion.value, 'i').test(context.lastResponse)

    case 'toolCalled':
      if (typeof assertion.value === 'string') {
        return context.toolCalls.some((tc) => tc.name === assertion.value)
      }
      return false

    case 'stateEquals':
      if (typeof assertion.value === 'object' && assertion.value !== null) {
        for (const [key, expected] of Object.entries(assertion.value)) {
          if (context.state[key] !== expected) {
            return false
          }
        }
        return true
      }
      return false

    default:
      return false
  }
}

function formatAssertionError(assertion: TestAssertion, context: ExecutionContext): string {
  switch (assertion.type) {
    case 'contains':
      return `Expected response to contain "${assertion.value}", got: "${context.lastResponse.slice(0, 100)}..."`

    case 'matches':
      return `Expected response to match /${assertion.value}/, got: "${context.lastResponse.slice(0, 100)}..."`

    case 'toolCalled':
      const calledTools = context.toolCalls.map((tc) => tc.name).join(', ') || 'none'
      return `Expected tool "${assertion.value}" to be called, called: [${calledTools}]`

    case 'stateEquals':
      return `State mismatch: expected ${JSON.stringify(assertion.value)}, got ${JSON.stringify(context.state)}`

    default:
      return `Assertion failed: ${assertion.type} - ${JSON.stringify(assertion.value)}`
  }
}
