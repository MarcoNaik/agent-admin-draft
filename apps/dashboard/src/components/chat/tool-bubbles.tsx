"use client"

import { useState } from "react"
import { Wrench, CheckCircle2 } from "lucide-react"

interface ToolCall {
  id: string
  name: string
  arguments: unknown
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "..."
}

export function ToolCallBubble({ name, arguments: args }: { name: string; arguments: unknown }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-md border border-ocean/10 bg-ocean/5 p-2.5 max-w-2xl mx-auto transition-all ease-out-soft">
      <div className="flex items-center gap-2">
        <Wrench className="h-3.5 w-3.5 text-ocean shrink-0" />
        <span className="text-xs font-medium text-ocean">{name}</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-content-tertiary hover:text-content-secondary ml-auto transition-colors ease-out-soft"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>
      {expanded && (
        <pre className="mt-2 text-xs bg-background-tertiary rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
          {JSON.stringify(args, null, 2)}
        </pre>
      )}
    </div>
  )
}

export function ToolResultBubble({
  toolCallId,
  content,
  allMessages,
}: {
  toolCallId: string
  content: string
  allMessages: Array<{ role: string; toolCalls?: ToolCall[]; toolCallId?: string }>
}) {
  const [expanded, setExpanded] = useState(false)

  let toolName = "tool"
  for (const m of allMessages) {
    if (m.role === "assistant" && m.toolCalls) {
      const match = m.toolCalls.find((tc) => tc.id === toolCallId)
      if (match) {
        toolName = match.name
        break
      }
    }
  }

  let parsed: string
  try {
    parsed = JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    parsed = content
  }

  return (
    <div className="rounded-md border border-ocean/10 bg-ocean/5 p-2.5 max-w-2xl mx-auto transition-all ease-out-soft">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
        <span className="text-xs font-medium text-ocean">{toolName}</span>
        <span className="text-xs text-content-tertiary">Result</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-content-tertiary hover:text-content-secondary ml-auto transition-colors ease-out-soft"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>
      {expanded && (
        <pre className="mt-2 text-xs bg-background-tertiary rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
          {truncateText(parsed, 500)}
        </pre>
      )}
    </div>
  )
}
