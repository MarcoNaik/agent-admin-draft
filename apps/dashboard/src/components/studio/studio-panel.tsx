"use client"

import { useEffect, useRef } from "react"
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
  const autoStarted = useRef(false)
  const pendingAutoSend = useRef<string | null>(null)

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
    if (!initialPrompt || autoStarted.current || isActive || isStarting) return
    autoStarted.current = true
    pendingAutoSend.current = consumeInitialPrompt()
    startSession()
  }, [initialPrompt, isActive, isStarting, startSession, consumeInitialPrompt])

  useEffect(() => {
    if (!pendingAutoSend.current || !isConnected) return
    const message = pendingAutoSend.current
    pendingAutoSend.current = null
    sendMessage(message)
  }, [isConnected, sendMessage])

  const error = sessionError || eventError

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
          onStart={startSession}
          onStop={stopSession}
        />

        {error && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <StudioChat
          items={allItems}
          turnInProgress={turnInProgress}
          sessionEnded={sessionEnded}
          isConnected={isConnected}
          isSessionActive={isActive}
          onSendMessage={sendMessage}
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
