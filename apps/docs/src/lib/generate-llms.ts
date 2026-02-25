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
    "# Struere Documentation",
    "",
    "> Struere is an AI agent platform with a built-in data layer, dynamic system prompts, event-driven automation, and integrations. Define agents, entity types, and triggers as TypeScript code — talk to agents via HTTP API.",
    "",
    `Docs: ${BASE_URL}`,
    "",
    API_QUICK_START,
    "",
    "## Quick Reference",
    "",
    "- **Chat endpoint**: `POST /v1/agents/:slug/chat` with Bearer token",
    "- **Built-in tools**: entity.create, entity.get, entity.query, entity.update, entity.delete, entity.link, entity.unlink, event.emit, event.query, calendar.list, calendar.create, calendar.update, calendar.delete, calendar.freeBusy, whatsapp.send, whatsapp.getConversation, whatsapp.getStatus, airtable.listBases, airtable.listTables, airtable.listRecords, airtable.getRecord, airtable.createRecords, airtable.updateRecords, airtable.deleteRecords, agent.chat",
    "- **SDK exports**: `defineAgent`, `defineTools`, `defineConfig`, `defineEntityType`, `defineRole`, `defineTrigger`",
    "- **Default model**: `grok-4-1-fast` (provider: `xai`)",
    "- **Environments**: `development`, `production`, `eval` — fully isolated data, roles, and configs",
    "- **Auth**: API keys prefixed `sk_dev_` / `sk_prod_`, Clerk for dashboard",
    "- **CLI commands**: `init`, `dev`, `deploy`, `add`, `status`, `pull`, `entities`, `login`, `logout`, `whoami`",
    "- **Package manager**: Bun",
    "",
    "## Section Files",
    "",
    `- [API](${BASE_URL}/llms-api.txt): Chat API, HTTP endpoints, webhooks`,
    `- [SDK](${BASE_URL}/llms-sdk.txt): Agent, entity type, role, trigger definitions`,
    `- [Tools](${BASE_URL}/llms-tools.txt): Built-in tools, custom tools, system prompt templates`,
    `- [Platform](${BASE_URL}/llms-platform.txt): Entities, agents, triggers, events, permissions, evals`,
    `- [Integrations](${BASE_URL}/llms-integrations.txt): WhatsApp, Google Calendar, Flow payments, Airtable`,
    `- [CLI](${BASE_URL}/llms-cli.txt): Command-line interface reference`,
    "",
    "## Pages",
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
    lines.push(`- [${doc.title}](${BASE_URL}/${doc.slug}.md): ${doc.description}`)
  }

  lines.push("")
  lines.push("## Full Documentation")
  lines.push("")
  lines.push(`For the complete documentation in a single file, see: ${BASE_URL}/llms-full.txt`)
  lines.push("")
  lines.push("## Machine-Readable")
  lines.push("")
  lines.push(`- [OpenAPI Spec](${BASE_URL}/openapi.yaml): Chat API endpoints (YAML)`)
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

export { API_QUICK_START }
