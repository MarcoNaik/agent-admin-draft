import { getAllDocs } from "./content"

const BASE_URL = "https://docs.struere.dev"

const API_QUICK_START = `## API Quick Start

To send a message to a Struere agent, use the Chat API:

    POST https://<your-deployment>.convex.site/v1/agents/<agent-slug>/chat
    Authorization: Bearer <your-api-key>
    Content-Type: application/json

    {"message": "Hello, what can you help me with?"}

Response:

    {"threadId": "...", "message": "...", "usage": {"inputTokens": ..., "outputTokens": ..., "totalTokens": ...}}

- Use \`/v1/agents/:slug/chat\` (preferred) or \`/v1/chat\` with an \`agentId\` field
- API keys: created in the dashboard under Settings > API Keys
- Development keys: \`sk_dev_\` prefix. Production keys: \`sk_prod_\` prefix
- Pass \`threadId\` from a previous response to continue a conversation
- Pass \`externalThreadId\` to map external identifiers (e.g., \`"slack:U12345678"\`, \`"whatsapp:+1234567890"\`)
- Full API docs: ${BASE_URL}/llms-api.txt
- OpenAPI spec: ${BASE_URL}/openapi.yaml`

export function generateLlmsTxt(): string {
  const docs = getAllDocs()
  const lines: string[] = [
    "# Struere",
    "",
    "> AI agent platform with a built-in data layer, dynamic system prompts, event-driven automation, and integrations. Define agents as TypeScript code, talk to them via HTTP API.",
    "",
    "## How to read these docs",
    "",
    "This is the documentation index. Each URL below returns plain-text markdown.",
    "Fetch any URL directly to read that page. URLs are exact — do not modify them.",
    "",
    "- To read all docs in one file: " + `${BASE_URL}/llms-full.txt`,
    "- To read a topic: fetch a section file below",
    "- To read a specific page: fetch its URL from the page list below",
    "- OpenAPI spec: " + `${BASE_URL}/openapi.yaml`,
    "",
    "## Section files",
    "",
    `${BASE_URL}/llms-api.txt — Chat API, HTTP endpoints, webhooks`,
    `${BASE_URL}/llms-sdk.txt — Agent, data type, role, automation definitions`,
    `${BASE_URL}/llms-tools.txt — Built-in tools, custom tools, system prompt templates`,
    `${BASE_URL}/llms-platform.txt — Data, agents, automations, events, permissions, evals`,
    `${BASE_URL}/llms-integrations.txt — WhatsApp, Google Calendar, Flow payments, Airtable`,
    `${BASE_URL}/llms-cli.txt — CLI reference`,
    `${BASE_URL}/skill — Developer skill: behavioral rules, gotchas, decision frameworks`,
    "",
    "## All pages",
    "",
    "Section headers below are labels only — they are NOT part of the URL path.",
    "",
  ]

  let currentSection = ""
  for (const doc of docs) {
    if (doc.section !== currentSection) {
      if (currentSection) lines.push("")
      currentSection = doc.section
      lines.push(`### ${currentSection}`)
      lines.push("")
    }
    lines.push(`${BASE_URL}/${doc.slug}.md — ${doc.title}: ${doc.description}`)
  }

  lines.push("")
  lines.push("## Quick reference")
  lines.push("")
  lines.push("- Chat endpoint: `POST /v1/agents/:slug/chat` with Bearer token")
  lines.push("- SDK exports: `defineAgent`, `defineTools`, `defineData`, `defineRole`, `defineTrigger`")
  lines.push("- Default model: `openai/gpt-5-mini`")
  lines.push("- Environments: `development`, `production`, `eval`")
  lines.push("- Auth: API keys prefixed `sk_dev_` / `sk_prod_`")
  lines.push("- Package manager: Bun")
  lines.push("")

  return lines.join("\n")
}

export function generateLlmsFullTxt(): string {
  const docs = getAllDocs()
  const sections: string[] = [
    "# Struere Documentation (Full)",
    "",
    "> This file contains the COMPLETE Struere documentation — all pages, all sections. You do NOT need to fetch any other URLs. Everything is included below.",
    "",
    API_QUICK_START,
    "",
  ]

  let currentSection = ""
  for (const doc of docs) {
    if (doc.section !== currentSection) {
      currentSection = doc.section
      sections.push("---")
      sections.push("")
      sections.push(`# ${currentSection}`)
      sections.push("")
    }
    sections.push("---")
    sections.push("")
    sections.push(`## ${doc.title}`)
    if (doc.description) {
      sections.push("")
      sections.push(`> ${doc.description}`)
    }
    sections.push("")
    sections.push(doc.content.trim())
    sections.push("")
  }

  return sections.join("\n")
}

