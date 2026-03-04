"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

type Environment = "development" | "production"

export function useActiveSandboxSession(environment?: Environment) {
  return useQuery(api.sandboxSessions.getActive, { environment: environment ?? "development" })
}

export function useSandboxEvents(sessionId: Id<"sandboxSessions"> | undefined, afterSequence?: number) {
  return useQuery(
    api.sandboxSessions.getEvents,
    sessionId ? { sessionId, afterSequence: afterSequence ?? -1 } : "skip"
  )
}

export function useAppendSandboxEvents() {
  return useMutation(api.sandboxSessions.appendEvents)
}

export function useCleanupSandboxSession() {
  return useMutation(api.sandboxSessions.cleanup)
}

export function useRecordSandboxActivity() {
  return useMutation(api.sandboxSessions.recordActivity)
}
