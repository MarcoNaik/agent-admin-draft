#!/usr/bin/env node
import { program } from 'commander'
import prompts from 'prompts'
import { createProject } from './create-project'

async function askProjectName(): Promise<string> {
  const response = await prompts({
    type: 'text',
    name: 'name',
    message: 'What is your agent name?',
    validate: (value: string) => {
      if (!value) return 'Agent name is required'
      if (!/^[a-z0-9-]+$/.test(value)) {
        return 'Agent name must be lowercase alphanumeric with hyphens'
      }
      return true
    },
  })

  if (!response.name) {
    process.exit(1)
  }

  return response.name
}

program
  .name('create-agent-factory')
  .description('Create a new Agent Factory project')
  .argument('[name]', 'Project name')
  .option('-t, --template <template>', 'Template to use', 'default')
  .option('--no-install', 'Skip dependency installation')
  .action(async (name: string | undefined, options: { template: string; install: boolean }) => {
    const projectName = name || (await askProjectName())
    await createProject(projectName, options)
  })
  .parse()
