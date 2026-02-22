"use client"

import { useRef, useEffect, useState } from "react"
import { Loader2, ChevronRight, Search, FileEdit, Terminal, Eye, Trash2, ArrowRightLeft, Brain, Zap, Globe, ToggleLeft, HelpCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { StudioMarkdown } from "./studio-markdown"
import type { ItemState, ContentPart } from "@/hooks/use-studio-events"

interface StudioMessageListProps {
  items: ItemState[]
  turnInProgress: boolean
}

export function StudioMessageList({ items, turnInProgress }: StudioMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [items, turnInProgress])

  if (items.length === 0 && !turnInProgress) {
    return (
      <div className="flex-1 flex items-center justify-center text-content-tertiary">
        <div className="text-center space-y-2">
          <Terminal className="h-8 w-8 mx-auto opacity-50" />
          <p className="text-sm font-mono">Send a message to begin</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 font-mono text-sm">
      {items.map((item) => (
        <ItemRenderer key={item.itemId} item={item} />
      ))}
      {turnInProgress && items.every((i) => i.kind !== "thinking" || i.status !== "in_progress") && (
        <div className="flex items-center gap-2 text-content-tertiary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Working...</span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}

function ItemRenderer({ item }: { item: ItemState }) {
  switch (item.kind) {
    case "message":
      return <MessageRow item={item} />
    case "tool_call":
      return <ToolCallRow item={item} />
    case "file_change":
      return <FileChangeRow item={item} />
    case "thinking":
      return <ThinkingRow item={item} />
    case "plan":
      return <PlanRow item={item} />
    default:
      return null
  }
}

function MessageRow({ item }: { item: ItemState }) {
  const isUser = item.role === "user"
  const isSystem = item.role === "system"
  const isStreaming = item.status === "in_progress"

  const textParts = item.content.filter((p) =>
    p.type === "text" || (p.type === "reasoning" && p.visibility !== "private")
  )
  const imageParts = item.content.filter((p) => p.type === "image")
  const displayText = textParts.map((p) => p.text ?? "").join("") + item.deltas.join("")

  if (isSystem) {
    return (
      <div className="flex items-center gap-2 py-1 text-content-tertiary text-xs">
        <AlertCircle className="h-3 w-3 shrink-0" />
        <span>{displayText}</span>
      </div>
    )
  }

  if (isUser) {
    return (
      <div className="py-1">
        <div className="flex items-start gap-2">
          <span className="shrink-0 text-ocean font-bold select-none">{">"}</span>
          <span className="text-content-primary whitespace-pre-wrap">{displayText}</span>
        </div>
      </div>
    )
  }

  if (!displayText && !isStreaming) return null

  return (
    <div className="py-1">
      {displayText && (
        <StudioMarkdown content={displayText} isStreaming={isStreaming} />
      )}
      {imageParts.length > 0 && (
        <div className="space-y-1 mt-1">
          {imageParts.map((part, i) => (
            <ImagePart key={`${item.itemId}-img-${i}`} part={part} />
          ))}
        </div>
      )}
    </div>
  )
}

const TOOL_KIND_ICONS: Record<string, typeof Terminal> = {
  read: Eye,
  edit: FileEdit,
  delete: Trash2,
  search: Search,
  execute: Terminal,
  think: Brain,
  fetch: Globe,
  switch_mode: ToggleLeft,
  move: ArrowRightLeft,
  other: Zap,
}

function ToolCallRow({ item }: { item: ItemState }) {
  const part = item.content[0]
  if (!part) return null

  const [expanded, setExpanded] = useState(false)
  const isActive = item.status === "in_progress"
  const isFailed = item.status === "failed"
  const isDone = item.status === "completed"

  const Icon = TOOL_KIND_ICONS[part.kind ?? "other"] ?? Zap
  const title = safeString(part.title || part.name || "Tool call")
  const locations = part.locations ?? []
  const primaryPath = locations[0]?.path ? safeString(locations[0].path) : undefined

  const outputSummary = getOutputSummary(part.rawOutput)
  const inputEmpty = isEmptyInput(part.rawInput)
  const inputPairs = !inputEmpty ? formatInputPairs(part.rawInput) : null
  const cleanOutput = part.rawOutput ? getCleanOutput(part.rawOutput) : null

  const hasDetail = !inputEmpty || (!!cleanOutput && cleanOutput.length > 0) || (part.toolContent && (part.toolContent as unknown[]).length > 0)

  return (
    <div className="py-0.5">
      <button
        onClick={() => hasDetail && setExpanded((v) => !v)}
        className={cn(
          "flex items-center gap-2 text-xs w-full text-left group",
          hasDetail && "cursor-pointer hover:text-content-primary",
          !hasDetail && "cursor-default",
        )}
      >
        {hasDetail && (
          <ChevronRight className={cn("h-3 w-3 shrink-0 text-content-tertiary transition-transform", expanded && "rotate-90")} />
        )}
        {!hasDetail && <span className="w-3" />}

        {isActive ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-ocean" />
        ) : isFailed ? (
          <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
        ) : (
          <Icon className={cn("h-3 w-3 shrink-0", isDone ? "text-success" : "text-content-tertiary")} />
        )}

        <span className={cn(
          "truncate",
          isActive ? "text-ocean" : isFailed ? "text-destructive" : "text-content-secondary",
        )}>
          {title}
        </span>

        {primaryPath && (
          <span className="text-content-tertiary truncate ml-1">{primaryPath}</span>
        )}

        {isActive ? (
          <span className="text-content-tertiary text-[10px] ml-auto shrink-0">running</span>
        ) : outputSummary ? (
          <span className="text-content-tertiary text-[10px] ml-auto shrink-0">{outputSummary}</span>
        ) : null}
      </button>

      {expanded && hasDetail && (
        <div className="ml-5 mt-1 rounded border bg-background-secondary overflow-hidden text-xs">
          {inputPairs && (
            <div className="px-3 py-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-content-secondary">
              {inputPairs.map(([k, v]) => (
                <span key={k}><span className="text-content-tertiary">{k}:</span> {v}</span>
              ))}
            </div>
          )}
          {!inputEmpty && !inputPairs && part.rawInput && (
            <pre className="px-3 py-2 text-content-secondary overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
              {tryFormatJson(part.rawInput)}
            </pre>
          )}
          {cleanOutput && cleanOutput.length > 0 && (
            <>
              {!inputEmpty && <div className="border-t" />}
              <pre className="px-3 py-2 text-content-secondary overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                {cleanOutput}
              </pre>
            </>
          )}
          {part.toolContent && renderToolContent(part.toolContent as unknown[])}
        </div>
      )}
    </div>
  )
}

function renderToolContent(content: unknown[]): React.ReactNode {
  return content.map((entry, i) => {
    if (!entry || typeof entry !== "object") return null
    const item = entry as Record<string, unknown>
    if (item.type === "diff") {
      const diff = safeString(item.newText ?? item.diff ?? "")
      const path = safeString(item.path)
      return (
        <div key={i} className="border-t">
          {path && (
            <div className="px-3 py-1 text-[10px] text-content-tertiary bg-background-tertiary">{path}</div>
          )}
          <div className="px-3 py-2 overflow-x-auto max-h-64 overflow-y-auto">
            {diff.split("\n").map((line, j) => (
              <div
                key={j}
                className={cn(
                  "whitespace-pre",
                  line.startsWith("+") && !line.startsWith("+++") && "text-success bg-success/10",
                  line.startsWith("-") && !line.startsWith("---") && "text-destructive bg-destructive/10",
                  line.startsWith("@@") && "text-ocean",
                )}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (item.type === "text") {
      return (
        <pre key={i} className="px-3 py-2 border-t text-content-secondary whitespace-pre-wrap max-h-48 overflow-y-auto">
          {safeString(item.text)}
        </pre>
      )
    }
    if (item.type === "terminal") {
      return (
        <div key={i} className="px-3 py-2 border-t text-content-tertiary text-[10px]">
          Terminal: {safeString(item.terminalId)}
        </div>
      )
    }
    return null
  })
}

function FileChangeRow({ item }: { item: ItemState }) {
  const part = item.content[0]
  if (!part) return null

  const [expanded, setExpanded] = useState(false)
  const hasDiff = !!part.diff

  return (
    <div className="py-0.5">
      <button
        onClick={() => hasDiff && setExpanded((v) => !v)}
        className={cn(
          "flex items-center gap-2 text-xs w-full text-left",
          hasDiff && "cursor-pointer hover:text-content-primary",
          !hasDiff && "cursor-default",
        )}
      >
        {hasDiff && (
          <ChevronRight className={cn("h-3 w-3 shrink-0 text-content-tertiary transition-transform", expanded && "rotate-90")} />
        )}
        {!hasDiff && <span className="w-3" />}
        <FileEdit className="h-3 w-3 shrink-0 text-success" />
        <span className="text-content-secondary truncate">{part.path}</span>
        {part.action && (
          <span className={cn(
            "text-[10px] ml-1",
            part.action === "write" && "text-success",
            part.action === "patch" && "text-warning",
            part.action === "read" && "text-ocean",
          )}>
            {part.action}
          </span>
        )}
      </button>
      {expanded && part.diff && (
        <div className="ml-5 mt-1 rounded border bg-background-secondary overflow-hidden text-xs">
          <div className="px-3 py-2 overflow-x-auto max-h-64 overflow-y-auto">
            {part.diff.split("\n").map((line, i) => (
              <div
                key={i}
                className={cn(
                  "whitespace-pre",
                  line.startsWith("+") && !line.startsWith("+++") && "text-success bg-success/10",
                  line.startsWith("-") && !line.startsWith("---") && "text-destructive bg-destructive/10",
                  line.startsWith("@@") && "text-ocean",
                )}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ThinkingRow({ item }: { item: ItemState }) {
  const isStreaming = item.status === "in_progress"
  const [expanded, setExpanded] = useState(isStreaming)

  useEffect(() => {
    if (isStreaming) setExpanded(true)
  }, [isStreaming])

  const textParts = item.content.filter((p) => p.type === "reasoning")
  const text = textParts.map((p) => p.text ?? "").join("") + item.deltas.join("")

  if (!text && !isStreaming) return null

  return (
    <div className="py-0.5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs text-content-tertiary hover:text-content-secondary transition-colors"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
        {isStreaming ? (
          <Loader2 className="h-3 w-3 animate-spin text-ocean" />
        ) : (
          <Brain className="h-3 w-3" />
        )}
        <span>Thinking{isStreaming ? "..." : ""}</span>
      </button>
      {expanded && text && (
        <div className="ml-5 mt-1 rounded border bg-background-secondary px-3 py-2 text-xs text-content-tertiary whitespace-pre-wrap max-h-48 overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  )
}

function PlanRow({ item }: { item: ItemState }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="py-0.5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs text-content-tertiary hover:text-content-secondary transition-colors"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
        <HelpCircle className="h-3 w-3" />
        <span>Plan ({item.content.length} steps)</span>
      </button>
      {expanded && (
        <div className="ml-5 mt-1 space-y-0.5 text-xs">
          {item.content.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                entry.toolStatus === "completed" && "bg-success",
                entry.toolStatus === "in_progress" && "bg-ocean animate-pulse",
                entry.toolStatus === "pending" && "bg-content-tertiary",
              )} />
              <span className="text-content-secondary">{entry.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ImagePart({ part }: { part: ContentPart }) {
  if (!part.path) return null
  return (
    <div className="rounded border bg-background-secondary overflow-hidden my-1 max-w-md">
      <img
        src={part.path}
        alt={part.path}
        className="max-w-full max-h-64 object-contain"
      />
      <div className="px-2 py-1 text-[10px] text-content-tertiary border-t truncate">
        {part.path}
      </div>
    </div>
  )
}

function safeString(val: unknown): string {
  if (typeof val === "string") return val
  if (val == null) return ""
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}

function tryFormatJson(val: unknown): string {
  const str = safeString(val)
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

function getOutputSummary(raw: unknown): string | null {
  const str = safeString(raw)
  try {
    const parsed = JSON.parse(str)
    if (!parsed?.metadata) return null
    const { count, matches } = parsed.metadata
    if (typeof count === "number") return `${count} file${count !== 1 ? "s" : ""}`
    if (typeof matches === "number") return `${matches} match${matches !== 1 ? "es" : ""}`
  } catch {}
  return null
}

function getCleanOutput(raw: unknown): string {
  const str = safeString(raw)
  try {
    const parsed = JSON.parse(str)
    if (typeof parsed?.output === "string") {
      return parsed.output
        .replace(/<path>.*?<\/path>\s*/g, "")
        .replace(/<type>.*?<\/type>\s*/g, "")
        .replace(/<content>\n?/g, "")
        .replace(/\n?<\/content>/g, "")
        .replace(/\n?\(End of file[^)]*\)\s*$/g, "")
        .trim()
    }
  } catch {}
  return str
}

function isEmptyInput(raw: unknown): boolean {
  const str = safeString(raw).trim()
  return !str || str === "{}" || str === "null"
}

function formatInputPairs(raw: unknown): [string, string][] | null {
  const str = safeString(raw)
  try {
    const parsed = JSON.parse(str)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    const entries = Object.entries(parsed)
    if (entries.length === 0 || entries.length > 5) return null
    const pairs: [string, string][] = []
    for (const [k, v] of entries) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        pairs.push([k, String(v)])
      } else {
        return null
      }
    }
    return pairs
  } catch {}
  return null
}
