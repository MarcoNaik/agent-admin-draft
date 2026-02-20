import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getDocBySlug, getAllDocs } from "@/lib/content"
import { getPrevNext } from "@/lib/navigation"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { TableOfContents } from "@/components/table-of-contents"
import { Breadcrumb } from "@/components/breadcrumb"
import { CopyMarkdownButton } from "@/components/copy-markdown-button"
import { PrevNextNav } from "@/components/prev-next-nav"

export const dynamicParams = false

interface PageProps {
  params: { slug: string[] }
}

export async function generateStaticParams() {
  const docs = getAllDocs()
  return docs.map((doc) => ({
    slug: doc.slug.split("/"),
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = params.slug.join("/")
  const doc = getDocBySlug(slug)
  if (!doc) return {}

  const url = `https://docs.struere.dev/${slug}`
  return {
    title: doc.title,
    description: doc.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: doc.title,
      description: doc.description,
      url,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: doc.title,
      description: doc.description,
    },
  }
}

export default function DocPage({ params }: PageProps) {
  const slug = params.slug.join("/")
  const doc = getDocBySlug(slug)

  if (!doc) notFound()

  const { prev, next } = getPrevNext(slug)

  return (
    <div className="flex gap-8 px-6 py-8 lg:px-12 lg:py-10 max-w-5xl">
      <article className="flex-1 min-w-0 max-w-3xl">
        <Breadcrumb section={doc.section} title={doc.title} />
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-forest">{doc.title}</h1>
            {doc.description && (
              <p className="mt-1 text-sm text-forest-muted">{doc.description}</p>
            )}
          </div>
          <CopyMarkdownButton slug={slug} />
        </div>
        <MarkdownRenderer content={doc.content} />
        <PrevNextNav prev={prev} next={next} />
      </article>
      <TableOfContents content={doc.content} />
    </div>
  )
}
