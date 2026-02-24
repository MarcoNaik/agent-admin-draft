"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Loader2, Send, Bot, User, AlertCircle } from "lucide-react"
import { ToolCallBubble, ToolResultBubble } from "@/components/chat/tool-bubbles"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Id } from "@convex/_generated/dataModel"
import { useThreadWithMessages, usePublicThreadMessages } from "@/hooks/use-convex-data"

interface Message {
  _id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  createdAt: number
  toolCalls?: Array<{ id: string; name: string; arguments: unknown }>
  toolCallId?: string
}

const TOOL_CALL_RE = /^(?:entity|event|calendar|whatsapp|agent)[._](?:create|get|query|update|delete|link|unlink|emit|list|freeBusy|send|sendTemplate|sendInteractive|sendMedia|listTemplates|getConversation|getStatus|chat)\b/i

function cleanToolCallText(text: string): string {
  const lines = text.split("\n")
  const cleaned: string[] = []
  let inToolBlock = false
  let braceDepth = 0

  for (const line of lines) {
    const trimmed = line.trim()

    if (TOOL_CALL_RE.test(trimmed)) {
      inToolBlock = true
      braceDepth = 0
      for (const ch of line) {
        if (ch === "{" || ch === "(") braceDepth++
        if (ch === "}" || ch === ")") braceDepth--
      }
      if (braceDepth <= 0) inToolBlock = false
      continue
    }

    if (inToolBlock) {
      for (const ch of line) {
        if (ch === "{" || ch === "(") braceDepth++
        if (ch === "}" || ch === ")") braceDepth--
      }
      if (braceDepth <= 0) inToolBlock = false
      continue
    }

    cleaned.push(line)
  }

  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

interface ChatInterfaceProps {
  agent: { name: string; model?: { name?: string } } | null | undefined
  sendMessage: (args: { message: string; threadId?: Id<"threads"> }) => Promise<{ message: string; threadId: Id<"threads"> }>
  orgName?: string
  environmentLabel?: string
  authenticated?: boolean
  mode?: "public" | "dev"
  embedded?: boolean
}

function TypingIndicator({ embedded }: { embedded?: boolean }) {
  return (
    <div className="flex gap-3 max-w-3xl">
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
        embedded ? "liquid-glass liquid-glass-dark text-white" : "bg-muted"
      )}>
        <Bot className="h-4 w-4" />
      </div>
      <div className={cn(
        "rounded-2xl px-4 py-3 flex items-center gap-1",
        embedded ? "liquid-glass liquid-glass-dark" : "bg-muted"
      )}>
        <span className={cn("w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]", embedded ? "bg-white" : "bg-content-tertiary")} />
        <span className={cn("w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]", embedded ? "bg-white" : "bg-content-tertiary")} />
        <span className={cn("w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]", embedded ? "bg-white" : "bg-content-tertiary")} />
      </div>
    </div>
  )
}

const URL_REGEX = /(https?:\/\/[^\s<>)"']+)/g

function MessageContent({ content, embedded }: { content: string; embedded?: boolean }) {
  const parts = content.split(URL_REGEX)
  return (
    <p className="whitespace-pre-wrap text-sm">
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "underline underline-offset-2 break-all",
              embedded ? "text-amber-light hover:text-white" : "text-ocean hover:text-ocean-light"
            )}
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  )
}

