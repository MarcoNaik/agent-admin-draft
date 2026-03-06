"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, X, FileText, ArrowRight } from "lucide-react"

interface SearchEntry {
  slug: string
  title: string
  description: string
  section: string
  content: string
}

interface SearchResult {
  slug: string
  title: string
  section: string
  snippet: string
}

const SEARCH_OPEN_EVENT = "struere:search:open"

export function openSearch() {
  window.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT))
}

function getSnippet(content: string, query: string): string {
  const lower = content.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return content.slice(0, 120) + "..."
  const start = Math.max(0, idx - 50)
  const end = Math.min(content.length, idx + query.length + 70)
  let snippet = content.slice(start, end)
  if (start > 0) snippet = "..." + snippet
  if (end < content.length) snippet = snippet + "..."
  return snippet
}

function searchDocs(entries: SearchEntry[], query: string): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase().trim()
  const words = q.split(/\s+/).filter(Boolean)

  const scored: { result: SearchResult; score: number }[] = []

  for (const entry of entries) {
    const titleLower = entry.title.toLowerCase()
    const descLower = entry.description.toLowerCase()
    const contentLower = entry.content.toLowerCase()

    let score = 0

    for (const word of words) {
      if (titleLower.includes(word)) score += 10
      if (descLower.includes(word)) score += 5
      if (contentLower.includes(word)) score += 1
    }

    if (titleLower.includes(q)) score += 20
    if (descLower.includes(q)) score += 10

    if (score > 0) {
      scored.push({
        result: {
          slug: entry.slug,
          title: entry.title,
          section: entry.section,
          snippet: getSnippet(entry.content, words[0]),
        },
        score,
      })
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s) => s.result)
}

export function SearchTrigger() {
  return (
    <button
      onClick={() => openSearch()}
      className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[13px] text-content-tertiary rounded border border-border hover:border-ocean/30 transition-colors bg-background"
    >
      <Search size={14} />
      <span className="flex-1 text-left">Search...</span>
      <kbd className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-background-secondary border border-border text-content-tertiary">
        ⌘K
      </kbd>
    </button>
  )
}

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [index, setIndex] = useState<SearchEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/search-index")
      .then((r) => r.json())
      .then(setIndex)
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }
    }
    function onOpenEvent() {
      setOpen(true)
    }
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener(SEARCH_OPEN_EVENT, onOpenEvent)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener(SEARCH_OPEN_EVENT, onOpenEvent)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setResults(searchDocs(index, query))
    setActiveIndex(0)
  }, [query, index])

  const navigate = useCallback(
    (slug: string) => {
      setOpen(false)
      router.push(`/${slug}`)
    },
    [router]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter" && results[activeIndex]) {
        navigate(results[activeIndex].slug)
      }
    },
    [results, activeIndex, navigate]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div
        className="fixed inset-0 bg-charcoal/20 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-lg mx-4 bg-background rounded-xl border border-border shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-content-tertiary shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search documentation..."
            className="flex-1 bg-transparent text-sm text-charcoal placeholder:text-content-tertiary outline-none"
          />
          <button
            onClick={() => setOpen(false)}
            className="text-content-tertiary hover:text-charcoal transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-content-tertiary">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.length > 0 && (
            <ul className="py-2">
              {results.map((result, i) => (
                <li key={result.slug}>
                  <button
                    onClick={() => navigate(result.slug)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                      i === activeIndex
                        ? "bg-ocean/[0.06]"
                        : "hover:bg-ocean/[0.03]"
                    }`}
                  >
                    <FileText size={16} className="text-content-tertiary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-charcoal-heading truncate">
                          {result.title}
                        </span>
                        <span className="text-[10px] text-content-tertiary bg-background-secondary px-1.5 py-0.5 rounded shrink-0">
                          {result.section}
                        </span>
                      </div>
                      <p className="text-xs text-content-secondary mt-0.5 line-clamp-1">
                        {result.snippet}
                      </p>
                    </div>
                    {i === activeIndex && (
                      <ArrowRight size={14} className="text-ocean mt-0.5 shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!query && (
            <div className="px-4 py-8 text-center text-xs text-content-tertiary">
              Type to search across all documentation
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-content-tertiary">
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1 py-0.5 rounded bg-background-secondary border border-border">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1 py-0.5 rounded bg-background-secondary border border-border">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1 py-0.5 rounded bg-background-secondary border border-border">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  )
}
