"use client"

import { useEffect, useRef } from "react"
import { useStudioSession } from "@/hooks/use-studio-session"
import { useStudioEvents } from "@/hooks/use-studio-events"
import { StudioSessionControls } from "@/components/studio/studio-session-controls"
import { StudioChat } from "@/components/studio/studio-chat"
import { PermissionRequestCard, QuestionRequestCard } from "@/components/studio/studio-hitl"

const KEEPALIVE_INTERVAL = 60_000

export default function StudioPage() {
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
    messages,
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

  useEffect(() => {
    if (isActive) {
      keepaliveRef.current = setInterval(sendKeepalive, KEEPALIVE_INTERVAL)
      return () => clearInterval(keepaliveRef.current)
    }
  }, [isActive, sendKeepalive])

  const error = sessionError || eventError

  return (
    <div className="flex flex-col h-[calc(100dvh-49px)]">
      <StudioSessionControls
        status={session?.status}
        isStarting={isStarting}
        isStopping={isStopping}
        isConnected={isConnected}
        onStart={startSession}
        onStop={stopSession}
      />

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <StudioChat
        messages={messages}
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
  )
}
