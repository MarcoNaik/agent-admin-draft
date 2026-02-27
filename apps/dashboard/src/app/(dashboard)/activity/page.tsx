"use client"

import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { useEnvironment } from "@/contexts/environment-context"
import { useCurrentRole } from "@/hooks/use-current-role"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, Loader2, Activity } from "lucide-react"

const RESOURCE_LABELS: Record<string, string> = {
  agents: "Agents",
  entityTypes: "Entity Types",
  roles: "Roles",
  triggers: "Triggers",
  evalSuites: "Eval Suites",
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function ResourceBreakdown({ payload }: { payload: Record<string, any> }) {
  const resourceKeys = ["agents", "entityTypes", "roles", "triggers", "evalSuites"]

  const entries = resourceKeys
    .map((key) => {
      const data = payload[key]
      if (!data) return null
      const created = data.created ?? []
      const updated = data.updated ?? []
      const deleted = data.deleted ?? []
      if (created.length === 0 && updated.length === 0 && deleted.length === 0) return null
      return { key, label: RESOURCE_LABELS[key] ?? key, created, updated, deleted }
    })
    .filter(Boolean) as Array<{
    key: string
    label: string
    created: string[]
    updated: string[]
    deleted: string[]
  }>

  if (entries.length === 0) return null

  return (
    <div className="mt-2 space-y-1.5">
      {entries.map((entry) => (
        <div key={entry.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-content-tertiary font-medium w-24 shrink-0">{entry.label}</span>
          {entry.created.map((name: string) => (
            <span key={`c-${name}`} className="text-success font-mono text-[11px]">+{name}</span>
          ))}
          {entry.updated.map((name: string) => (
            <span key={`u-${name}`} className="text-warning font-mono text-[11px]">~{name}</span>
          ))}
          {entry.deleted.map((name: string) => (
            <span key={`d-${name}`} className="text-destructive font-mono text-[11px]">-{name}</span>
          ))}
        </div>
      ))}
    </div>
  )
}

function EventRow({ event }: { event: Record<string, any> }) {
  const isCompleted = event.eventType === "sync.completed" || event.eventType === "deploy.completed"
  const isFailed = event.eventType === "sync.failed" || event.eventType === "deploy.failed"
  const isDeploy = event.eventType === "deploy.completed" || event.eventType === "deploy.failed"
  const title = isDeploy ? "Deploy" : "Dev sync"
  const payload = event.payload ?? {}
  const timestamp = event._creationTime ?? event.timestamp

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="shrink-0 mt-0.5">
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
        </div>
        <div className="flex-1 w-px bg-border/30 mt-2" />
      </div>

      <div className="flex-1 min-w-0 pb-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-content-primary">{title}</span>
            {isCompleted && (
              <Badge variant="success" className="text-[10px] px-1.5 py-0 font-normal">
                success
              </Badge>
            )}
            {isFailed && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-normal">
                failed
              </Badge>
            )}
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-xs text-content-tertiary">{formatTimeAgo(timestamp)}</span>
            <span className="text-[10px] text-content-tertiary/60">{formatTimestamp(timestamp)}</span>
          </div>
        </div>

        {isCompleted && payload && <ResourceBreakdown payload={payload} />}

        {isFailed && payload.error && (
          <p className="mt-2 text-xs text-destructive font-mono">{payload.error}</p>
        )}
      </div>
    </div>
  )
}

export default function ActivityPage() {
  const { environment } = useEnvironment()
  const { isOrgAdmin } = useCurrentRole()
  const events = useQuery(api.events.listSyncEvents, { environment, limit: 50 })

  if (!isOrgAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-20 text-content-tertiary">
          <p className="text-sm">Access denied</p>
        </div>
      </div>
    )
  }

  if (events === undefined) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div>
          <h1 className="text-2xl font-semibold text-content-primary">Activity</h1>
          <p className="text-content-tertiary text-sm mt-1">Sync and deploy history</p>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-content-tertiary" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-content-primary">Activity</h1>
        <p className="text-content-tertiary text-sm mt-1">Sync and deploy history</p>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/30 py-20">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-secondary mb-4">
            <Activity className="h-6 w-6 text-content-tertiary" />
          </div>
          <p className="text-sm text-content-secondary">No sync activity yet</p>
        </div>
      ) : (
        <div>
          {events.map((event: any) => (
            <EventRow key={event._id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
