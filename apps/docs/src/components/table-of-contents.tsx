"use client"

import { useEffect, useState, useMemo } from "react"
import GithubSlugger from "github-slugger"

interface TocItem {
  id: string
  text: string
  level: number
}

export function TableOfContents({ content }: { content: string }) {
  const [activeId, setActiveId] = useState("")
  const headings = useMemo(() => extractHeadings(content), [content])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: "-80px 0px -80% 0px" }
    )

    for (const h of headings) {
      const el = document.getElementById(h.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  return (
    <aside className="hidden xl:block w-56 shrink-0">
      <div className="sticky top-8">
        <h4 className="text-xs font-bold uppercase tracking-wider text-forest-muted mb-3">
          On this page
        </h4>
        <nav className="flex flex-col gap-1">
          {headings.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              className={`text-xs py-0.5 transition-colors ${
                h.level === 3 ? "pl-3" : ""
              } ${
                activeId === h.id
                  ? "text-forest font-medium"
                  : "text-forest-muted hover:text-forest"
              }`}
            >
              {h.text}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  )
}

function extractHeadings(content: string): TocItem[] {
  const slugger = new GithubSlugger()
  const headings: TocItem[] = []
  const lines = content.split("\n")
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].replace(/`/g, "")
      const id = slugger.slug(text)
      headings.push({ id, text, level })
    }
  }
  return headings
}
