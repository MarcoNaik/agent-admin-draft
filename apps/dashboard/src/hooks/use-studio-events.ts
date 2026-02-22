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
  const currentTurnIdRef = useRef<string | null>(null)
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
      processAcpEvent(event, restoredItems, currentTurnIdRef)
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

      const url = `/api/studio/sessions/${sessionId}/events`
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.onopen = () => {
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
      }

      es.onmessage = (msg) => {
        try {
          const raw = JSON.parse(msg.data)

          const eventIndex = raw.eventIndex ?? 0
          if (eventIndex > 0 && eventIndex <= lastSequenceRef.current) return
          if (eventIndex > 0) lastSequenceRef.current = eventIndex

          const payload = raw.payload ?? raw
          const method = payload.method as string | undefined
          const update = payload.params?.update as Record<string, unknown> | undefined
          const sessionUpdate = update?.sessionUpdate as string | undefined

          const studioEvent: StudioEvent = {
            sequence: eventIndex || Date.now(),
            type: sessionUpdate ?? method ?? "unknown",
            sender: (raw.sender === "client" ? "user" : raw.sender === "agent" ? "agent" : "system") as "agent" | "user" | "system",
            data: raw,
            createdAt: raw.createdAt ?? Date.now(),
          }

          if (method === "session/prompt") {
            setTurnInProgress(true)
          }

          if (payload.result?.stopReason || sessionUpdate === "usage_update") {
            setTurnInProgress(false)
          }

          if (sessionUpdate === "session_ended" || method === "session/ended") {
            setSessionEnded(true)
            setTurnInProgress(false)
          }

          setEvents((prev) => [...prev, studioEvent])
          setItems((prev) => {
            const next = new Map(prev)
            processAcpEvent(studioEvent, next, currentTurnIdRef)
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
    Array.from(items.values())
      .filter((item) => item.kind === "message")
      .map((item) => {
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

    const turnId = `turn-${Date.now()}`
    const userItemId = `user-${Date.now()}`
    const assistantItemId = `assistant-${turnId}`
    const now = Date.now()

    currentTurnIdRef.current = turnId
    setTurnInProgress(true)
    setItems((prev) => {
      const next = new Map(prev)
      next.set(userItemId, {
        itemId: userItemId,
        role: "user",
        kind: "message",
        content: [{ type: "text", text }],
        deltas: [],
        status: "completed",
        createdAt: now,
      })
      next.set(assistantItemId, {
        itemId: assistantItemId,
        role: "assistant",
        kind: "message",
        content: [],
        deltas: [],
        status: "in_progress",
        createdAt: now,
      })
      return next
    })

    try {
      await fetch(`/api/studio/sessions/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message")
      setTurnInProgress(false)
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

function processAcpEvent(
  event: StudioEvent,
  items: Map<string, ItemState>,
  currentTurnIdRef: { current: string | null },
) {
  const raw = event.data as Record<string, unknown> | undefined
  if (!raw) return

  const payload = (raw.payload ?? raw) as Record<string, unknown>
  const method = payload.method as string | undefined
  const params = payload.params as Record<string, unknown> | undefined
  const update = params?.update as Record<string, unknown> | undefined
  const sessionUpdate = update?.sessionUpdate as string | undefined

  if (method === "session/prompt") {
    const prompt = (params?.prompt as Array<{ type: string; text?: string }>) ?? []
    const text = prompt.map((p) => p.text ?? "").join("")
    if (!text) return

    const turnId = `turn-${event.sequence}`
    currentTurnIdRef.current = turnId

    const userItemId = `user-${event.sequence}`
    items.set(userItemId, {
      itemId: userItemId,
      role: "user",
      kind: "message",
      content: [{ type: "text", text }],
      deltas: [],
      status: "completed",
      createdAt: event.createdAt,
    })

    const assistantItemId = `assistant-${turnId}`
    items.set(assistantItemId, {
      itemId: assistantItemId,
      role: "assistant",
      kind: "message",
      content: [],
      deltas: [],
      status: "in_progress",
      createdAt: event.createdAt,
    })
    return
  }

  if (!sessionUpdate) return

  const turnId = currentTurnIdRef.current
  if (!turnId) return
  const assistantItemId = `assistant-${turnId}`

  switch (sessionUpdate) {
    case "agent_message_chunk": {
      const content = update?.content as { text?: string; type?: string } | undefined
      const text = content?.text
      if (!text) return
      const state = items.get(assistantItemId)
      if (state) {
        state.deltas.push(text)
      }
      break
    }

    case "agent_thought_chunk": {
      break
    }

    case "usage_update": {
      const state = items.get(assistantItemId)
      if (state) {
        if (state.deltas.length > 0) {
          const fullText = state.deltas.join("")
          state.content = [{ type: "text", text: fullText }]
          state.deltas = []
        }
        state.status = "completed"
      }
      currentTurnIdRef.current = null
      break
    }

    case "tool_call_started":
    case "tool_call_completed": {
      const toolItemId = `tool-${event.sequence}`
      const name = (update?.name ?? update?.tool) as string | undefined
      const args = update?.arguments as string | undefined
      const output = update?.output as string | undefined
      items.set(toolItemId, {
        itemId: toolItemId,
        role: "assistant",
        kind: "tool_call",
        content: [{
          type: sessionUpdate === "tool_call_started" ? "tool_call" : "tool_result",
          name,
          arguments: args,
          output,
        }],
        deltas: [],
        status: sessionUpdate === "tool_call_started" ? "in_progress" : "completed",
        createdAt: event.createdAt,
      })
      break
    }

    case "file_change": {
      const fileItemId = `file-${event.sequence}`
      items.set(fileItemId, {
        itemId: fileItemId,
        role: "assistant",
        kind: "file_change",
        content: [{
          type: "file_ref",
          path: update?.path as string | undefined,
          action: update?.action as string | undefined,
          diff: update?.diff as string | undefined,
        }],
        deltas: [],
        status: "completed",
        createdAt: event.createdAt,
      })
      break
    }
  }
}
