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

interface ChatInterfaceProps {
  agent: { name: string; model?: { name?: string } } | null | undefined
  sendMessage: (args: { message: string; threadId?: Id<"threads"> }) => Promise<{ message: string; threadId: Id<"threads"> }>
  orgName?: string
  environmentLabel?: string
  authenticated?: boolean
  mode?: "public" | "dev"
  embedded?: boolean
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 max-w-3xl">
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-lg px-4 py-3 bg-muted flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-content-tertiary rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-content-tertiary rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-content-tertiary rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}

export function ChatInterface({ agent, sendMessage, orgName, environmentLabel, authenticated, mode = "public", embedded }: ChatInterfaceProps) {
  const [threadId, setThreadId] = useState<Id<"threads"> | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempUserMessage, setTempUserMessage] = useState<Message | null>(null)

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
      return filtered.filter((m: Message) => {
        if (m.role === "tool") return false
        if (m.role === "assistant" && m.toolCalls?.length && !m.content) return false
        if (m.role === "assistant" && m.toolCalls?.length && m.content) {
          return true
        }
        return true
      })
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
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (agent === null) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-semibold text-content-primary">Agent Not Found</h1>
        <p className="text-content-secondary">This agent does not exist or is not available.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
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
            <Bot className="h-16 w-16 text-content-tertiary mb-4" />
            <h2 className="text-lg font-medium text-content-primary mb-2">
              Start a conversation
            </h2>
            <p className="text-content-secondary max-w-md">
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
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
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
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-lg px-4 py-2 max-w-[80%] bg-muted text-content-primary">
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
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
                    ? "bg-ocean text-white"
                    : "bg-muted"
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
                  "rounded-lg px-4 py-2 max-w-[80%]",
                  message.role === "user"
                    ? "bg-ocean text-white"
                    : "bg-muted text-content-primary"
                )}
              >
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
              </div>
            </div>
          )
        })}

        {isAgentTyping && <TypingIndicator />}

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg max-w-3xl">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative liquid-glass rounded-lg">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[60px] max-h-[200px] pr-12 resize-none font-input"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-2 bottom-2 bg-ocean text-white hover:bg-ocean-light transition-all ease-out-soft"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-content-tertiary mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  )
}
