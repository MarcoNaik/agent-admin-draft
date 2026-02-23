import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { loadProject } from '../utils/project'
import { loadAllResources, type LoadedResources } from '../utils/loader'

const DOCS_BASE = 'https://docs.struere.dev'

type Target = 'claude' | 'cursor' | 'copilot'

const ALL_TARGETS: Target[] = ['claude', 'cursor', 'copilot']

const TARGET_FILES: Record<Target, string> = {
  claude: 'CLAUDE.md',
  cursor: '.cursorrules',
  copilot: '.github/copilot-instructions.md',
}

function buildProjectContext(orgName: string, resources: LoadedResources): string {
  const lines: string[] = []
  lines.push(`## This Project`)
  lines.push('')
  lines.push(`Organization: ${orgName}`)

  if (resources.agents.length > 0) {
    lines.push('')
    lines.push(`### Agents (${resources.agents.length})`)
    for (const agent of resources.agents) {
      const tools = agent.tools?.length ? ` — tools: ${agent.tools.join(', ')}` : ''
      lines.push(`- **${agent.name}** (\`${agent.slug}\`) v${agent.version}${tools}`)
    }
  }

  if (resources.entityTypes.length > 0) {
    lines.push('')
    lines.push(`### Entity Types (${resources.entityTypes.length})`)
    for (const et of resources.entityTypes) {
      const fields = et.schema?.properties ? Object.keys(et.schema.properties).join(', ') : ''
      const fieldStr = fields ? ` — fields: ${fields}` : ''
      lines.push(`- **${et.name}** (\`${et.slug}\`)${fieldStr}`)
    }
  }

  if (resources.roles.length > 0) {
    lines.push('')
    lines.push(`### Roles (${resources.roles.length})`)
    for (const role of resources.roles) {
      const policyCount = role.policies?.length || 0
      lines.push(`- **${role.name}** — ${policyCount} ${policyCount === 1 ? 'policy' : 'policies'}`)
    }
  }

  if (resources.triggers.length > 0) {
    lines.push('')
    lines.push(`### Triggers (${resources.triggers.length})`)
    for (const trigger of resources.triggers) {
      lines.push(`- **${trigger.name}** (\`${trigger.slug}\`) — on \`${trigger.on.entityType}.${trigger.on.action}\``)
    }
  }

  if (resources.customTools.length > 0) {
    lines.push('')
    lines.push(`### Custom Tools (${resources.customTools.length})`)
    for (const tool of resources.customTools) {
      lines.push(`- **${tool.name}** — ${tool.description}`)
    }
  }

  return lines.join('\n')
}

