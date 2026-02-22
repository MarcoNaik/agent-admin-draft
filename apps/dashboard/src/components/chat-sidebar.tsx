"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Loader2, AlertCircle, MessageSquare, PanelRightClose } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useSendChatMessage, useThreadWithMessages } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Id } from "@convex/_generated/dataModel"

interface Message {
  _id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  createdAt: number
}

interface AgentInfo {
  _id: Id<"agents">
  name: string
  slug: string
  developmentConfig?: {
    model?: { name?: string }
  } | null
  productionConfig?: {
    model?: { name?: string }
  } | null
}

interface ChatSidebarProps {
  agent: AgentInfo
  open: boolean
  onClose: () => void
}

export function ChatSidebar({ agent, open, onClose }: ChatSidebarProps) {
  const { environment } = useEnvironment()
  const sendMessage = useSendChatMessage()
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

  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

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
        agentId: agent._id,
        message: userMessage,
        threadId: threadId ?? undefined,
        environment,
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

  const handleNewChat = () => {
    setThreadId(null)
    setLocalMessages([])
    setError(null)
  }

  const config = environment === "production" ? agent.productionConfig : agent.developmentConfig
  const modelName = config?.model?.name || "claude-sonnet-4-20250514"

  if (!open) return null

  return (
    <div className="flex w-80 flex-col border-l bg-background-secondary">
      <div className="flex items-center justify-between px-3 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-content-primary truncate">{agent.name}</p>
            <p className="text-[10px] text-content-tertiary truncate">{modelName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs transition-all ease-out-soft"
              onClick={handleNewChat}
            >
              New
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 transition-all ease-out-soft"
            onClick={onClose}
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="h-10 w-10 rounded-full bg-background-tertiary flex items-center justify-center mb-3">
              <MessageSquare className="h-4 w-4 text-content-tertiary" />
            </div>
            <p className="text-xs text-content-secondary max-w-[180px]">
              Send a message to start chatting with {agent.name}
            </p>
          </div>
        )}

        {messages
          .filter((m: Message) => m.role === "user" || m.role === "assistant")
          .map((message: Message) => (
            <div
              key={message._id}
              className={cn(
                "flex gap-2",
                message.role === "user" ? "flex-row-reverse" : ""
              )}
            >
              <div
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                  message.role === "user"
                    ? "bg-ocean text-white"
                    : "bg-background-tertiary"
                )}
              >
                {message.role === "user" ? (
                  <User className="h-3 w-3" />
                ) : (
                  <Bot className="h-3 w-3" />
                )}
              </div>
              <div
                className={cn(
                  "rounded-lg px-2.5 py-1.5 max-w-[85%]",
                  message.role === "user"
                    ? "bg-ocean text-white"
                    : "bg-background-tertiary text-content-primary"
                )}
              >
                <p className="text-xs whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
              </div>
            </div>
          ))}

        {isLoading && (
          <div className="flex gap-2">
            <div className="h-6 w-6 rounded-full bg-background-tertiary flex items-center justify-center shrink-0">
              <Bot className="h-3 w-3" />
            </div>
            <div className="rounded-lg px-2.5 py-1.5 bg-background-tertiary">
              <Loader2 className="h-3 w-3 animate-spin text-content-tertiary" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1.5 text-destructive text-[10px] p-2 bg-destructive/10 rounded-md">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <p className="line-clamp-2">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-2">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[36px] max-h-[100px] pr-8 resize-none text-xs py-2 font-input"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-1 bottom-1 h-6 w-6 bg-ocean text-white hover:bg-ocean-light transition-all ease-out-soft"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

