const BASE_URL = "https://docs.struere.dev"

export function generateSkillContent(): string {
  return `# Struere Developer Guide

Struere is a full-stack AI agent platform. You define agents, data types, roles, triggers, and custom tools as TypeScript code — then sync to development and deploy to production.

## How to Use This Guide

You are working inside a Struere project. Before writing or modifying any Struere code, ALWAYS fetch the relevant documentation first. Never work from memory alone.

## Documentation Routing

When you need to do something, fetch the matching URL before writing code:

| Task | Fetch |
|------|-------|
| Define an agent | ${BASE_URL}/sdk/define-agent.md |
| Define a data type | ${BASE_URL}/sdk/define-data.md |
| Define a role / permissions | ${BASE_URL}/sdk/define-role.md |
| Define a trigger / automation | ${BASE_URL}/sdk/define-trigger.md |
| Define custom tools | ${BASE_URL}/sdk/define-tools.md |
| Full SDK reference | ${BASE_URL}/llms-sdk.txt |
| System prompt templates | ${BASE_URL}/tools/system-prompt-templates.md |
| Built-in tools list | ${BASE_URL}/tools/built-in-tools.md |
| Custom tools guide | ${BASE_URL}/tools/custom-tools.md |
| Chat API integration | ${BASE_URL}/llms-api.txt |
| OpenAPI spec | ${BASE_URL}/openapi.yaml |
| Set up RBAC | ${BASE_URL}/knowledge-base/how-to-set-up-rbac.md |
| Debug permission denied | ${BASE_URL}/knowledge-base/how-to-debug-permission-denied.md |
| Handle tool errors | ${BASE_URL}/knowledge-base/how-to-handle-tool-errors.md |
| Manage environments | ${BASE_URL}/knowledge-base/how-to-manage-environments.md |
| Test with evals | ${BASE_URL}/knowledge-base/how-to-test-with-evals.md |
| Use multiple agents | ${BASE_URL}/knowledge-base/how-to-use-multiple-agents.md |
| Use template variables | ${BASE_URL}/knowledge-base/how-to-use-template-variables.md |
| Add chatbot to website | ${BASE_URL}/knowledge-base/how-to-add-chatbot-to-website.md |
| WhatsApp integration | ${BASE_URL}/integrations/whatsapp.md |
| Google Calendar integration | ${BASE_URL}/integrations/google-calendar.md |
| Airtable integration | ${BASE_URL}/integrations/airtable.md |
| Email (Resend) integration | ${BASE_URL}/integrations/resend.md |
| Flow Payments integration | ${BASE_URL}/integrations/flow-payments.md |
| Embeddable widget | ${BASE_URL}/integrations/embeddable-widget.md |
| All integrations | ${BASE_URL}/llms-integrations.txt |
| CLI commands | ${BASE_URL}/llms-cli.txt |
| Platform concepts | ${BASE_URL}/llms-platform.txt |
| Model configuration | ${BASE_URL}/reference/model-configuration.md |
| Error codes | ${BASE_URL}/reference/error-codes.md |
| Rate limits | ${BASE_URL}/reference/rate-limiting.md |
| Project structure | ${BASE_URL}/reference/project-structure.md |
| Best practices | ${BASE_URL}/knowledge-base/best-practices.md |
| Full documentation | ${BASE_URL}/llms-full.txt |
| Docs index | ${BASE_URL}/llms.txt |

## Behavioral Rules

ALWAYS follow these rules when working in a Struere project:

1. **Fetch docs before writing code.** Look up the task in the routing table above and fetch the relevant documentation. Do not write Struere definitions from memory.

2. **Ask before assuming.** Before creating an agent, ask what it should do, who it serves, and what tools it needs. Before creating a role, ask what access level is needed. Do not guess.

3. **Validate after changes.** Run \`npx struere sync\` after editing resource files to validate and sync to development. Check the output for errors.

4. **Use bun, never npm.** For package installs and script execution, always use \`bun install\`, \`bun run\`, \`bunx\`.

5. **One export per file.** Each file in \`agents/\`, \`entity-types/\`, \`roles/\`, \`triggers/\` exports a single default. Only \`tools/index.ts\` exports all custom tools.

6. **Slugs are identities.** Resources upsert by slug. Renaming a slug creates a new resource — it does not rename the existing one. To rename, delete the old slug and create the new one.

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

## Decision Frameworks

### Choosing a Model

| Need | Model |
|------|-------|
| Cost-sensitive / high-volume | \`openai/gpt-5-mini\` or \`openai/gpt-5-nano\` |
| Balanced reasoning | \`anthropic/claude-sonnet-4\` or \`openai/gpt-5\` |
| Complex reasoning | \`anthropic/claude-opus-4\` or \`openai/o3\` |
| Fast + cheap | \`xai/grok-4-1-fast\` or \`google/gemini-2.5-flash\` |

Fetch ${BASE_URL}/reference/model-configuration.md for full pricing and options.

### Built-in vs Custom Tools

Use **built-in tools** when:
- Agent needs simple CRUD on entities (entity.create, entity.query, etc.)
- Agent needs to send messages (whatsapp.send, email.send)
- Agent needs calendar or payment operations

Use **custom tools** when:
- Agent needs multi-step workflows (create + notify + update in one call)
- Agent needs external API calls beyond the sandboxed domains
- Agent needs data transformation or computation
- You want to reduce tool count by consolidating multiple operations

Use **\`templateOnly: true\`** on custom tools when:
- You need dynamic data in the system prompt without adding to the runtime tool list
- You want to inject computed context at prompt compile time

### Structuring Multi-Agent Systems

- Split agents by **audience** (customer-facing, admin-facing), not by function (booking, notification)
- Use **triggers** for decoupled async communication between agents (retried, tracked)
- Use **\`agent.chat\`** for real-time delegation within a conversation
- Each agent gets its own system prompt, tools, and permission scope
- Keep the agent graph shallow (max depth 3)

### System Prompt Structure

Order your system prompt sections by priority:
1. **Security** — never-do rules, boundaries
2. **Data integrity** — required fields, validation rules
3. **Intent detection** — what the agent should do for different requests
4. **Conversation flows** — multi-turn patterns, handoff rules

Always include \`{{currentTime}}\` and \`{{organizationName}}\`. Test with \`struere compile-prompt <agent-slug>\` before deploying.

## Workflow Checklists

### Creating a New Agent

1. Ask: what should this agent do? Who is the audience? What data does it need?
2. Fetch: ${BASE_URL}/sdk/define-agent.md
3. Scaffold: \`npx struere add agent <name>\`
4. Define: name, slug, version, systemPrompt, model, tools (keep under 5)
5. Include \`{{currentTime}}\` and \`{{organizationName}}\` in prompt
6. Sync: \`npx struere dev\` or \`npx struere sync\`
7. Test: \`struere compile-prompt <slug>\` then \`struere chat <slug>\`

### Setting Up Permissions

1. Ask: who needs access to what? What should be hidden?
2. Fetch: ${BASE_URL}/sdk/define-role.md and ${BASE_URL}/knowledge-base/how-to-set-up-rbac.md
3. Scaffold: \`npx struere add role <name>\`
4. Define policies (deny overrides allow, NO priority field)
5. Add scope rules for row-level filtering (\`eq\`, \`neq\`, \`in\`, \`contains\`)
6. Add field masks for column-level hiding (allowlist strategy)
7. Sync and test with a development API key

### Integrating via Chat API

1. Fetch: ${BASE_URL}/llms-api.txt or ${BASE_URL}/openapi.yaml
2. Create API key in dashboard (Settings > API Keys, select environment)
3. Use slug endpoint: \`POST /v1/agents/:slug/chat\` with \`Bearer sk_dev_...\` or \`sk_prod_...\`
4. Pass \`threadId\` for multi-turn conversations
5. Pass \`externalThreadId\` for idempotent mapping from your system
6. Handle errors: 401 (bad key), 429 (rate limit), 500 (agent error)

### Adding an Integration

1. Ask: which integration? (WhatsApp, Calendar, Airtable, Email, Payments)
2. Fetch the integration page from the routing table above
3. Configure via CLI: \`struere integration <provider> --<key> <value>\`
4. Add the integration's tools to the agent's tool list
5. Sync and test in development first`
}

export function generateSkillMd(): string {
  const content = generateSkillContent()
  return `---
name: struere-developer
description: "Build, configure, and deploy AI agents on the Struere platform. Use when working with Struere projects (struere.json present), defining agents/data-types/roles/triggers, using the Struere SDK (defineAgent, defineData, defineRole, defineTrigger, defineTools), running struere CLI commands, calling the Struere Chat API, or debugging agent behavior. Also triggers on imports from the 'struere' package."
metadata:
  author: struere
  version: 1.0.0
  category: developer-tools
---

${content}`
}