function buildDocument(projectContext: string | null): string {
  const lines: string[] = []

  lines.push(`# Struere Workspace`)
  lines.push('')
  lines.push(`> This is a Struere workspace project. You define agents, entity types, roles, triggers, and custom tools here. The CLI syncs them to the Convex backend.`)
  lines.push('')

  lines.push(`## Agent Usage`)
  lines.push('')
  lines.push('If you are an AI coding agent (Claude Code, Cursor, Copilot, etc.), use these patterns:')
  lines.push('')
  lines.push('**Auth**: Set `STRUERE_API_KEY` environment variable (no browser login needed)')
  lines.push('')
  lines.push('**Sync**: Use `struere sync` instead of `struere dev` — it syncs once and exits (no watch loop)')
  lines.push('```bash')
  lines.push('struere sync              # sync to development + eval, then exit')
  lines.push('struere sync --json       # machine-readable JSON output')
  lines.push('struere sync --env production  # sync to production')
  lines.push('struere sync --force      # skip deletion confirmations')
  lines.push('```')
  lines.push('')
  lines.push('**Deploy**: `struere deploy --force` skips confirmation prompts')
  lines.push('')
  lines.push('**JSON output**: Most commands support `--json` for structured output:')
  lines.push('```bash')
  lines.push('struere entities list <type> --json')
  lines.push('struere status --json')
  lines.push('struere deploy --json --force')
  lines.push('```')
  lines.push('')
  lines.push('**Non-interactive mode** is auto-detected when `STRUERE_API_KEY` is set or stdout is not a TTY. In this mode, all confirmation prompts are auto-accepted and spinners are replaced with plain text.')
  lines.push('')
  lines.push('**Exit codes**: All commands exit `0` on success, `1` on error. Check `$?` after execution.')
  lines.push('')

  if (projectContext) {
    lines.push(projectContext)
    lines.push('')
  }

  lines.push(`## Project Structure`)
  lines.push('')
  lines.push('```')
  lines.push('agents/              # Agent definitions (one file per agent)')
  lines.push('entity-types/        # Entity type schemas (like DB tables)')
  lines.push('roles/               # RBAC roles with policies, scope rules, field masks')
  lines.push('triggers/            # Automation rules (react to entity changes)')
  lines.push('tools/index.ts       # Custom tools shared by all agents')
  lines.push('evals/*.eval.yaml    # Test suites for agent evaluation')
  lines.push('fixtures/*.fixture.yaml # Test data for eval environment')
  lines.push('struere.json         # Organization config (auto-generated)')
  lines.push('```')
  lines.push('')

  lines.push(`## CLI Commands`)
  lines.push('')
  lines.push('| Command | Description |')
  lines.push('|---------|-------------|')
  lines.push('| `struere sync` | One-shot sync to Convex and exit (agent-friendly) |')
  lines.push('| `struere dev` | Watch files and sync to Convex on save |')
  lines.push('| `struere deploy` | Push development config to production |')
  lines.push('| `struere add agent\\|entity-type\\|role\\|trigger\\|eval\\|fixture <name>` | Scaffold a new resource |')
  lines.push('| `struere status` | Compare local vs remote state |')
  lines.push('| `struere pull` | Download remote resources to local files |')
  lines.push('| `struere entities types` | List entity types in an environment |')
  lines.push('| `struere entities list <type>` | List entities (supports `--status`, `--limit`, `--json`) |')
  lines.push('| `struere entities get <id>` | Get entity details |')
  lines.push('| `struere entities create <type>` | Create entity (interactive or `--data <json>`) |')
  lines.push('| `struere entities update <id>` | Update entity (`--data <json>`, `--status`) |')
  lines.push('| `struere entities delete <id>` | Delete entity (with confirmation) |')
  lines.push('| `struere entities search <type> <query>` | Search entities by text |')
  lines.push('| `struere eval run <suite>` | Run an eval suite and write Markdown results |')
  lines.push('| `struere eval run <suite> --case <name>` | Run specific case(s) by name |')
  lines.push('| `struere eval run <suite> --tag <tag>` | Run cases matching a tag |')
  lines.push('| `struere templates list` | List WhatsApp message templates |')
  lines.push('| `struere templates create <name>` | Create a template (`--components <json>` or `--file <path>`) |')
  lines.push('| `struere templates delete <name>` | Delete a template (with confirmation) |')
  lines.push('| `struere templates status <name>` | Check template approval status |')
  lines.push('| `struere docs` | Regenerate this file |')
  lines.push('')

  lines.push(`## Key Patterns`)
  lines.push('')
  lines.push('- **Imports**: `import { defineAgent, defineEntityType, defineRole, defineTrigger, defineTools } from \'struere\'`')
  lines.push('- **Default model**: `grok-4-1-fast` (provider: `xai`). Also supports `anthropic`, `openai` and `google`')
  lines.push('- **Scope rule values**: `actor.userId`, `actor.entityId`, `actor.organizationId`, `actor.relatedIds:TYPE`, `literal:VALUE`')
  lines.push('- **Policy actions**: `create`, `read`, `update`, `delete`, `list` (deny overrides allow)')
  lines.push('- **Entity link/unlink params**: `fromId`, `toId`, `relationType`')
  lines.push('- **Trigger template vars**: `{{trigger.entityId}}`, `{{trigger.data.X}}`, `{{steps.NAME.X}}`')
  lines.push('')

  lines.push(`## Dynamic System Prompts`)
  lines.push('')
  lines.push('System prompts are **not static strings** — they are templates evaluated at runtime before every LLM call. This is one of the most powerful features in Struere because it enables completely different agent behavior depending on conditions, live data, and even other agents\' responses.')
  lines.push('')
  lines.push('### Template Variables')
  lines.push('Simple variable substitution: `{{agentName}}`, `{{organizationName}}`, `{{currentTime}}`, `{{entityTypes}}`, `{{roles}}`, `{{message}}`, `{{thread.metadata.X}}`')
  lines.push('')
  lines.push('### Embedded Queries (Function Calls)')
  lines.push('Pull live data from the database directly into the system prompt:')
  lines.push('```')
  lines.push('{{entity.query({"type": "customer", "limit": 5})}}')
  lines.push('{{entity.get({"id": "ent_123"})}}')
  lines.push('```')
  lines.push('This means the agent always sees the latest data — no stale context.')
  lines.push('')
  lines.push('### Custom Tools in Prompts')
  lines.push('Since custom tools can run arbitrary logic, you can create tools specifically to generate dynamic prompt sections. A custom tool can fetch external APIs, compute conditions, aggregate data, or format context — and its output gets embedded into the system prompt at runtime.')
  lines.push('')
  lines.push('### Agent-to-Agent in Prompts')
  lines.push('You can even use `agent.chat` in the template to have another agent\'s response injected into the system prompt. This enables patterns like a "context agent" that summarizes relevant info before the main agent starts reasoning.')
  lines.push('')
  lines.push(`For full template syntax: [System Prompt Templates](${DOCS_BASE}/tools/system-prompt-templates.md)`)
  lines.push('')

  lines.push(`## WhatsApp Template Management`)
  lines.push('')
  lines.push('WhatsApp message templates are required for outbound messages outside the 24-hour messaging window. Struere supports full template lifecycle management.')
  lines.push('')
  lines.push('### Template Actions')
  lines.push('')
  lines.push('| Action | Description |')
  lines.push('|--------|-------------|')
  lines.push('| `whatsappActions.listTemplates` | List all templates for a connection |')
  lines.push('| `whatsappActions.createTemplate` | Create a new template on Meta |')
  lines.push('| `whatsappActions.deleteTemplate` | Delete a template from Meta |')
  lines.push('| `whatsappActions.getTemplateStatus` | Check approval status of a template |')
  lines.push('')
  lines.push('### Template Categories')
  lines.push('')
  lines.push('- **UTILITY**: transactional updates (order confirmations, reminders)')
  lines.push('- **MARKETING**: promotional content')
  lines.push('- **AUTHENTICATION**: OTP/verification codes')
  lines.push('')
  lines.push('### Template Components')
  lines.push('')
  lines.push('- **HEADER** (optional): TEXT, IMAGE, VIDEO, or DOCUMENT')
  lines.push('- **BODY** (required): main message text with `{{named_params}}` or `{{1}}` positional')
  lines.push('- **FOOTER** (optional): short text, no variables')
  lines.push('- **BUTTONS** (optional): QUICK_REPLY, URL, PHONE_NUMBER (do not interleave QUICK_REPLY with URL/PHONE_NUMBER)')
  lines.push('')
  lines.push('Use `parameter_format: "NAMED"` with `{{param_name}}` variables (recommended over positional). Include examples when variables appear in HEADER or BODY.')
  lines.push('')
  lines.push('### Status Flow')
  lines.push('')
  lines.push('`PENDING` → `APPROVED` | `REJECTED` | `PAUSED`')
  lines.push('')
  lines.push(`For details: [WhatsApp Integration](${DOCS_BASE}/integrations/whatsapp.md)`)
  lines.push('')

  lines.push(`## Multi-Agent Communication (agent.chat)`)
  lines.push('')
  lines.push('The `agent.chat` tool lets agents delegate work to other agents. This is a core building block for complex systems:')
  lines.push('')
  lines.push('- **Orchestrator pattern**: A coordinator agent routes tasks to specialist agents based on the request')
  lines.push('- **Trigger actions**: Use `agent.chat` inside trigger action pipelines to have an agent reason about entity changes')
  lines.push('- **Chained delegation**: Agents can call other agents up to 3 levels deep (A→B→C), with cycle detection')
  lines.push('- **Isolated execution**: Each agent runs its own LLM loop with its own system prompt, tools, and permissions')
  lines.push('')
  lines.push('```typescript')
  lines.push('// Orchestrator that delegates to specialists')
  lines.push('tools: ["agent.chat", "entity.query"]')
  lines.push('// In trigger actions:')
  lines.push('{ tool: "agent.chat", args: { agent: "billing-agent", message: "Process refund for {{trigger.data.orderId}}" } }')
  lines.push('```')
  lines.push('')
  lines.push(`For details: [Agents](${DOCS_BASE}/platform/agents.md)`)
  lines.push('')

  lines.push(`## Best Practices`)
  lines.push('')
  lines.push('- **Keep tools under 10 per agent.** Agents perform significantly worse when they have too many tools to choose from. If an agent needs more, split it into specialist agents and use `agent.chat` to orchestrate')
  lines.push('- **Always ask the user before making assumptions.** The user may not be technical — help them accomplish what they want by asking the right questions and offering clear options')
  lines.push('- **Always check the documentation before making changes.** Fetch the relevant doc link below to verify the correct API, field names, and patterns. Do not guess — wrong field names or patterns will cause silent failures')
  lines.push('- **Use `struere sync` to validate changes.** Run after editing files to sync to Convex. Use `struere dev` for continuous watch mode during manual development')
  lines.push('- **Test with evals.** Write eval suites to catch regressions in agent behavior (`struere add eval <name>`)')
  lines.push('')

  lines.push(`## Documentation`)
  lines.push('')
  lines.push(`Fetch these URLs for detailed documentation on each topic:`)
  lines.push('')
  lines.push('### SDK')
  lines.push(`- [SDK Overview](${DOCS_BASE}/sdk/overview.md)`)
  lines.push(`- [defineAgent](${DOCS_BASE}/sdk/define-agent.md)`)
  lines.push(`- [defineEntityType](${DOCS_BASE}/sdk/define-entity-type.md)`)
  lines.push(`- [defineRole](${DOCS_BASE}/sdk/define-role.md)`)
  lines.push(`- [defineTrigger](${DOCS_BASE}/sdk/define-trigger.md)`)
  lines.push(`- [defineTools](${DOCS_BASE}/sdk/define-tools.md)`)
  lines.push('')
  lines.push('### Tools')
  lines.push(`- [Built-in Tools](${DOCS_BASE}/tools/built-in-tools.md)`)
  lines.push(`- [Custom Tools](${DOCS_BASE}/tools/custom-tools.md)`)
  lines.push(`- [System Prompt Templates](${DOCS_BASE}/tools/system-prompt-templates.md)`)
  lines.push('')
  lines.push('### Platform')
  lines.push(`- [Entities](${DOCS_BASE}/platform/entities.md)`)
  lines.push(`- [Permissions](${DOCS_BASE}/platform/permissions.md)`)
  lines.push(`- [Agents](${DOCS_BASE}/platform/agents.md)`)
  lines.push(`- [Events](${DOCS_BASE}/platform/events.md)`)
  lines.push(`- [Triggers](${DOCS_BASE}/platform/triggers.md)`)
  lines.push(`- [Environment Isolation](${DOCS_BASE}/platform/environment-isolation.md)`)
  lines.push(`- [Evaluations](${DOCS_BASE}/platform/evals.md)`)
  lines.push('')
  lines.push('### CLI')
  lines.push(`- [CLI Overview](${DOCS_BASE}/cli/overview.md)`)
  lines.push(`- [struere init](${DOCS_BASE}/cli/init.md)`)
  lines.push(`- [struere sync](${DOCS_BASE}/cli/sync.md)`)
  lines.push(`- [struere dev](${DOCS_BASE}/cli/dev.md)`)
  lines.push(`- [struere add](${DOCS_BASE}/cli/add.md)`)
  lines.push(`- [struere deploy](${DOCS_BASE}/cli/deploy.md)`)
  lines.push(`- [struere eval run](${DOCS_BASE}/cli/eval.md)`)
  lines.push(`- [struere templates](${DOCS_BASE}/cli/templates.md)`)
  lines.push('')
  lines.push('### API & Integrations')
  lines.push(`- [Chat API](${DOCS_BASE}/api/chat.md)`)
  lines.push(`- [Webhooks](${DOCS_BASE}/api/webhooks.md)`)
  lines.push(`- [WhatsApp Integration](${DOCS_BASE}/integrations/whatsapp.md)`)
  lines.push('')
  lines.push('### Reference')
  lines.push(`- [Project Structure](${DOCS_BASE}/reference/project-structure.md)`)
  lines.push(`- [Model Configuration](${DOCS_BASE}/reference/model-configuration.md)`)
  lines.push('')
  lines.push(`Full docs: ${DOCS_BASE}/llms-full.txt`)

  return lines.join('\n')
}

