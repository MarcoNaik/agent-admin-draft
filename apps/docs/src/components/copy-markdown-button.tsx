"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

export function CopyMarkdownButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      const res = await fetch(`/${slug}.md`)
      if (!res.ok) return
      const text = await res.text()
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // silently fail
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-forest-muted hover:text-forest border border-forest/15 hover:border-forest/30 rounded transition-all"
    >
      {copied ? (
        <>
          <Check size={12} />
          Copied
        </>
      ) : (
        <>
          <Copy size={12} />
          Copy as Markdown
        </>
      )}
    </button>
  )
}
