import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { join } from 'path'
import { loadConfig } from '../utils/config'
import { loadAgent } from '../utils/agent'
import { validateAgent } from '../utils/validate'

export const buildCommand = new Command('build')
  .description('Build and validate agent for production')
  .option('-o, --outdir <dir>', 'Output directory', 'dist')
  .action(async (options) => {
    const spinner = ora()
    const cwd = process.cwd()

    console.log()
    console.log(chalk.bold('Building Agent'))
    console.log()

    spinner.start('Loading configuration')
    const config = await loadConfig(cwd)
    spinner.succeed('Configuration loaded')

    spinner.start('Loading agent')
    const agent = await loadAgent(cwd)
    spinner.succeed(`Agent "${agent.name}" loaded`)

    spinner.start('Validating agent')
    const errors = validateAgent(agent)

    if (errors.length > 0) {
      spinner.fail('Validation failed')
      console.log()
      for (const error of errors) {
        console.log(chalk.red('  ✗'), error)
      }
      console.log()
      process.exit(1)
    }
    spinner.succeed('Agent validated')

    spinner.start('Building')

    const outdir = join(cwd, options.outdir)

    const result = await Bun.build({
      entrypoints: [join(cwd, 'src/agent.ts')],
      outdir,
      target: 'node',
      minify: true,
    })

    if (!result.success) {
      spinner.fail('Build failed')
      console.log()
      for (const log of result.logs) {
        console.log(chalk.red('  ✗'), log.message)
      }
      process.exit(1)
    }

    spinner.succeed('Build completed')

    console.log()
    console.log(chalk.green('Success!'), `Built to ${chalk.cyan(options.outdir)}`)
    console.log()
    console.log('Output files:')
    for (const output of result.outputs) {
      console.log(chalk.gray('  •'), output.path.replace(cwd, '.'))
    }
    console.log()
  })