function writeTarget(cwd: string, target: Target, content: string): void {
  const filePath = join(cwd, TARGET_FILES[target])
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(filePath, content)
}

export async function generateDocs(cwd: string, targets: Target[]): Promise<{ generated: string[]; error?: string }> {
  const generated: string[] = []

  let projectContext: string | null = null
  const project = loadProject(cwd)
  if (project) {
    try {
      const resources = await loadAllResources(cwd)
      projectContext = buildProjectContext(project.organization.name, resources)
    } catch {
      projectContext = buildProjectContext(project.organization.name, {
        agents: [], entityTypes: [], roles: [], customTools: [], evalSuites: [], triggers: [], fixtures: [], errors: [],
      })
    }
  }

  const content = buildDocument(projectContext)

  for (const target of targets) {
    writeTarget(cwd, target, content)
    generated.push(TARGET_FILES[target])
  }

  return { generated }
}

export const docsCommand = new Command('docs')
  .description('Generate AI context files (CLAUDE.md, .cursorrules, copilot-instructions) from live docs')
  .option('--claude', 'Generate CLAUDE.md only')
  .option('--cursor', 'Generate .cursorrules only')
  .option('--copilot', 'Generate .github/copilot-instructions.md only')
  .action(async (options: { claude?: boolean; cursor?: boolean; copilot?: boolean }) => {
    const cwd = process.cwd()
    const spinner = ora()

    console.log()
    console.log(chalk.bold('Struere Docs'))
    console.log()

    let targets: Target[]
    if (options.claude || options.cursor || options.copilot) {
      targets = []
      if (options.claude) targets.push('claude')
      if (options.cursor) targets.push('cursor')
      if (options.copilot) targets.push('copilot')
    } else {
      targets = [...ALL_TARGETS]
    }

    spinner.start('Generating context files')

    const { generated, error } = await generateDocs(cwd, targets)

    if (error) {
      spinner.fail('Failed to generate docs')
      console.log(chalk.red('Error:'), error)
      process.exit(1)
    }

    spinner.succeed(`Generated ${generated.length} file${generated.length === 1 ? '' : 's'}`)
    for (const file of generated) {
      console.log(chalk.green('  ✓'), file)
    }
    console.log()
  })
