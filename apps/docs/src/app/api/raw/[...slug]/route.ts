import { getRawMarkdown, getAllDocs } from "@/lib/content"

export const dynamic = "force-static"

export async function generateStaticParams() {
  const docs = getAllDocs()
  return docs.map((doc) => ({
    slug: doc.slug.split("/"),
  }))
}

export async function GET(_request: Request, { params }: { params: { slug: string[] } }) {
  const slug = params.slug.join("/")
  const markdown = getRawMarkdown(slug)

  if (!markdown) {
    return new Response("Not found", { status: 404 })
  }

  return new Response(markdown, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  })
}
