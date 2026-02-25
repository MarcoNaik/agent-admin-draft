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
    `${BASE_URL}/llms-sdk.txt — Agent, entity type, role, trigger definitions`,
    `${BASE_URL}/llms-tools.txt — Built-in tools, custom tools, system prompt templates`,
    `${BASE_URL}/llms-platform.txt — Entities, agents, triggers, events, permissions, evals`,
    `${BASE_URL}/llms-integrations.txt — WhatsApp, Google Calendar, Flow payments, Airtable`,
    `${BASE_URL}/llms-cli.txt — CLI reference`,
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
  lines.push("- SDK exports: `defineAgent`, `defineTools`, `defineConfig`, `defineEntityType`, `defineRole`, `defineTrigger`")
  lines.push("- Default model: `grok-4-1-fast` (provider: `xai`)")
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

export { API_QUICK_START }
