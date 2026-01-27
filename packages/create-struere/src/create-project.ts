import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import { getTemplates } from './templates'

interface CreateOptions {
  template: string
  install: boolean
}

export async function createProject(name: string, options: CreateOptions): Promise<void> {
  const projectPath = join(process.cwd(), name)
  const spinner = ora()

  console.log()
  console.log(chalk.bold(`Creating ${chalk.cyan(name)}...`))
  console.log()

  spinner.start('Creating project structure')

  try {
    await mkdir(projectPath, { recursive: true })
    await mkdir(join(projectPath, 'src'), { recursive: true })
    await mkdir(join(projectPath, 'src', 'workflows'), { recursive: true })
    await mkdir(join(projectPath, 'tests'), { recursive: true })

    spinner.succeed('Project structure created')

    spinner.start('Writing template files')

    const templates = getTemplates(name)

    for (const [filePath, content] of Object.entries(templates)) {
      const fullPath = join(projectPath, filePath)
      await writeFile(fullPath, content, 'utf-8')
    }

    spinner.succeed('Template files written')

    if (options.install) {
      spinner.start('Installing dependencies')

      const proc = Bun.spawn(['bun', 'install'], {
        cwd: projectPath,
        stdout: 'pipe',
        stderr: 'pipe',
      })

      await proc.exited

      if (proc.exitCode === 0) {
        spinner.succeed('Dependencies installed')
      } else {
        spinner.warn('Failed to install dependencies. Run `bun install` manually.')
      }
    }

    console.log()
    console.log(chalk.green('Success!'), `Created ${chalk.cyan(name)} at ${chalk.gray(projectPath)}`)
    console.log()
    console.log('Next steps:')
    console.log()
    console.log(chalk.gray('  $'), chalk.cyan(`cd ${name}`))
    if (!options.install) {
      console.log(chalk.gray('  $'), chalk.cyan('bun install'))
    }
    console.log(chalk.gray('  $'), chalk.cyan('bun run dev'))
    console.log()
    console.log('Documentation:', chalk.blue('https://struere.dev/docs'))
    console.log()
  } catch (error) {
    spinner.fail('Failed to create project')
    console.error(error)
    process.exit(1)
  }
}
