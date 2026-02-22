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

export interface ItemState {
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

interface TurnTracking {
  turnId: string
  lastChunkType: "thinking" | "message" | null
  activeMessageId: string
  activeThinkingId: string | null
  subIdx: number
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
  const turnTrackingRef = useRef<TurnTracking | null>(null)
  const lastEventTimestampRef = useRef(0)
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
    const restoredPermissions = new Map<string, PendingPermission>()
    const restoredQuestions = new Map<string, PendingQuestion>()
    const restoredTracking: TurnTracking | null = null
    for (const event of restored) {
      processAcpEvent(event, restoredItems, turnTrackingRef, restoredPermissions, restoredQuestions)
    }
    setItems(restoredItems)
    setPendingPermissions(restoredPermissions)
    setPendingQuestions(restoredQuestions)

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
          lastEventTimestampRef.current = Date.now()

          const eventIndex = raw.eventIndex ?? 0
          if (eventIndex > 0 && eventIndex <= lastSequenceRef.current) return
          if (eventIndex > 0) lastSequenceRef.current = eventIndex

          const payload = raw.payload ?? raw
          const method = payload.method as string | undefined
          const params = payload.params as Record<string, unknown> | undefined
          const update = params?.update as Record<string, unknown> | undefined
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

          if (sessionUpdate === "error") {
            const errMsg = (update?.message as string) ?? (update?.error as string) ?? "Agent error"
            setError(errMsg)
            setTurnInProgress(false)
          }

          setEvents((prev) => [...prev, studioEvent])
          setItems((prev) => {
            const next = new Map(prev)
            processAcpEvent(studioEvent, next, turnTrackingRef)
            return next
          })

          if (method === "permission/request") {
            const permId = (params?.permission_id ?? params?.id ?? `perm-${Date.now()}`) as string
            const action = (params?.action ?? params?.description ?? "") as string
            setPendingPermissions((prev) => {
              const next = new Map(prev)
              next.set(permId, { permission_id: permId, action, status: "pending", metadata: params?.metadata })
              return next
            })
          }

          if (method === "permission/response") {
            const permId = (params?.permission_id ?? params?.id) as string | undefined
            if (permId) {
              setPendingPermissions((prev) => {
                const next = new Map(prev)
                next.delete(permId)
                return next
              })
            }
          }

          if (method === "question/request") {
            const qId = (params?.question_id ?? params?.id ?? `q-${Date.now()}`) as string
            const prompt = (params?.prompt ?? params?.question ?? "") as string
            const options = (params?.options ?? []) as string[]
            setPendingQuestions((prev) => {
              const next = new Map(prev)
              next.set(qId, { question_id: qId, prompt, options, status: "pending" })
              return next
            })
          }

          if (method === "question/response") {
            const qId = (params?.question_id ?? params?.id) as string | undefined
            if (qId) {
              setPendingQuestions((prev) => {
                const next = new Map(prev)
                next.delete(qId)
                return next
              })
            }
          }

          if (sessionUpdate === "permission_requested") {
            const permId = (update?.permission_id ?? `perm-${Date.now()}`) as string
            const action = (update?.action ?? update?.description ?? "") as string
            setPendingPermissions((prev) => {
              const next = new Map(prev)
              next.set(permId, { permission_id: permId, action, status: "pending", metadata: update?.metadata })
              return next
            })
          }

          if (sessionUpdate === "permission_resolved") {
            const permId = update?.permission_id as string | undefined
            if (permId) {
              setPendingPermissions((prev) => {
                const next = new Map(prev)
                next.delete(permId)
                return next
              })
            }
          }

          if (sessionUpdate === "question_asked") {
            const qId = (update?.question_id ?? `q-${Date.now()}`) as string
            const prompt = (update?.prompt ?? update?.question ?? "") as string
            const options = (update?.options ?? []) as string[]
            setPendingQuestions((prev) => {
              const next = new Map(prev)
              next.set(qId, { question_id: qId, prompt, options, status: "pending" })
              return next
            })
          }

          if (sessionUpdate === "question_answered") {
            const qId = update?.question_id as string | undefined
            if (qId) {
              setPendingQuestions((prev) => {
                const next = new Map(prev)
                next.delete(qId)
                return next
              })
            }
          }

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

