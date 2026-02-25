import { getRawMarkdown, getAllDocs } from "@/lib/content"
import { generateLlmsTxt } from "@/lib/generate-llms"

export const dynamicParams = true

export async function generateStaticParams() {
  const docs = getAllDocs()
  return docs.map((doc) => ({
    slug: doc.slug.split("/"),
  }))
}

export async function GET(_request: Request, { params }: { params: { slug: string[] } }) {
  const slug = params.slug.join("/")
  const markdown = getRawMarkdown(slug)

  if (markdown) {
    return new Response(markdown, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    })
  }

  const lastSegment = slug.split("/").pop() || ""
  const allDocs = getAllDocs()
  const match = allDocs.find(d => d.slug === lastSegment || d.slug.endsWith(`/${lastSegment}`))
  if (match) {
    const matched = getRawMarkdown(match.slug)
    if (matched) {
      return new Response(matched, {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      })
    }
  }

  const index = generateLlmsTxt()
  return new Response(index, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