export function generateWorkspaceContext(): string {
  return `# Struere Workspace

> This is a Struere workspace project. You define agents, data types, roles, triggers, and custom tools here. The CLI syncs them to the Convex backend.

## Agent Usage

If you are an AI coding agent (Claude Code, Cursor, Copilot, etc.), use these patterns:

**Auth**: Set \`STRUERE_API_KEY\` environment variable (no browser login needed)

**Sync**: Use \`struere sync\` instead of \`struere dev\` — it syncs once and exits (no watch loop)
\`\`\`bash
struere sync              # sync to development + eval, then exit
struere sync --json       # machine-readable JSON output
struere sync --env production  # sync to production
struere sync --force      # skip deletion confirmations
\`\`\`

**Deploy**: \`struere deploy --force\` skips confirmation prompts

**JSON output**: Most commands support \`--json\` for structured output:
\`\`\`bash
struere data list <type> --json
struere status --json
struere deploy --json --force
\`\`\`

**Non-interactive mode** is auto-detected when \`STRUERE_API_KEY\` is set or stdout is not a TTY. In this mode, all confirmation prompts are auto-accepted and spinners are replaced with plain text.

**Exit codes**: All commands exit \`0\` on success, \`1\` on error. Check \`$?\` after execution.

{{PROJECT_CONTEXT}}

## Project Structure

\`\`\`
agents/              # Agent definitions (one file per agent)
entity-types/        # Data type schemas (like DB tables)
roles/               # RBAC roles with policies, scope rules, field masks
triggers/            # Automation rules (react to entity changes)
tools/index.ts       # Custom tools shared by all agents
evals/*.eval.yaml    # Test suites for agent evaluation
fixtures/*.fixture.yaml # Test data for eval environment
struere.json         # Organization config (auto-generated)
\`\`\`

## CLI Commands

| Command | Description |
|---------|-------------|
| \`struere sync\` | One-shot sync to Convex and exit (agent-friendly) |
| \`struere dev\` | Watch files and sync to Convex on save |
| \`struere deploy\` | Push development config to production |
| \`struere add agent\\|data-type\\|role\\|trigger\\|eval\\|fixture <name>\` | Scaffold a new resource |
| \`struere status\` | Compare local vs remote state |
| \`struere pull\` | Download remote resources to local files |
| \`struere data types\` | List data types in an environment |
| \`struere data list <type>\` | List records (supports \`--status\`, \`--limit\`, \`--json\`) |
| \`struere data get <id>\` | Get record details |
| \`struere data create <type>\` | Create record (interactive or \`--data <json>\`) |
| \`struere data update <id>\` | Update record (\`--data <json>\`, \`--status\`) |
| \`struere data delete <id>\` | Delete record (with confirmation) |
| \`struere data search <type> <query>\` | Search records by text |
| \`struere eval run <suite>\` | Run an eval suite and write Markdown results |
| \`struere eval run <suite> --case <name>\` | Run specific case(s) by name |
| \`struere eval run <suite> --tag <tag>\` | Run cases matching a tag |
| \`struere compile-prompt <agent-slug>\` | Compile and preview an agent's system prompt after template processing |
| \`struere run-tool <agent-slug> <tool-name>\` | Run a tool as it would execute during a real agent conversation |
| \`struere templates list\` | List WhatsApp message templates |
| \`struere templates create <name>\` | Create a template (\`--components <json>\` or \`--file <path>\`) |
| \`struere templates delete <name>\` | Delete a template (with confirmation) |
| \`struere templates status <name>\` | Check template approval status |
| \`struere docs\` | Regenerate this file |

## Key Patterns

- **Imports**: \`import { defineAgent, defineData, defineRole, defineTrigger, defineTools } from 'struere'\`
- **Default model**: \`openai/gpt-5-mini\` (OpenRouter format: \`provider/model-name\`). Also supports \`anthropic\`, \`openai\`, \`google\`
- **Scope rule values**: \`actor.userId\`, \`actor.entityId\`, \`actor.organizationId\`, \`actor.relatedIds:TYPE\`, \`literal:VALUE\`
- **Policy actions**: \`create\`, \`read\`, \`update\`, \`delete\`, \`list\` (deny overrides allow)
- **Entity link/unlink params**: \`fromId\`, \`toId\`, \`relationType\`
- **Trigger template vars**: \`{{trigger.entityId}}\`, \`{{trigger.data.X}}\`, \`{{steps.NAME.X}}\`

## Dynamic System Prompts

System prompts are **not static strings** — they are templates evaluated at runtime before every LLM call. This is one of the most powerful features in Struere because it enables completely different agent behavior depending on conditions, live data, and even other agents' responses.

### Template Variables
Simple variable substitution: \`{{agentName}}\`, \`{{organizationName}}\`, \`{{currentTime}}\`, \`{{entityTypes}}\`, \`{{roles}}\`, \`{{message}}\`, \`{{thread.metadata.X}}\`

### Embedded Queries (Function Calls)
Pull live data from the database directly into the system prompt:
\`\`\`
{{entity.query({"type": "customer", "limit": 5})}}
{{entity.get({"id": "ent_123"})}}
\`\`\`
This means the agent always sees the latest data — no stale context.

### Custom Tools in Prompts
Since custom tools can run arbitrary logic, you can create tools specifically to generate dynamic prompt sections. A custom tool can fetch external APIs, compute conditions, aggregate data, or format context — and its output gets embedded into the system prompt at runtime.

### Agent-to-Agent in Prompts
You can even use \`agent.chat\` in the template to have another agent's response injected into the system prompt. This enables patterns like a "context agent" that summarizes relevant info before the main agent starts reasoning.

For full template syntax: [System Prompt Templates](${BASE_URL}/tools/system-prompt-templates.md)

## WhatsApp Template Management

WhatsApp message templates are required for outbound messages outside the 24-hour messaging window. Struere supports full template lifecycle management.

### Template Actions

| Action | Description |
|--------|-------------|
| \`whatsappActions.listTemplates\` | List all templates for a connection |
| \`whatsappActions.createTemplate\` | Create a new template on Meta |
| \`whatsappActions.deleteTemplate\` | Delete a template from Meta |
| \`whatsappActions.getTemplateStatus\` | Check approval status of a template |

### Template Categories

- **UTILITY**: transactional updates (order confirmations, reminders)
- **MARKETING**: promotional content
- **AUTHENTICATION**: OTP/verification codes

### Template Components

- **HEADER** (optional): TEXT, IMAGE, VIDEO, or DOCUMENT
- **BODY** (required): main message text with \`{{named_params}}\` or \`{{1}}\` positional
- **FOOTER** (optional): short text, no variables
- **BUTTONS** (optional): QUICK_REPLY, URL, PHONE_NUMBER (do not interleave QUICK_REPLY with URL/PHONE_NUMBER)

Use \`parameter_format: "NAMED"\` with \`{{param_name}}\` variables (recommended over positional). Include examples when variables appear in HEADER or BODY.

### Status Flow

\`PENDING\` → \`APPROVED\` | \`REJECTED\` | \`PAUSED\`

For details: [WhatsApp Integration](${BASE_URL}/integrations/whatsapp.md)

## Multi-Agent Communication (agent.chat)

The \`agent.chat\` tool lets agents delegate work to other agents. This is a core building block for complex systems:

- **Orchestrator pattern**: A coordinator agent routes tasks to specialist agents based on the request
- **Trigger actions**: Use \`agent.chat\` inside trigger action pipelines to have an agent reason about entity changes
- **Chained delegation**: Agents can call other agents up to 3 levels deep (A→B→C), with cycle detection
- **Isolated execution**: Each agent runs its own LLM loop with its own system prompt, tools, and permissions

\`\`\`typescript
// Orchestrator that delegates to specialists
tools: ["agent.chat", "entity.query"]
// In trigger actions:
{ tool: "agent.chat", args: { agent: "billing-agent", message: "Process refund for {{trigger.data.orderId}}" } }
\`\`\`

For details: [Agents](${BASE_URL}/platform/agents.md)

## Behavioral Rules

ALWAYS follow these rules when working in a Struere project:

1. **Fetch docs before writing code.** Look up the task in the Documentation section below and fetch the relevant documentation. Do not write Struere definitions from memory.
2. **Ask before assuming.** Before creating an agent, ask what it should do, who it serves, and what tools it needs. Before creating a role, ask what access level is needed. Do not guess.
3. **Validate after changes.** Run \`npx struere sync\` after editing resource files to validate and sync to development. Check the output for errors.
4. **Use bun, never npm.** For package installs and script execution, always use \`bun install\`, \`bun run\`, \`bunx\`.
5. **One export per file.** Each file in \`agents/\`, \`entity-types/\`, \`roles/\`, \`triggers/\` exports a single default. Only \`tools/index.ts\` exports all custom tools.
6. **Slugs are identities.** Resources upsert by slug. Renaming a slug creates a new resource — it does not rename the existing one.
7. **Environments are isolated.** \`struere dev\` syncs to development + eval. \`struere deploy\` syncs to production. Data, configs, and API keys are fully isolated per environment.
8. **Keep tools under 5 per agent.** Agent performance degrades with more tools. If an agent needs more, split into specialist agents connected with \`agent.chat\`.

## Silent Failure Gotchas

These mistakes cause no visible errors but produce wrong behavior:

1. **PolicyConfig has NO \`priority\` field.** Deny always overrides allow automatically. Adding \`priority\` does nothing.
2. **Scope rule operators: \`eq\`, \`neq\`, \`in\`, \`contains\`.** Using \`ne\` (common in other systems) silently fails to match.
3. **Entity link/unlink uses \`fromId\`/\`toId\`.** Using \`fromEntityId\`/\`toEntityId\` silently fails.
4. **Model IDs use OpenRouter format: \`provider/model-name\`.** Write \`openai/gpt-5-mini\`, not \`gpt-5-mini\`. Write \`anthropic/claude-sonnet-4\`, not \`claude-sonnet-4\`.
5. **Default model is \`openai/gpt-5-mini\`** (temperature 0.7, maxTokens 4096) when \`model\` is omitted from agent config.
6. **Field masks use allowlist strategy.** New fields added to a data type are hidden by default if a field mask exists for that entity type.
7. **Template variables that fail resolve to \`[TEMPLATE_ERROR: variableName not found]\`.** Always test prompts with \`struere compile-prompt <agent-slug>\`.
8. **Custom tool \`fetch\` is sandboxed** to these domains only: api.openai.com, api.anthropic.com, api.stripe.com, api.sendgrid.com, api.twilio.com, hooks.slack.com, discord.com, api.github.com.
9. **\`entity.query\` default limit is 50, max is 100.** Agents that need more data should paginate or use template-only tools for prompt injection.
10. **\`agent.chat\` has depth limit 3 with cycle detection.** A calling B calling A is blocked. Design agent graphs to be shallow.
11. **Fixture sync deletes all existing entities in eval** and recreates from YAML. This is a full reset every sync — not incremental.
12. **\`whatsappOwnedTemplates\` is org-scoped, not env-scoped.** Templates are shared across environments.

## Struere Developer Skill

For comprehensive decision frameworks, workflow checklists, model selection guide, and documentation routing table, fetch the full Struere developer skill:

${BASE_URL}/skill

## Documentation

Fetch these URLs for detailed documentation on each topic:

### SDK
- [SDK Overview](${BASE_URL}/sdk/overview.md)
- [defineAgent](${BASE_URL}/sdk/define-agent.md)
- [defineData](${BASE_URL}/sdk/define-data.md)
- [defineRole](${BASE_URL}/sdk/define-role.md)
- [defineTrigger](${BASE_URL}/sdk/define-trigger.md)
- [defineTools](${BASE_URL}/sdk/define-tools.md)

### Tools
- [Built-in Tools](${BASE_URL}/tools/built-in-tools.md)
- [Custom Tools](${BASE_URL}/tools/custom-tools.md)
- [System Prompt Templates](${BASE_URL}/tools/system-prompt-templates.md)

### Platform
- [Data](${BASE_URL}/platform/data.md)
- [Permissions](${BASE_URL}/platform/permissions.md)
- [Agents](${BASE_URL}/platform/agents.md)
- [Events](${BASE_URL}/platform/events.md)
- [Triggers](${BASE_URL}/platform/triggers.md)
- [Environment Isolation](${BASE_URL}/platform/environment-isolation.md)
- [Evaluations](${BASE_URL}/platform/evals.md)

### CLI
- [CLI Overview](${BASE_URL}/cli/overview.md)
- [struere init](${BASE_URL}/cli/init.md)
- [struere sync](${BASE_URL}/cli/sync.md)
- [struere dev](${BASE_URL}/cli/dev.md)
- [struere add](${BASE_URL}/cli/add.md)
- [struere deploy](${BASE_URL}/cli/deploy.md)
- [struere eval run](${BASE_URL}/cli/eval.md)
- [struere compile-prompt](${BASE_URL}/cli/compile-prompt.md)
- [struere run-tool](${BASE_URL}/cli/run-tool.md)
- [struere templates](${BASE_URL}/cli/templates.md)

### API & Integrations
- [Chat API](${BASE_URL}/api/chat.md)
- [Webhooks](${BASE_URL}/api/webhooks.md)
- [WhatsApp Integration](${BASE_URL}/integrations/whatsapp.md)

### Reference
- [Project Structure](${BASE_URL}/reference/project-structure.md)
- [Model Configuration](${BASE_URL}/reference/model-configuration.md)

Full docs: ${BASE_URL}/llms-full.txt`
}

export { API_QUICK_START }
