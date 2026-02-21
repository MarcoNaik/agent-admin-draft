"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

export interface StudioEvent {
  sequence: number
  type: string
  sender: "agent" | "user" | "system"
  data: unknown
  createdAt: number
}

interface ItemState {
  itemId: string
  role: string
  kind: string
  content: ContentPart[]
  deltas: string[]
  status: "in_progress" | "completed"
  createdAt: number
}

export interface ContentPart {
  type: string
  text?: string
  name?: string
  arguments?: string
  call_id?: string
  output?: string
  path?: string
  action?: string
  diff?: string
  label?: string
  detail?: string
  mime?: string
  json?: unknown
  visibility?: string
}

export interface StudioMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  kind?: string
  parts: ContentPart[]
  isStreaming: boolean
  timestamp: number
}

export interface PendingPermission {
  permission_id: string
  action: string
  status: string
  metadata?: unknown
}

export interface PendingQuestion {
  question_id: string
  prompt: string
  options: string[]
  status: string
}

const MAX_RECONNECT_ATTEMPTS = 10
const BASE_RECONNECT_DELAY = 1000

export function useStudioEvents(
  sessionId: Id<"sandboxSessions"> | undefined,
) {
  const [events, setEvents] = useState<StudioEvent[]>([])
  const [items, setItems] = useState<Map<string, ItemState>>(new Map())
  const [turnInProgress, setTurnInProgress] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingPermissions, setPendingPermissions] = useState<Map<string, PendingPermission>>(new Map())
  const [pendingQuestions, setPendingQuestions] = useState<Map<string, PendingQuestion>>(new Map())
  const lastSequenceRef = useRef(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const restoredRef = useRef(false)
  const appendEvents = useMutation(api.sandboxSessions.appendEvents)

  const storedEvents = useQuery(
    api.sandboxSessions.getEvents,
    sessionId ? { sessionId, afterSequence: -1, limit: 500 } : "skip"
  )

  useEffect(() => {
    if (!storedEvents || storedEvents.length === 0) return
    if (restoredRef.current) return

    restoredRef.current = true

    const restored: StudioEvent[] = storedEvents.map((e: { sequence: number; eventType: string; sender: string; payload: unknown; createdAt: number }) => ({
      sequence: e.sequence,
      type: e.eventType,
      sender: e.sender as "agent" | "user" | "system",
      data: e.payload,
      createdAt: e.createdAt,
    }))

    setEvents(restored)

    const restoredItems = new Map<string, ItemState>()
    for (const event of restored) {
      processEventIntoItems(event, restoredItems)
    }
    setItems(restoredItems)

    const maxSeq = Math.max(...restored.map((e) => e.sequence))
    lastSequenceRef.current = maxSeq
  }, [storedEvents])

  useEffect(() => {
    if (!sessionId) return

    reconnectAttemptsRef.current = 0

    const connect = () => {
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setError("Connection lost. Please refresh the page.")
        return
      }

      const url = `/api/studio/sessions/${sessionId}/events?offset=${lastSequenceRef.current}`
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.onopen = () => {
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
      }

      es.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data)
          const sseId = msg.lastEventId ? parseInt(msg.lastEventId, 10) : 0
          const studioEvent: StudioEvent = {
            sequence: sseId || Date.now(),
            type: event.type,
            sender: event.source === "daemon" ? "system" : (event.source ?? "agent"),
            data: event.properties ?? event.data,
            createdAt: event.time ? new Date(event.time).getTime() : Date.now(),
          }

          if (sseId > 0) lastSequenceRef.current = Math.max(lastSequenceRef.current, sseId)

          if (studioEvent.type === "turn.started") setTurnInProgress(true)
          if (studioEvent.type === "turn.ended") setTurnInProgress(false)

          if (studioEvent.type === "session.status") {
            const status = (studioEvent.data as { status?: { type?: string } })?.status?.type
            if (status === "busy") setTurnInProgress(true)
            if (status === "idle") setTurnInProgress(false)
          }

          if (studioEvent.type === "session.ended" || studioEvent.type === "session.completed") {
            setSessionEnded(true)
            setTurnInProgress(false)
          }

          if (studioEvent.type === "error") {
            const errData = studioEvent.data as { message?: string }
            setError(errData?.message ?? "Agent error")
          }

          if (studioEvent.type === "permission.requested") {
            const d = studioEvent.data as PendingPermission
            setPendingPermissions((prev) => {
              const next = new Map(prev)
              next.set(d.permission_id, d)
              return next
            })
          }
          if (studioEvent.type === "permission.resolved") {
            const d = studioEvent.data as PendingPermission
            setPendingPermissions((prev) => {
              const next = new Map(prev)
              next.delete(d.permission_id)
              return next
            })
          }

          if (studioEvent.type === "question.requested") {
            const d = studioEvent.data as PendingQuestion
            setPendingQuestions((prev) => {
              const next = new Map(prev)
              next.set(d.question_id, d)
              return next
            })
          }
          if (studioEvent.type === "question.resolved") {
            const d = studioEvent.data as PendingQuestion
            setPendingQuestions((prev) => {
              const next = new Map(prev)
              next.delete(d.question_id)
              return next
            })
          }

          setEvents((prev) => [...prev, studioEvent])
          setItems((prev) => {
            const next = new Map(prev)
            processEventIntoItems(studioEvent, next)
            return next
          })

          appendEvents({
            sessionId,
            events: [{
              sequence: studioEvent.sequence,
              eventType: studioEvent.type,
              sender: studioEvent.sender,
              payload: studioEvent.data,
              createdAt: studioEvent.createdAt,
            }],
          }).catch(() => {})
        } catch {
        }
      }

      es.onerror = () => {
        setIsConnected(false)
        es.close()
        reconnectAttemptsRef.current += 1
        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1),
          30000,
        )
        setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }, [sessionId])

  const messages: StudioMessage[] = useMemo(() =>
    Array.from(items.values()).map((item) => {
      const textParts = item.content.filter((p) => p.type === "text")
      const streamedText = textParts.map((p) => p.text ?? "").join("") + item.deltas.join("")

      return {
        id: item.itemId,
        role: item.role as "user" | "assistant" | "system",
        content: streamedText,
        kind: item.kind,
        parts: item.content,
        isStreaming: item.status === "in_progress",
        timestamp: item.createdAt,
      }
    }),
  [items])

  const sendMessage = useCallback(async (text: string) => {
    if (!sessionId) return

    try {
      await fetch(`/api/studio/sessions/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message")
    }
  }, [sessionId])

  const replyPermission = useCallback(async (permissionId: string, reply: "once" | "always" | "reject") => {
    if (!sessionId) return
    try {
      await fetch(`/api/studio/sessions/${sessionId}/permission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId, reply }),
      })
      setPendingPermissions((prev) => {
        const next = new Map(prev)
        next.delete(permissionId)
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reply to permission")
    }
  }, [sessionId])

  const replyQuestion = useCallback(async (questionId: string, answers: string[][]) => {
    if (!sessionId) return
    try {
      await fetch(`/api/studio/sessions/${sessionId}/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answers }),
      })
      setPendingQuestions((prev) => {
        const next = new Map(prev)
        next.delete(questionId)
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reply to question")
    }
  }, [sessionId])

  const rejectQuestion = useCallback(async (questionId: string) => {
    if (!sessionId) return
    try {
      await fetch(`/api/studio/sessions/${sessionId}/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, reject: true }),
      })
      setPendingQuestions((prev) => {
        const next = new Map(prev)
        next.delete(questionId)
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject question")
    }
  }, [sessionId])

  return {
    events,
    messages,
    turnInProgress,
    sessionEnded,
    isConnected,
    error,
    sendMessage,
    pendingPermissions,
    pendingQuestions,
    replyPermission,
    replyQuestion,
    rejectQuestion,
  }
}

