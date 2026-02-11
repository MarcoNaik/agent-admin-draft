"use client"

import { useState, useRef, useEffect } from "react"
import { Bot, Loader2, MessageSquare, User, Phone, Send, AlertCircle } from "lucide-react"
import {
  useAgents,
  useThreadsWithPreviews,
  useThreadWithMessages,
  useReplyToThread,
} from "@/hooks/use-convex-data"
import { cn } from "@/lib/utils"
import { Doc, Id } from "@convex/_generated/dataModel"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

function formatRelativeTime(timestamp: number) {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function truncate(str: string, max: number) {
  if (str.length <= max) return str
  return str.slice(0, max) + "..."
}

export default function ChatPage() {
  const agents = useAgents()
  const [agentFilter, setAgentFilter] = useState<string>("all")
  const [selectedThreadId, setSelectedThreadId] = useState<Id<"threads"> | null>(null)

  const [messageInput, setMessageInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const replyToThread = useReplyToThread()

  const filteredAgentId = agentFilter !== "all" ? (agentFilter as Id<"agents">) : undefined
  const threads = useThreadsWithPreviews(filteredAgentId, "production")
  const selectedThread = useThreadWithMessages(selectedThreadId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selectedThread?.messages])

  useEffect(() => {
    setMessageInput("")
    setSendError(null)
  }, [selectedThreadId])

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedThreadId || isSending) return
    setIsSending(true)
    setSendError(null)
    try {
      const result = await replyToThread({ threadId: selectedThreadId, message: messageInput.trim() })
      setMessageInput("")
      if (result.whatsappStatus === "failed") {
        setSendError("Message saved but WhatsApp delivery failed")
      }
    } catch {
      setSendError("Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (agents === undefined || threads === undefined) {
    return (
      <div className="flex h-[calc(100dvh-49px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  const activeAgents = agents.filter((a: Doc<"agents">) => a.status === "active")

  const visibleMessages = selectedThread?.messages?.filter(
    (m: { role: string }) => m.role === "user" || m.role === "assistant"
  ) ?? []

  const selectedPreview = threads?.find((t: { _id: Id<"threads"> }) => t._id === selectedThreadId)
  const isWhatsAppThread = selectedPreview?.participantType === "whatsapp"

  return (
    <div className="flex h-[calc(100dvh-49px)]">
      <aside className="w-80 border-r bg-background-secondary flex flex-col shrink-0">
        <div className="p-3 border-b">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {activeAgents.map((agent: Doc<"agents">) => (
                <SelectItem key={agent._id} value={agent._id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <MessageSquare className="h-10 w-10 text-content-tertiary mb-3" />
              <p className="text-sm text-content-secondary">No conversations found</p>
            </div>
          ) : (
            <ul>
              {threads.map((thread: typeof threads[number]) => (
                <li key={thread._id}>
                  <button
                    type="button"
                    onClick={() => setSelectedThreadId(thread._id)}
                    className={cn(
                      "w-full text-left px-3 py-3 border-b border-border/50 transition-colors",
                      selectedThreadId === thread._id
                        ? "bg-primary/10"
                        : "hover:bg-background-tertiary"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                          thread.participantType === "whatsapp"
                            ? "bg-green-500/10"
                            : "bg-muted"
                        )}
                      >
                        {thread.participantType === "whatsapp" ? (
                          <Phone className="h-4 w-4 text-green-500" />
                        ) : (
                          <User className="h-4 w-4 text-content-secondary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-content-primary truncate">
                            {thread.participantName}
                          </span>
                          {thread.lastMessage && (
                            <span className="text-xs text-content-tertiary shrink-0">
                              {formatRelativeTime(thread.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-content-tertiary mt-0.5">
                          via {thread.agentName}
                        </p>
                        {thread.lastMessage && (
                          <p className="text-xs text-content-secondary mt-1 truncate">
                            {thread.lastMessage.role === "assistant" && (
                              <span className="text-content-tertiary">Bot: </span>
                            )}
                            {truncate(thread.lastMessage.content, 80)}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-background min-w-0">
        {!selectedThreadId ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-16 w-16 text-content-tertiary mb-4" />
            <h2 className="text-lg font-medium text-content-primary mb-2">
              Select a conversation
            </h2>
            <p className="text-sm text-content-secondary max-w-md">
              Choose a conversation from the left to view messages.
            </p>
          </div>
        ) : selectedThread === undefined ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
          </div>
        ) : selectedThread === null ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-16 w-16 text-content-tertiary mb-4" />
            <p className="text-sm text-content-secondary">Thread not found</p>
          </div>
        ) : (
          <>
            <header className="border-b px-4 py-3 flex items-center gap-3 shrink-0 bg-background-secondary">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  selectedPreview?.participantType === "whatsapp"
                    ? "bg-green-500/10"
                    : "bg-muted"
                )}
              >
                {selectedPreview?.participantType === "whatsapp" ? (
                  <Phone className="h-5 w-5 text-green-500" />
                ) : (
                  <User className="h-5 w-5 text-content-secondary" />
                )}
              </div>
              <div>
                <h2 className="font-semibold text-content-primary text-sm">
                  {selectedPreview?.participantName ?? "Unknown"}
                </h2>
                <p className="text-xs text-content-tertiary">
                  via {selectedPreview?.agentName ?? "Agent"}
                </p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {visibleMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-sm text-content-secondary">No messages in this thread</p>
                </div>
              ) : (
                visibleMessages.map((message: { _id: string; role: string; content: string; createdAt: number }) => (
                  <div
                    key={message._id}
                    className={cn(
                      "flex gap-3 max-w-3xl",
                      message.role === "user" ? "" : "ml-auto flex-row-reverse"
                    )}
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                        message.role === "user"
                          ? "bg-muted"
                          : "bg-primary text-primary-foreground"
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
                          ? "bg-muted text-content-primary"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      <p
                        className={cn(
                          "text-[10px] mt-1",
                          message.role === "user"
                            ? "text-content-tertiary"
                            : "text-primary-foreground/70"
                        )}
                      >
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {sendError && (
              <div className="px-4 py-2 flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 border-t border-amber-400/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {sendError}
              </div>
            )}

            <div className="border-t p-3 shrink-0 bg-background-secondary">
              {isWhatsAppThread && (
                <p className="text-xs text-green-500 mb-2 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Reply will be sent via WhatsApp
                </p>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="min-h-[40px] max-h-[120px] resize-none text-sm"
                  rows={1}
                  disabled={isSending}
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isSending}
                  className="shrink-0 h-10 w-10"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
