"use client"

import { useState } from "react"
import { ChevronRight, Check, Copy } from "@/lib/icons"

const ONBOARDING_PROMPT = `I want to set up a Struere project (https://struere.dev) — an AI agent platform where I define agents, data types, roles, and automations as TypeScript code.

Step 1: Install the Struere CLI globally
  bun install -g struere

Step 2: Initialize and pull my project
  struere pull
  (This will open a browser to log in, let me select my organization, create the project structure, and download any existing agent configurations)

Step 3: Install the Struere developer skill for coding agents
  npx skills add MarcoNaik/struere-skill --all --yes

After completing these steps, show me the project structure and summarize what was set up. If any step fails, show me the error and suggest a fix.

Documentation: https://docs.struere.dev/llms.txt`

export function CliPromptToggle({
  initialOpen = false,
  label = "Set up locally with your own coding agent (optional)",
  expandedLabel = "Copy this prompt into Claude Code, Cursor, or any coding agent:",
  compact = false,
}: {
  initialOpen?: boolean
  label?: string
  expandedLabel?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(initialOpen)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(ONBOARDING_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 text-xs transition-colors ${
          open
            ? "text-content-secondary font-medium"
            : "text-content-tertiary hover:text-content-secondary"
        }`}
      >
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
        {open ? expandedLabel : label}
      </button>
      {open && (
        <div className="relative mt-2">
          <pre className={`text-left text-content-tertiary font-mono whitespace-pre-wrap bg-background-tertiary/50 border border-border/30 rounded-lg pr-10 max-h-48 overflow-y-auto ${compact ? "text-[10px] p-2" : "text-xs p-3"}`}>
            {ONBOARDING_PROMPT}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-background-secondary/80 hover:bg-background-secondary text-content-tertiary hover:text-content-secondary transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
