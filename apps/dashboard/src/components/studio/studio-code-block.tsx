"use client"

import { useState, useCallback } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

interface StudioCodeBlockProps {
  className?: string
  children?: React.ReactNode
}

export function StudioCodeBlock({ className, children, ...props }: StudioCodeBlockProps & Record<string, unknown>) {
  const [copied, setCopied] = useState(false)

  const lang = className?.replace(/^language-/, "") ?? ""

  const extractText = (node: React.ReactNode): string => {
    if (typeof node === "string") return node
    if (typeof node === "number") return String(node)
    if (!node) return ""
    if (Array.isArray(node)) return node.map(extractText).join("")
    if (typeof node === "object" && "props" in node) {
      return extractText((node as React.ReactElement).props.children)
    }
    return ""
  }

  const handleCopy = useCallback(() => {
    const text = extractText(children)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [children])

  return (
    <div className="group relative">
      {lang && (
        <div className="absolute top-0 left-3 px-2 py-0.5 text-[10px] text-content-tertiary font-mono select-none">
          {lang}
        </div>
      )}
      <button
        onClick={handleCopy}
        className={cn(
          "absolute top-1.5 right-2 p-1 rounded transition-opacity",
          "opacity-0 group-hover:opacity-100",
          "text-content-tertiary hover:text-content-primary hover:bg-muted"
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <code className={cn(className, "text-xs")} {...props}>
        {children}
      </code>
    </div>
  )
}
