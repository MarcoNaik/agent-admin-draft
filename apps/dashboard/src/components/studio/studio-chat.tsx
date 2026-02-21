"use client"

import { useState, useRef, FormEvent, KeyboardEvent, ReactNode } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StudioMessageList } from "./studio-message-list"
import type { StudioMessage } from "@/hooks/use-studio-events"

interface StudioChatProps {
  messages: StudioMessage[]
  turnInProgress: boolean
  sessionEnded?: boolean
  isConnected: boolean
  isSessionActive: boolean
  onSendMessage: (text: string) => void
  children?: ReactNode
}

export function StudioChat({
  messages,
  turnInProgress,
  sessionEnded,
  isConnected,
  isSessionActive,
  onSendMessage,
  children,
}: StudioChatProps) {
  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const inputDisabled = !isSessionActive || !isConnected || sessionEnded
  const canSend = input.trim() && !inputDisabled && !turnInProgress

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSend) return

    onSendMessage(input.trim())
    setInput("")

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    }, 0)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (canSend) {
        onSendMessage(input.trim())
        setInput("")
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
          }
        }, 0)
      }
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 200) + "px"
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <StudioMessageList messages={messages} turnInProgress={turnInProgress} />

      {children}

      <form onSubmit={handleSubmit} className="shrink-0 border-t bg-background p-4">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              sessionEnded
                ? "Session ended"
                : !isSessionActive
                  ? "Start a session first..."
                  : !isConnected
                    ? "Connecting..."
                    : "Type a message..."
            }
            disabled={inputDisabled}
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            className="shrink-0 h-9 w-9"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
