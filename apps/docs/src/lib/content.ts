import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkRehype from "remark-rehype"
import rehypeHighlight from "rehype-highlight"
import rehypeSlug from "rehype-slug"
import rehypeStringify from "rehype-stringify"

const CONTENT_DIR = path.join(process.cwd(), "content")

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeHighlight)
  .use(rehypeSlug)
  .use(rehypeStringify)

export interface DocPage {
  slug: string
  title: string
  description: string
  section: string
  order: number
  content: string
  html: string
  rawContent: string
}

function isValidSlug(slug: string): boolean {
  if (slug.includes("..") || path.isAbsolute(slug)) return false
  const resolved = path.resolve(CONTENT_DIR, `${slug}.md`)
  return resolved.startsWith(CONTENT_DIR + path.sep)
}

function stripLeadingHeading(content: string): string {
  return content.replace(/^\s*# .+\n*/, "")
}

export function getDocBySlug(slug: string): DocPage | null {
  if (!isValidSlug(slug)) return null
  const filePath = path.join(CONTENT_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, "utf-8")
  const { data, content } = matter(raw)
  const stripped = stripLeadingHeading(content)
  const html = processor.processSync(stripped).toString()

  return {
    slug,
    title: data.title ?? "",
    description: data.description ?? "",
    section: data.section ?? "",
    order: data.order ?? 0,
    content: stripped,
    html,
    rawContent: raw,
  }
}

export function getAllDocs(): DocPage[] {
  const docs: DocPage[] = []

  function walk(dir: string, prefix: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name)
      } else if (entry.name.endsWith(".md")) {
        const slug = prefix
          ? `${prefix}/${entry.name.replace(/\.md$/, "")}`
          : entry.name.replace(/\.md$/, "")
        const doc = getDocBySlug(slug)
        if (doc) docs.push(doc)
      }
    }
  }

  walk(CONTENT_DIR, "")
  return docs.sort((a, b) => {
    const sectionOrder = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)
    if (sectionOrder !== 0) return sectionOrder
    return a.order - b.order
  })
}

export function getRawMarkdown(slug: string): string | null {
  if (!isValidSlug(slug)) return null
  const filePath = path.join(CONTENT_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, "utf-8")
  const { content, data } = matter(raw)
  const stripped = stripLeadingHeading(content)
  return `# ${data.title}\n\n${data.description ? `> ${data.description}\n\n` : ""}${stripped}`
}

const SECTION_ORDER = [
  "Getting Started",
  "API Reference",
  "SDK",
  "Tools",
  "Platform Concepts",
  "Integrations",
  "CLI",
  "Knowledge Base",
  "Reference",
]

export { SECTION_ORDER }
