"use client"

import { useState, useEffect } from "react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import Link from "next/link"
import { Bell, CheckCircle2, XCircle, ExternalLink } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEnvironment } from "@/contexts/environment-context"

function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "just now"
}

function buildSummary(payload: any): string {
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

export function NotificationBell() {
  const { environment } = useEnvironment()
  const events = useQuery(api.events.listSyncEvents, { environment, limit: 10 })

  const storageKey = `struere-notifications-seen-${environment}`

  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<number>(0)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    setLastSeenTimestamp(stored ? Number(stored) : 0)
  }, [storageKey])

  const unreadCount = events
    ? events.filter((e: any) => e.timestamp > lastSeenTimestamp).length
    : 0

  function handleOpenChange(open: boolean) {
    if (open && events && events.length > 0) {
      const newest = Math.max(...events.map((e: any) => e.timestamp))
      setLastSeenTimestamp(newest)
      localStorage.setItem(storageKey, String(newest))
    }
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-background-tertiary rounded-md transition-colors ease-out-soft relative"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background-secondary" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium text-content-primary">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </div>
        <DropdownMenuSeparator />
        {!events || events.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-content-tertiary">
            No sync activity yet
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {events.map((event: any) => {
              const isUnread = event.timestamp > lastSeenTimestamp
              const isCompleted = event.eventType.endsWith(".completed")
              const title = event.eventType.includes("deploy") ? "Deploy" : "Dev sync"
              const summary = buildSummary(event.payload)

              return (
                <div
                  key={event._id}
                  className={`flex items-start gap-3 px-3 py-2.5 ${
                    isUnread ? "bg-background-tertiary/50" : ""
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-content-primary">{title}</div>
                    <div className="text-xs text-content-tertiary truncate">{summary}</div>
                    <div className="text-xs text-content-tertiary">{formatTimeAgo(event.timestamp)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/activity"
            className="flex items-center justify-center gap-1.5 py-2 text-sm text-content-secondary cursor-pointer"
          >
            View all activity
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
