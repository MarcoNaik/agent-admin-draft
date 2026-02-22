"use client"

import { useState, useRef, ReactNode, isValidElement, Children } from "react"
import { Copy, Check } from "lucide-react"

export function CodeBlock({ children, ...props }: { children: ReactNode; [key: string]: unknown }) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  const codeChild = Children.toArray(children).find(
    (child) => isValidElement(child) && child.type === "code"
  )
  const language = isValidElement(codeChild)
    ? (codeChild.props as { className?: string }).className
        ?.split(" ")
        .find((c: string) => c.startsWith("language-"))
        ?.replace("language-", "") ?? ""
    : ""

  async function handleCopy() {
    try {
      const text = preRef.current?.textContent ?? ""
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable
    }
  }

  return (
    <div className="relative group">
      {language && (
        <span className="absolute top-2.5 left-4 text-[10px] uppercase tracking-wider text-white/30 font-mono">
          {language}
        </span>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-2.5 right-3 p-1.5 rounded bg-white/10 text-white/50 hover:text-white/80 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        aria-label="Copy code"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <pre ref={preRef} {...props}>{children}</pre>
    </div>
  )
}
