"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { useEnvironment } from "@/contexts/environment-context"

export interface StudioSessionConfig {
  model: string
}

export function useStudioSession() {
  const { environment } = useEnvironment()
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeSession = useQuery(api.sandboxSessions.getActiveSafe, { environment })
  const cleanup = useMutation(api.sandboxSessions.cleanup)

  const startSession = useCallback(async (config: StudioSessionConfig) => {
    setIsStarting(true)
    setError(null)

    try {
      console.log("[studio/session] startSession: creating session", { environment, model: config.model })
      const response = await fetch("/api/studio/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "manual",
      body: JSON.stringify({
          environment,
          model: config.model,
        }),
      })
      const contentType = response.headers.get("content-type") ?? "unknown"
      console.log("[studio/session] startSession: response", {
        status: response.status,
        type: response.type,
        contentType,
        redirected: response.redirected,
        url: response.url,
      })

      if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
        throw new Error(`Auth redirect detected (status=${response.status}). Please refresh the page.`)
      }

      const text = await response.text()
      console.log("[studio/session] startSession: raw body (first 200 chars):", text.slice(0, 200))

      let data: Record<string, unknown>
      try {
        data = JSON.parse(text)
      } catch {
        console.error("[studio/session] startSession: response is not JSON!", { contentType, bodyPreview: text.slice(0, 500) })
        throw new Error(`Server returned non-JSON response (${contentType}). This usually means auth expired — try refreshing.`)
      }

      if (!response.ok) {
        throw new Error((data.error as string) || "Failed to create session")
      }

      return {
        sessionId: data.sessionId as Id<"sandboxSessions">,
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
    } catch (err) {
      console.error("[studio/session] stopSession fetch failed:", err)
      try {
        await cleanup({ id: activeSession._id })
      } catch (cleanupErr) {
        console.error("[studio/session] stopSession cleanup failed:", cleanupErr)
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
    } catch (err) {
      console.error("[studio/session] sendKeepalive failed:", err)
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
