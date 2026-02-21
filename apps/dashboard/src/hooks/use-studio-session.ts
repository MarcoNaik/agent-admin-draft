"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { useEnvironment } from "@/contexts/environment-context"

type AgentType = "opencode" | "claude"

interface StudioSession {
  sessionId: Id<"sandboxSessions">
  status: string
}

export function useStudioSession() {
  const { environment } = useEnvironment()
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeSession = useQuery(api.sandboxSessions.getActiveSafe, { environment })
  const cleanup = useMutation(api.sandboxSessions.cleanup)

  const startSession = useCallback(async (agentType: AgentType = "opencode"): Promise<StudioSession | null> => {
    setIsStarting(true)
    setError(null)

    try {
      const response = await fetch("/api/studio/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType, environment }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create session")
      }

      const data = await response.json()
      return {
        sessionId: data.sessionId,
        status: "ready",
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start session"
      setError(message)
      return null
    } finally {
      setIsStarting(false)
    }
  }, [environment])

  const stopSession = useCallback(async () => {
    if (!activeSession) return

    setIsStopping(true)
    setError(null)

    try {
      await fetch(`/api/studio/sessions/${activeSession._id}`, {
        method: "DELETE",
      })
    } catch {
      try {
        await cleanup({ id: activeSession._id })
      } catch {
      }
    } finally {
      setIsStopping(false)
    }
  }, [activeSession, cleanup])

  const sendKeepalive = useCallback(async () => {
    if (!activeSession) return

    try {
      await fetch(`/api/studio/sessions/${activeSession._id}/keepalive`, {
        method: "POST",
      })
    } catch {
    }
  }, [activeSession])

  return {
    session: activeSession,
    isStarting,
    isStopping,
    error,
    startSession,
    stopSession,
    sendKeepalive,
  }
}
