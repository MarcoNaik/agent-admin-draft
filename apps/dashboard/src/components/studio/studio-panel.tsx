"use client"

import { useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { CreditCard, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStudio } from "@/contexts/studio-context"
import { useStudioSession } from "@/hooks/use-studio-session"
import { useStudioEvents } from "@/hooks/use-studio-events"
import { StudioSessionControls } from "@/components/studio/studio-session-controls"
import { StudioChat } from "@/components/studio/studio-chat"
import { PermissionRequestCard, QuestionRequestCard } from "@/components/studio/studio-hitl"

const KEEPALIVE_INTERVAL = 60_000

export function StudioPanel() {
  const { isOpen, setHasActiveSession, initialPrompt, consumeInitialPrompt } = useStudio()

  const {
    session,
    isStarting,
    isStopping,
    error: sessionError,
    startSession,
    stopSession,
    sendKeepalive,
  } = useStudioSession()

  const isActive = session?.status === "provisioning" || session?.status === "ready" || session?.status === "active" || session?.status === "idle"
  const isReady = session?.status === "ready" || session?.status === "active" || session?.status === "idle"
  const sessionId = isReady ? session?._id : undefined

  const {
    allItems,
    turnInProgress,
    sessionEnded,
    isConnected,
    error: eventError,
    sendMessage,
    pendingPermissions,
    pendingQuestions,
    replyPermission,
    replyQuestion,
    rejectQuestion,
  } = useStudioEvents(sessionId)

  const keepaliveRef = useRef<ReturnType<typeof setInterval>>()
  const pendingMessage = useRef<string | null>(null)

  useEffect(() => {
    if (isActive) {
      keepaliveRef.current = setInterval(sendKeepalive, KEEPALIVE_INTERVAL)
      return () => clearInterval(keepaliveRef.current)
    }
  }, [isActive, sendKeepalive])

  useEffect(() => {
    setHasActiveSession(isActive)
  }, [isActive, setHasActiveSession])

  useEffect(() => {
    if (!initialPrompt || isActive || isStarting) return
    pendingMessage.current = consumeInitialPrompt()
    startSession()
  }, [initialPrompt, isActive, isStarting, startSession, consumeInitialPrompt])

  useEffect(() => {
    if (!pendingMessage.current || !isConnected) return
    const message = pendingMessage.current
    pendingMessage.current = null
    sendMessage(message)
  }, [isConnected, sendMessage])

  const handleSendMessage = useCallback((text: string) => {
    if (isConnected && isActive) {
      sendMessage(text)
      return
    }

    if (!isActive && !isStarting) {
      pendingMessage.current = text
      startSession()
    }
  }, [isConnected, isActive, isStarting, sendMessage, startSession])

  const error = sessionError || eventError
  const isCreditsError = error?.toLowerCase().includes("insufficient credits")

  return (
    <div
      className={cn(
        "flex flex-col border-l bg-background-secondary h-full overflow-hidden transition-[width] ease-out-soft duration-300",
        isOpen ? "w-[480px]" : "w-0 border-l-0"
      )}
    >
      <div className="flex flex-col h-full w-[480px] min-w-[480px]">
        <StudioSessionControls
          status={session?.status}
          isStarting={isStarting}
          isStopping={isStopping}
          isConnected={isConnected}
          onStop={stopSession}
        />

        {isCreditsError ? (
          <div className="px-4 py-4 bg-background-tertiary border-b space-y-3">
            <p className="text-sm font-medium text-content-primary">
              You need credits to use Studio
            </p>
            <p className="text-xs text-content-secondary leading-relaxed">
              Studio runs on pay-as-you-go credits billed per token. Add credits to start building, or use the <code className="text-xs bg-background-tertiary px-1 py-0.5 rounded">struere</code> CLI locally with your own API keys for free.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/settings/billing"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <CreditCard className="h-3 w-3" />
                Buy Credits
              </Link>
              <a
                href="https://docs.struere.dev/cli/quickstart"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background-tertiary text-content-secondary rounded-md text-xs font-medium hover:text-content-primary transition-colors"
              >
                <Terminal className="h-3 w-3" />
                Use CLI Instead
              </a>
            </div>
          </div>
        ) : error ? (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : null}

        <StudioChat
          items={allItems}
          turnInProgress={turnInProgress}
          sessionEnded={sessionEnded}
          isConnected={isConnected}
          isSessionActive={isActive}
          isStarting={isStarting}
          onSendMessage={handleSendMessage}
        >
          {Array.from(pendingPermissions.values()).map((p) => (
            <PermissionRequestCard
              key={p.permission_id}
              permission={p}
              onReply={replyPermission}
            />
          ))}
          {Array.from(pendingQuestions.values()).map((q) => (
            <QuestionRequestCard
              key={q.question_id}
              question={q}
              onAnswer={replyQuestion}
              onReject={rejectQuestion}
            />
          ))}
        </StudioChat>
      </div>
    </div>
  )
}