function processEventIntoItems(event: StudioEvent, items: Map<string, ItemState>) {
  const data = event.data as Record<string, unknown> | undefined
  if (!data) return

  switch (event.type) {
    case "message.part.updated": {
      const part = data.part as Record<string, unknown> | undefined
      if (!part) return
      const msgId = (data.messageID ?? part.messageID) as string
      if (!msgId) return
      const existing = items.get(msgId)
      if (existing) {
        const partId = part.id as string
        const idx = existing.content.findIndex((p) => (p as unknown as Record<string, unknown>).id === partId)
        if (idx >= 0) {
          existing.content[idx] = part as unknown as ContentPart
        } else {
          existing.content.push(part as unknown as ContentPart)
        }
      } else {
        const sessionId = (data.sessionID ?? part.sessionID) as string | undefined
        items.set(msgId, {
          itemId: msgId,
          role: "assistant",
          kind: "message",
          content: [part as unknown as ContentPart],
          deltas: [],
          status: "in_progress",
          createdAt: event.createdAt,
        })
      }
      break
    }

    case "message.updated": {
      const info = data.info as Record<string, unknown> | undefined
      if (!info) return
      const msgId = info.id as string
      if (!msgId) return
      const parts = (data.parts ?? info.parts) as ContentPart[] | undefined
      const role = (info.role as string) ?? "assistant"
      const existing = items.get(msgId)
      if (existing) {
        if (parts) {
          existing.content = parts
          existing.deltas = []
        }
        existing.role = role
        existing.status = "completed"
      } else {
        items.set(msgId, {
          itemId: msgId,
          role,
          kind: "message",
          content: parts ?? [],
          deltas: [],
          status: "completed",
          createdAt: event.createdAt,
        })
      }
      break
    }

    case "item.started": {
      const item = data.item as Record<string, unknown> | undefined
      if (!item) return
      const itemId = item.item_id as string
      items.set(itemId, {
        itemId,
        role: (item.role as string) ?? "assistant",
        kind: (item.kind as string) ?? "message",
        content: (item.content as ContentPart[]) ?? [],
        deltas: [],
        status: "in_progress",
        createdAt: event.createdAt,
      })
      break
    }

    case "item.delta": {
      const itemId = data.item_id as string
      const delta = data.delta as string
      const state = items.get(itemId)
      if (state && delta) {
        state.deltas.push(delta)
      }
      break
    }

    case "item.completed": {
      const item = data.item as Record<string, unknown> | undefined
      if (!item) return
      const itemId = item.item_id as string
      const state = items.get(itemId)
      if (state) {
        state.content = (item.content as ContentPart[]) ?? state.content
        state.deltas = []
        state.status = "completed"
      }
      break
    }
  }
}
