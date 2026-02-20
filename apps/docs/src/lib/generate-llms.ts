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
    sections.push(doc.content.trim())
    sections.push("")
  }

  return sections.join("\n")
}