export function ChatInterface({ agent, sendMessage, orgName, environmentLabel, authenticated, mode = "public", embedded }: ChatInterfaceProps) {
  const [threadId, setThreadId] = useState<Id<"threads"> | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempUserMessage, setTempUserMessage] = useState<Message | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  const authenticatedThread = useThreadWithMessages(authenticated ? threadId : undefined)
  const publicMessages = usePublicThreadMessages(!authenticated ? threadId : undefined)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const subscriptionMessages: Message[] = useMemo(() => {
    if (authenticated && authenticatedThread?.messages) {
      return authenticatedThread.messages as Message[]
    }
    if (!authenticated && publicMessages) {
      return publicMessages as Message[]
    }
    return []
  }, [authenticated, authenticatedThread?.messages, publicMessages])

  const messages = useMemo(() => {
    if (subscriptionMessages.length > 0) {
      return subscriptionMessages
    }
    if (tempUserMessage) {
      return [tempUserMessage]
    }
    return []
  }, [subscriptionMessages, tempUserMessage])

  const filteredMessages = useMemo(() => {
    const filtered = messages.filter((m: Message) => m.role !== "system")
    if (mode === "public") {
      return filtered
        .filter((m: Message) => {
          if (m.role === "tool") return false
          if (m.role === "assistant" && m.toolCalls?.length && !m.content) return false
          return true
        })
        .map((m: Message) => {
          if (m.role === "assistant" && m.content) {
            const cleaned = cleanToolCallText(m.content)
            if (cleaned !== m.content) {
              return { ...m, content: cleaned }
            }
          }
          return m
        })
        .filter((m: Message) => m.role !== "assistant" || m.content)
    }
    return filtered
  }, [messages, mode])

  const isAgentTyping = useMemo(() => {
    if (!isLoading) return false
    if (messages.length === 0) return true
    const last = messages[messages.length - 1]
    if (last.role === "user") return true
    if (last.role === "tool") return true
    if (last.role === "assistant" && last.toolCalls?.length) return true
    return false
  }, [isLoading, messages])

  useEffect(() => {
    if (subscriptionMessages.length > 0 && tempUserMessage) {
      const hasUserMsg = subscriptionMessages.some(
        m => m.role === "user" && m.content === tempUserMessage.content
      )
      if (hasUserMsg) {
        setTempUserMessage(null)
      }
    }
  }, [subscriptionMessages, tempUserMessage])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [filteredMessages, isAgentTyping])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !agent) return

    const userMessage = input.trim()
    setInput("")
    setError(null)
    setIsLoading(true)

    setTempUserMessage({
      _id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      createdAt: Date.now(),
    })

    try {
      const result = await sendMessage({
        message: userMessage,
        threadId: threadId ?? undefined,
      })

      if (!threadId && result.threadId) {
        setThreadId(result.threadId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message")
      setTempUserMessage(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  if (agent === undefined) {
    return (
      <div className={cn("flex items-center justify-center h-screen", embedded ? "liquid-glass liquid-glass-dark" : "bg-background")}>
        <Loader2 className={cn("h-8 w-8 animate-spin", embedded ? "text-white" : "text-content-secondary")} />
      </div>
    )
  }

  if (agent === null) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-screen gap-4", embedded ? "liquid-glass liquid-glass-dark" : "bg-background")}>
        <AlertCircle className={cn("h-12 w-12", embedded ? "text-white" : "text-destructive")} />
        <h1 className={cn("text-xl font-semibold", embedded ? "text-white" : "text-content-primary")}>Agent Not Found</h1>
        <p className={cn(embedded ? "text-white" : "text-content-secondary")}>This agent does not exist or is not available.</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-screen", embedded ? "liquid-glass liquid-glass-dark" : "bg-background")}>
      {!embedded && (
        <header className="border-b px-4 py-3 flex items-center gap-3 shrink-0">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-content-primary">{agent.name}</h1>
            <p className="text-xs text-content-secondary">
              {orgName && <>{orgName} · </>}
              {agent.model?.name || "claude-sonnet-4-20250514"}
              {environmentLabel && ` · ${environmentLabel}`}
            </p>
          </div>
        </header>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMessages.length === 0 && !isAgentTyping && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className={cn("h-16 w-16 mb-4", embedded ? "text-white" : "text-content-tertiary")} />
            <h2 className={cn("text-lg font-medium mb-2", embedded ? "text-white" : "text-content-primary")}>
              Start a conversation
            </h2>
            <p className={cn("max-w-md", embedded ? "text-white" : "text-content-secondary")}>
              Send a message to start chatting with {agent.name}.
            </p>
          </div>
        )}

        {filteredMessages.map((message: Message) => {
          if (mode === "dev" && message.role === "tool") {
            return (
              <ToolResultBubble
                key={message._id}
                toolCallId={message.toolCallId ?? ""}
                content={message.content}
                allMessages={messages}
              />
            )
          }

          if (mode === "dev" && message.role === "assistant" && message.toolCalls?.length && !message.content) {
            return (
              <div key={message._id} className="space-y-2">
                {message.toolCalls.map((tc) => (
                  <ToolCallBubble key={tc.id} name={tc.name} arguments={tc.arguments} />
                ))}
              </div>
            )
          }

          if (mode === "dev" && message.role === "assistant" && message.toolCalls?.length && message.content) {
            return (
              <div key={message._id} className="space-y-2">
                <div className="flex gap-3 max-w-3xl">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg px-4 py-2 max-w-[80%] bg-muted text-content-primary">
                    <MessageContent content={message.content} embedded={embedded} />
                  </div>
                </div>
                {message.toolCalls.map((tc) => (
                  <ToolCallBubble key={tc.id} name={tc.name} arguments={tc.arguments} />
                ))}
              </div>
            )
          }

          if (message.role === "assistant" && message.toolCalls?.length && message.content && mode === "public") {
            return (
              <div
                key={message._id}
                className="flex gap-3 max-w-3xl"
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                  embedded ? "liquid-glass liquid-glass-dark text-white" : "bg-muted"
                )}>
                  <Bot className="h-4 w-4" />
                </div>
                <div className={cn(
                  "rounded-2xl px-4 py-2 max-w-[80%]",
                  embedded ? "liquid-glass liquid-glass-dark text-white" : "bg-muted text-content-primary"
                )}>
                  <MessageContent content={message.content} embedded={embedded} />
                </div>
              </div>
            )
          }

          return (
            <div
              key={message._id}
              className={cn(
                "flex gap-3 max-w-3xl",
                message.role === "user" ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                  message.role === "user"
                    ? embedded ? "liquid-glass liquid-glass-dark text-white" : "bg-ocean text-white"
                    : embedded ? "liquid-glass liquid-glass-dark text-white" : "bg-muted"
                )}
              >
                {message.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  "rounded-2xl px-4 py-2 max-w-[80%]",
                  message.role === "user"
                    ? embedded ? "liquid-glass liquid-glass-dark text-white" : "bg-ocean text-white"
                    : embedded ? "liquid-glass liquid-glass-dark text-white" : "bg-muted text-content-primary"
                )}
              >
                <MessageContent content={message.content} embedded={embedded} />
              </div>
            </div>
          )
        })}

        {isAgentTyping && <TypingIndicator embedded={embedded} />}

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg max-w-3xl">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={cn("p-4 shrink-0", embedded ? "border-t border-white/10" : "border-t")}>
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className={cn(embedded && "embed-prismatic-wrap", embedded && isFocused && "focused")}>
            <div className={cn("relative", embedded ? "liquid-glass liquid-glass-dark rounded-2xl" : "liquid-glass rounded-lg")}>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Type a message..."
                className={cn(
                  "min-h-[60px] max-h-[200px] pr-12 resize-none font-input",
                  embedded && "bg-transparent text-white placeholder:text-white/70 border-none shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-none"
                )}
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 transition-all ease-out-soft",
                  embedded
                    ? "bg-transparent border border-white/15 text-white"
                    : "bg-ocean text-white hover:bg-ocean-light"
                )}
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className={cn("text-xs mt-2 text-center", embedded ? "text-white/70" : "text-content-tertiary")}>
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  )
}
