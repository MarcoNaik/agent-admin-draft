import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getDocBySlug, getAllDocs } from "@/lib/content"
import { getPrevNext } from "@/lib/navigation"
import { TableOfContents } from "@/components/table-of-contents"
import { Breadcrumb } from "@/components/breadcrumb"
import { CopyMarkdownButton } from "@/components/copy-markdown-button"
import { PrevNextNav } from "@/components/prev-next-nav"
import { CodeCopyButtons } from "@/components/code-copy-buttons"

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
    <div className="flex gap-10 px-6 py-8 lg:px-16 lg:py-12">
      <article className="flex-1 min-w-0 max-w-none">
        <Breadcrumb section={doc.section} title={doc.title} />
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-charcoal-heading font-display tracking-tight">{doc.title}</h1>
            {doc.description && (
              <p className="mt-2 text-base text-content-secondary">{doc.description}</p>
            )}
          </div>
          <CopyMarkdownButton slug={slug} />
        </div>
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: doc.html }} />
        <CodeCopyButtons />
        <PrevNextNav prev={prev} next={next} />
      </article>
      <TableOfContents content={doc.content} />
    </div>
  )
}
