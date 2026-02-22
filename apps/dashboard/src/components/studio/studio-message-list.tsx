"use client"

import { useRef, useEffect } from "react"
import { Bot, User, Loader2, Brain, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { ToolCallCard } from "./studio-tool-activity"
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

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "shrink-0 h-7 w-7 rounded-full flex items-center justify-center",
          isUser ? "bg-primary" : "bg-muted"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-content-tertiary" />
        )}
      </div>

      <div className={cn("max-w-[80%] space-y-1", isUser && "items-end")}>
        {displayText && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-content-primary"
            )}
          >
            {displayText}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-current opacity-50 animate-pulse ml-0.5 align-text-bottom" />
            )}
          </div>
        )}

        {imageParts.length > 0 && (
          <div className="space-y-1">
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

  return (
    <div className="pl-10">
      <ToolCallCard part={part} />
    </div>
  )
}

function ThinkingBlock({ item }: { item: ItemState }) {
  const isStreaming = item.status === "in_progress"

  const textParts = item.content.filter((p) => p.type === "reasoning")
  const text = textParts.map((p) => p.text ?? "").join("") + item.deltas.join("")

  if (!text) return null

  return (
    <div className="pl-10">
      <div className="flex items-center gap-2 text-xs text-content-tertiary mb-1">
        <Brain className="h-3 w-3" />
        <span>Thinking{isStreaming ? "..." : ""}</span>
        {isStreaming && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
      <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-content-tertiary whitespace-pre-wrap max-h-48 overflow-y-auto">
        {text}
      </div>
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
