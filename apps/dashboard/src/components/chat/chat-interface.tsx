"use client"

import { useState, useRef, useEffect } from "react"
import { Loader2, Send, Bot, User, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Id } from "@convex/_generated/dataModel"
import { useThreadWithMessages } from "@/hooks/use-convex-data"

interface Message {
  _id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  createdAt: number
}

interface ChatInterfaceProps {
  agent: { name: string; model?: { name?: string } } | null | undefined
  sendMessage: (args: { message: string; threadId?: Id<"threads"> }) => Promise<{ message: string; threadId: Id<"threads"> }>
  environmentLabel?: string
}

export function ChatInterface({ agent, sendMessage, environmentLabel }: ChatInterfaceProps) {
  const [threadId, setThreadId] = useState<Id<"threads"> | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localMessages, setLocalMessages] = useState<Message[]>([])

  const thread = useThreadWithMessages(threadId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const messages = thread?.messages ?? localMessages

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (thread?.messages) {
      setLocalMessages([])
    }
  }, [thread?.messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !agent) return

    const userMessage = input.trim()
    setInput("")
    setError(null)
    setIsLoading(true)

    const tempUserMessage: Message = {
      _id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      createdAt: Date.now(),
    }
    setLocalMessages((prev) => [...prev, tempUserMessage])

    try {
      const result = await sendMessage({
        message: userMessage,
        threadId: threadId ?? undefined,
      })

      if (!threadId && result.threadId) {
        setThreadId(result.threadId)
      }

      const tempAssistantMessage: Message = {
        _id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: result.message,
        createdAt: Date.now(),
      }
      setLocalMessages((prev) => [...prev, tempAssistantMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message")
      setLocalMessages((prev) => prev.filter((m) => m._id !== tempUserMessage._id))
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
      <header className="border-b px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-content-primary">{agent.name}</h1>
          <p className="text-xs text-content-secondary">
            {agent.model?.name || "claude-sonnet-4-20250514"}
            {environmentLabel && ` · ${environmentLabel}`}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
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

        {messages
          .filter((m: Message) => m.role === "user" || m.role === "assistant")
          .map((message: Message) => (
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
                    ? "bg-primary text-primary-foreground"
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
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-content-primary"
                )}
              >
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
              </div>
            </div>
          ))}

        {isLoading && (
          <div className="flex gap-3 max-w-3xl">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-lg px-4 py-2 bg-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}

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
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[60px] max-h-[200px] pr-12 resize-none"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-2 bottom-2"
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
