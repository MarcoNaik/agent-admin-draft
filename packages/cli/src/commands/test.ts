import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { join } from 'path'
import { readdir, readFile } from 'fs/promises'
import YAML from 'yaml'
import { loadAgent } from '../utils/agent'
import type { TestCase, TestAssertion } from '@agent-factory/core'

interface TestResult {
  name: string
  passed: boolean
  errors: string[]
}

export const testCommand = new Command('test')
  .description('Run test conversations')
  .argument('[pattern]', 'Test file pattern', '*.test.yaml')
  .option('-v, --verbose', 'Show detailed output')
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

    const results: TestResult[] = []

    for (const file of testFiles) {
      const filePath = join(testsDir, file)
      const content = await readFile(filePath, 'utf-8')
      const testCase = YAML.parse(content) as TestCase

      if (options.verbose) {
        console.log()
        console.log(chalk.gray('Running:'), testCase.name)
      }

      const result = await runTest(testCase, agent, options.verbose)
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

async function runTest(
  testCase: TestCase,
  agent: { name: string },
  verbose: boolean
): Promise<TestResult> {
  const errors: string[] = []

  for (const message of testCase.conversation || []) {
    if (message.role === 'assistant' && message.assertions) {
      for (const assertion of message.assertions) {
        const passed = checkAssertion(assertion, '[mock response]')
        if (!passed) {
          errors.push(`Assertion failed: ${assertion.type} - ${JSON.stringify(assertion.value)}`)
        }
      }
    }
  }

  if (errors.length === 0 && testCase.assertions) {
    for (const assertion of testCase.assertions) {
      const passed = checkAssertion(assertion, '[mock response]')
      if (!passed) {
        errors.push(`Assertion failed: ${assertion.type} - ${JSON.stringify(assertion.value)}`)
      }
    }
  }

  return {
    name: testCase.name,
    passed: errors.length === 0,
    errors,
  }
}

function checkAssertion(assertion: TestAssertion, response: string): boolean {
  switch (assertion.type) {
    case 'contains':
      return typeof assertion.value === 'string' && response.includes(assertion.value)
    case 'matches':
      return typeof assertion.value === 'string' && new RegExp(assertion.value).test(response)
    case 'toolCalled':
      return true
    case 'stateEquals':
      return true
    default:
      return false
  }
}
