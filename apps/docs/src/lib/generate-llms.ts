import { getAllDocs } from "./content"

const BASE_URL = "https://docs.struere.dev"

export function generateLlmsTxt(): string {
  const docs = getAllDocs()
  const lines: string[] = [
    "# Struere Documentation",
    "",
    "> Struere is a permission-aware AI agent platform. Build, deploy, and manage AI agents with role-based access control, entity management, and multi-agent communication.",
    "",
    `Docs: ${BASE_URL}`,
    "",
    "## Quick Reference",
    "",
    "- **Default model**: `grok-4-1-fast` (provider: `xai`)",
    "- **SDK exports**: `defineAgent`, `defineTools`, `defineConfig`, `defineEntityType`, `defineRole`, `defineTrigger`",
    "- **Built-in tools**: entity.create, entity.get, entity.query, entity.update, entity.delete, entity.link, entity.unlink, event.emit, event.query, calendar.list, calendar.create, calendar.update, calendar.delete, calendar.freeBusy, whatsapp.send, whatsapp.getConversation, whatsapp.getStatus, agent.chat",
    "- **Environments**: `development`, `production`, `eval` — fully isolated data, roles, and configs",
    "- **CLI commands**: `init`, `dev`, `deploy`, `add`, `status`, `pull`, `entities`, `login`, `logout`, `whoami`",
    "- **Auth**: Clerk with Convex integration, API keys prefixed `sk_dev_` / `sk_prod_`",
    "- **Package manager**: Bun",
    "",
    "## Section Files",
    "",
    `- [SDK](${BASE_URL}/llms-sdk.txt): Agent, entity type, role, trigger definitions`,
    `- [API](${BASE_URL}/llms-api.txt): HTTP endpoints, chat API, webhooks`,
    `- [CLI](${BASE_URL}/llms-cli.txt): Command-line interface reference`,
    `- [Platform](${BASE_URL}/llms-platform.txt): Agents, entities, permissions, events, triggers, evals`,
    `- [Tools](${BASE_URL}/llms-tools.txt): Built-in tools, custom tools, system prompt templates`,
    `- [Integrations](${BASE_URL}/llms-integrations.txt): WhatsApp, Google Calendar, Flow payments`,
    "",
    "## Pages",
    "",
  ]

  let currentSection = ""
  for (const doc of docs) {
    if (doc.section !== currentSection) {
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
    "> This file contains the complete Struere documentation.",
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
    sections.push(`Source: ${BASE_URL}/${doc.slug}.md`)
    sections.push("")
    sections.push(doc.content.trim())
    sections.push("")
  }

  return sections.join("\n")
}
