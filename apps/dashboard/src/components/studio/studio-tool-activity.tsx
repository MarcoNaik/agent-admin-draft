"use client"

import { Terminal, FileCode, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ContentPart } from "@/hooks/use-studio-events"

export function ToolCallCard({ part }: { part: ContentPart }) {
  if (part.type === "tool_call") {
    return (
      <div className="rounded-md border bg-background overflow-hidden text-xs my-1">
        <div className="flex items-center gap-2 px-3 py-2 text-left">
          <Terminal className="h-3 w-3 shrink-0 text-content-tertiary" />
          <span className="text-content-primary font-mono">{part.name}</span>
        </div>
        {part.arguments && (
          <pre className="px-3 py-2 border-t bg-neutral-950 text-neutral-300 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
            {tryFormatJson(part.arguments)}
          </pre>
        )}
      </div>
    )
  }

  if (part.type === "tool_result") {
    return (
      <div className="rounded-md border bg-background overflow-hidden text-xs my-1">
        <div className="flex items-center gap-2 px-3 py-2 text-left">
          <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
          <span className="text-content-secondary">Result</span>
        </div>
        {part.output && (
          <pre className="px-3 py-2 border-t bg-neutral-950 text-neutral-300 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
            {part.output}
          </pre>
        )}
      </div>
    )
  }

  if (part.type === "file_ref") {
    return (
      <div className="rounded-md border bg-background overflow-hidden text-xs my-1">
        <div className="flex items-center gap-2 px-3 py-2 text-left">
          <FileCode className="h-3 w-3 shrink-0 text-blue-400" />
          <span className="text-content-primary font-mono">{part.path}</span>
          {part.action && (
            <span className={cn(
              "ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium",
              part.action === "write" && "bg-green-500/20 text-green-400",
              part.action === "patch" && "bg-yellow-500/20 text-yellow-400",
              part.action === "read" && "bg-blue-500/20 text-blue-400",
            )}>
              {part.action}
            </span>
          )}
        </div>
        {part.diff && (
          <pre className="px-3 py-2 border-t bg-neutral-950 text-neutral-300 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
            {part.diff}
          </pre>
        )}
      </div>
    )
  }

  if (part.type === "status") {
    return (
      <div className="flex items-center gap-2 text-xs text-content-tertiary py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span>{part.label}</span>
        {part.detail && <span className="text-content-tertiary">— {part.detail}</span>}
      </div>
    )
  }

  return null
}

function tryFormatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}