  useEffect(() => {
    const STALE_TURN_MS = 120_000
    const CHECK_INTERVAL_MS = 30_000
    const interval = setInterval(() => {
      if (
        turnInProgress &&
        lastEventTimestampRef.current > 0 &&
        Date.now() - lastEventTimestampRef.current > STALE_TURN_MS
      ) {
        setTurnInProgress(false)
        turnTrackingRef.current = null
      }
    }, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [turnInProgress])

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

  const allItems: ItemState[] = useMemo(() =>
    Array.from(items.values()).sort((a, b) => a.createdAt - b.createdAt),
  [items])

  const sendMessage = useCallback(async (text: string) => {
    if (!sessionId) return

    const turnId = `turn-${Date.now()}`
    const userItemId = `user-${Date.now()}`
    const assistantItemId = `assistant-${turnId}-0`
    const now = Date.now()

    turnTrackingRef.current = {
      turnId,
      lastChunkType: "message",
      activeMessageId: assistantItemId,
      activeThinkingId: null,
      subIdx: 1,
    }
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
    allItems,
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

function finalizeItem(items: Map<string, ItemState>, itemId: string | null, contentType: "text" | "reasoning") {
  if (!itemId) return
  const state = items.get(itemId)
  if (!state) return
  if (state.deltas.length > 0) {
    const fullText = state.deltas.join("")
    state.content = [{ type: contentType, text: fullText, ...(contentType === "reasoning" ? { visibility: "public" } : {}) }]
    state.deltas = []
  }
  state.status = "completed"
}

function processAcpEvent(
  event: StudioEvent,
  items: Map<string, ItemState>,
  turnTrackingRef: { current: TurnTracking | null },
  pendingPermissions?: Map<string, PendingPermission>,
  pendingQuestions?: Map<string, PendingQuestion>,
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
    const assistantItemId = `assistant-${turnId}-0`

    turnTrackingRef.current = {
      turnId,
      lastChunkType: "message",
      activeMessageId: assistantItemId,
      activeThinkingId: null,
      subIdx: 1,
    }

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

  if (method === "permission/request" && pendingPermissions) {
    const permId = (params?.permission_id ?? params?.id ?? `perm-${event.sequence}`) as string
    const action = (params?.action ?? params?.description ?? "") as string
    pendingPermissions.set(permId, { permission_id: permId, action, status: "pending", metadata: params?.metadata })
  }

  if (method === "permission/response" && pendingPermissions) {
    const permId = (params?.permission_id ?? params?.id) as string | undefined
    if (permId) pendingPermissions.delete(permId)
  }

  if (method === "question/request" && pendingQuestions) {
    const qId = (params?.question_id ?? params?.id ?? `q-${event.sequence}`) as string
    const prompt = (params?.prompt ?? params?.question ?? "") as string
    const options = (params?.options ?? []) as string[]
    pendingQuestions.set(qId, { question_id: qId, prompt, options, status: "pending" })
  }

  if (method === "question/response" && pendingQuestions) {
    const qId = (params?.question_id ?? params?.id) as string | undefined
    if (qId) pendingQuestions.delete(qId)
  }

  if (!sessionUpdate) return

  const tracking = turnTrackingRef.current
  if (!tracking) return

  switch (sessionUpdate) {
    case "agent_message_chunk": {
      const content = update?.content as { text?: string; type?: string } | undefined
      const text = content?.text
      if (!text) return

      if (tracking.lastChunkType !== "message") {
        finalizeItem(items, tracking.activeThinkingId, "reasoning")
        const newId = `assistant-${tracking.turnId}-${tracking.subIdx}`
        tracking.subIdx++
        tracking.activeMessageId = newId
        tracking.lastChunkType = "message"
        items.set(newId, {
          itemId: newId,
          role: "assistant",
          kind: "message",
          content: [],
          deltas: [],
          status: "in_progress",
          createdAt: event.createdAt,
        })
      }

      const state = items.get(tracking.activeMessageId)
      if (state) {
        state.deltas.push(text)
      }
      break
    }

    case "agent_thought_chunk": {
      const content = update?.content as { text?: string; type?: string } | undefined
      const text = content?.text
      if (!text) return

      if (tracking.lastChunkType !== "thinking") {
        finalizeItem(items, tracking.activeMessageId, "text")
        const newId = `thinking-${tracking.turnId}-${tracking.subIdx}`
        tracking.subIdx++
        tracking.activeThinkingId = newId
        tracking.lastChunkType = "thinking"
        items.set(newId, {
          itemId: newId,
          role: "assistant",
          kind: "thinking",
          content: [],
          deltas: [],
          status: "in_progress",
          createdAt: event.createdAt,
        })
      }

      const state = items.get(tracking.activeThinkingId!)
      if (state) {
        state.deltas.push(text)
      }
      break
    }

    case "usage_update": {
      finalizeItem(items, tracking.activeMessageId, "text")
      finalizeItem(items, tracking.activeThinkingId, "reasoning")
      turnTrackingRef.current = null
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

    case "permission_requested": {
      if (pendingPermissions) {
        const permId = (update?.permission_id ?? `perm-${event.sequence}`) as string
        const action = (update?.action ?? update?.description ?? "") as string
        pendingPermissions.set(permId, { permission_id: permId, action, status: "pending", metadata: update?.metadata })
      }
      break
    }

    case "permission_resolved": {
      if (pendingPermissions) {
        const permId = update?.permission_id as string | undefined
        if (permId) pendingPermissions.delete(permId)
      }
      break
    }

    case "question_asked": {
      if (pendingQuestions) {
        const qId = (update?.question_id ?? `q-${event.sequence}`) as string
        const prompt = (update?.prompt ?? update?.question ?? "") as string
        const options = (update?.options ?? []) as string[]
        pendingQuestions.set(qId, { question_id: qId, prompt, options, status: "pending" })
      }
      break
    }

    case "question_answered": {
      if (pendingQuestions) {
        const qId = update?.question_id as string | undefined
        if (qId) pendingQuestions.delete(qId)
      }
      break
    }

    case "session_ended": {
      const endItemId = `end-${event.sequence}`
      items.set(endItemId, {
        itemId: endItemId,
        role: "system",
        kind: "message",
        content: [{ type: "text", text: "Session ended." }],
        deltas: [],
        status: "completed",
        createdAt: event.createdAt,
      })
      break
    }

    case "error": {
      const errMsg = (update?.message as string) ?? (update?.error as string) ?? "An error occurred"
      const errItemId = `error-${event.sequence}`
      items.set(errItemId, {
        itemId: errItemId,
        role: "system",
        kind: "message",
        content: [{ type: "text", text: errMsg }],
        deltas: [],
        status: "completed",
        createdAt: event.createdAt,
      })
      break
    }
  }
}
