"use client"

import { useEffect, useRef } from "react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { toast } from "sonner"
import { useEnvironment } from "@/contexts/environment-context"

function buildSyncSummary(payload: any): string {
  if (payload?.error) {
    return payload.error
  }

  const parts: string[] = []

  const categories: [string, string][] = [
    ["agents", "agents"],
    ["entityTypes", "entity types"],
    ["roles", "roles"],
    ["triggers", "triggers"],
    ["evalSuites", "eval suites"],
  ]

  for (const [key, label] of categories) {
    const category = payload?.[key]
    if (!category) continue
    const total =
      (category.created?.length ?? 0) +
      (category.updated?.length ?? 0) +
      (category.deleted?.length ?? 0)
    if (total > 0) {
      parts.push(`${total} ${label}`)
    }
  }

  return parts.length > 0 ? parts.join(", ") : "No changes"
}

export function useSyncNotifications() {
  const { environment } = useEnvironment()
  const events = useQuery(api.events.listSyncEvents, { environment, limit: 10 })
  const seenIds = useRef(new Set<string>())
  const initialized = useRef(false)

  useEffect(() => {
    seenIds.current.clear()
    initialized.current = false
  }, [environment])

  useEffect(() => {
    if (events === undefined) return

    if (!initialized.current) {
      for (const event of events) {
        seenIds.current.add(event._id)
      }
      initialized.current = true
      return
    }

    for (const event of events) {
      if (seenIds.current.has(event._id)) continue
      seenIds.current.add(event._id)

      const summary = buildSyncSummary(event.payload)
      const title = event.eventType.includes("deploy") ? "Deploy" : "Dev sync"

      if (event.eventType.endsWith(".completed")) {
        toast.success(title, { description: summary })
      } else if (event.eventType.endsWith(".failed")) {
        toast.error(title, { description: summary, duration: 8000 })
      }
    }
  }, [events])
}
