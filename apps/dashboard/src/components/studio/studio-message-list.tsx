"use client"

import { useRef, useEffect } from "react"
import { Bot, User, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ToolCallCard } from "./studio-tool-activity"
import type { StudioMessage, ContentPart } from "@/hooks/use-studio-events"

interface StudioMessageListProps {
  messages: StudioMessage[]
  turnInProgress: boolean
}

export function StudioMessageList({ messages, turnInProgress }: StudioMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, turnInProgress])

  if (messages.length === 0 && !turnInProgress) {
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
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
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

function MessageBubble({ message }: { message: StudioMessage }) {
  const isUser = message.role === "user"

  const textParts = message.parts.filter((p) =>
    p.type === "text" || (p.type === "reasoning" && p.visibility !== "private")
  )
  const toolParts = message.parts.filter(
    (p) => p.type === "tool_call" || p.type === "tool_result" || p.type === "file_ref" || p.type === "status"
  )
  const imageParts = message.parts.filter((p) => p.type === "image")

  const displayText = message.content || textParts.map((p) => p.text ?? "").join("")

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
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-current opacity-50 animate-pulse ml-0.5 align-text-bottom" />
            )}
          </div>
        )}

        {imageParts.length > 0 && (
          <div className="space-y-1">
            {imageParts.map((part, i) => (
              <ImagePart key={`${message.id}-img-${i}`} part={part} />
            ))}
          </div>
        )}

        {toolParts.length > 0 && (
          <div className="space-y-1">
            {toolParts.map((part, i) => (
              <ToolCallCard key={`${message.id}-tool-${i}`} part={part} />
            ))}
          </div>
        )}
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
