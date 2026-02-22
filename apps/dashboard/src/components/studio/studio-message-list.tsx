"use client"

import { useRef, useEffect, useState } from "react"
import { Bot, User, Loader2, Brain, AlertCircle, ChevronRight, FileCode } from "lucide-react"
import { cn } from "@/lib/utils"
import { ToolCallCard } from "./studio-tool-activity"
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
          <Bot className="h-8 w-8 mx-auto opacity-50" />
          <p className="text-sm">Start a session and send a message to begin</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {items.map((item) => (
        <ItemRenderer key={item.itemId} item={item} />
      ))}
      {turnInProgress && (
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-content-tertiary" />
          </div>
          <div className="text-sm text-content-tertiary animate-pulse">
            Thinking...
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}

function ItemRenderer({ item }: { item: ItemState }) {
  switch (item.kind) {
    case "message":
      return <MessageBubble item={item} />
    case "tool_call":
      return <ToolCallItem item={item} />
    case "file_change":
      return <FileChangeItem item={item} />
    case "thinking":
      return <ThinkingBlock item={item} />
    default:
      return null
  }
}

function MessageBubble({ item }: { item: ItemState }) {
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
      <div className="flex items-center justify-center gap-2 py-2">
        <AlertCircle className="h-3.5 w-3.5 text-content-tertiary" />
        <span className="text-xs text-content-tertiary">{displayText}</span>
      </div>
    )
  }

  if (isUser) {
    return (
      <div className="flex items-start gap-3 flex-row-reverse">
        <div className="shrink-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="max-w-[80%] items-end">
          {displayText && (
            <div className="rounded-lg px-3 py-2 text-sm whitespace-pre-wrap bg-primary text-primary-foreground">
              {displayText}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
        <Bot className="h-4 w-4 text-content-tertiary" />
      </div>

      <div className="min-w-0 flex-1">
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
    </div>
  )
}

function ToolCallItem({ item }: { item: ItemState }) {
  const part = item.content[0]
  if (!part) return null

  return (
    <div className="pl-10">
      <ToolCallCard part={part} />
      {item.status === "in_progress" && (
        <div className="flex items-center gap-1.5 mt-1 text-xs text-content-tertiary">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Running...</span>
        </div>
      )}
    </div>
  )
}

function FileChangeItem({ item }: { item: ItemState }) {
  const part = item.content[0]
  if (!part) return null

  const diff = part.diff

  return (
    <div className="pl-10">
      <div className="rounded-md border bg-background overflow-hidden text-xs my-1">
        <div className="flex items-center gap-2 px-3 py-2 text-left">
          <FileCode className="h-3 w-3 shrink-0 text-ocean" />
          <span className="text-content-primary font-mono">{part.path}</span>
          {part.action && (
            <span className={cn(
              "ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium",
              part.action === "write" && "bg-success/20 text-success",
              part.action === "patch" && "bg-warning/20 text-warning",
              part.action === "read" && "bg-ocean/20 text-ocean",
            )}>
              {part.action}
            </span>
          )}
        </div>
        {diff && (
          <div className="border-t bg-background px-3 py-2 overflow-x-auto max-h-64 overflow-y-auto font-mono text-xs">
            {diff.split("\n").map((line, i) => (
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
        )}
      </div>
    </div>
  )
}

function ThinkingBlock({ item }: { item: ItemState }) {
  const isStreaming = item.status === "in_progress"
  const [expanded, setExpanded] = useState(isStreaming)

  useEffect(() => {
    if (isStreaming) setExpanded(true)
  }, [isStreaming])

  const textParts = item.content.filter((p) => p.type === "reasoning")
  const text = textParts.map((p) => p.text ?? "").join("") + item.deltas.join("")

  if (!text) return null

  return (
    <div className="pl-10">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs text-content-tertiary mb-1 hover:text-content-secondary transition-colors"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
        <Brain className="h-3 w-3" />
        <span>Thinking{isStreaming ? "..." : ""}</span>
        {isStreaming && <Loader2 className="h-3 w-3 animate-spin" />}
      </button>
      {expanded && (
        <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-content-tertiary whitespace-pre-wrap max-h-48 overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  )
}

function ImagePart({ part }: { part: ContentPart }) {
  if (!part.path) return null
  return (
    <div className="rounded-md border bg-background overflow-hidden my-1">
      <img
        src={part.path}
        alt={part.path}
        className="max-w-full max-h-64 object-contain"
      />
      <div className="px-2 py-1 text-[10px] text-content-tertiary font-mono border-t truncate">
        {part.path}
      </div>
    </div>
  )
}
