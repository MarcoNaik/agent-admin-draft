import { getAllDocs } from "./content"

const BASE_URL = "https://docs.struere.dev"

const SECTION_MAP: Record<string, string[]> = {
  sdk: ["SDK"],
  api: ["API Reference"],
  cli: ["CLI"],
  platform: ["Platform Concepts"],
  tools: ["Tools"],
  integrations: ["Integrations"],
}

export function generateSectionLlmsTxt(sectionKey: string): string {
  const sectionNames = SECTION_MAP[sectionKey]
  if (!sectionNames) return ""

  const docs = getAllDocs().filter((d) => sectionNames.includes(d.section))
  const lines: string[] = [
    `# Struere Documentation — ${sectionNames.join(", ")}`,
    "",
    `> Filtered section from the Struere docs. Full docs: ${BASE_URL}/llms.txt`,
    "",
  ]

  for (const doc of docs) {
    lines.push("---")
    lines.push("")
    lines.push(`## ${doc.title}`)
    if (doc.description) {
      lines.push("")
      lines.push(`> ${doc.description}`)
    }
    lines.push("")
    lines.push(`Source: ${BASE_URL}/${doc.slug}.md`)
    lines.push("")
    lines.push(doc.content.trim())
    lines.push("")
  }

  return lines.join("\n")
}
