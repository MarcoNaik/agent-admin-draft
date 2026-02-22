"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, User, Bot, Server, Webhook } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type ActorType = "user" | "agent" | "system" | "webhook"

interface EntityEvent {
  id: string
  eventType: string
  actorType: ActorType
  actorId?: string | null
  payload: Record<string, unknown>
  timestamp: string
}

interface EntityTimelineProps {
  events: EntityEvent[]
}

function formatTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "-"
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return "-"
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date)
  } catch {
    return "-"
  }
}

function getEventTypeColor(eventType: string): string {
  if (eventType.includes("created")) return "bg-success"
  if (eventType.includes("updated")) return "bg-ocean"
  if (eventType.includes("deleted")) return "bg-destructive"
  if (eventType.includes("completed")) return "bg-success"
  if (eventType.includes("failed")) return "bg-destructive"
  if (eventType.includes("cancelled")) return "bg-warning"
  if (eventType.includes("reminder")) return "bg-primary"
  return "bg-muted-foreground"
}

function ActorIcon({ actorType }: { actorType: ActorType }) {
  switch (actorType) {
    case "user":
      return <User className="h-3 w-3" />
    case "agent":
      return <Bot className="h-3 w-3" />
    case "system":
      return <Server className="h-3 w-3" />
    case "webhook":
      return <Webhook className="h-3 w-3" />
    default:
      return <Server className="h-3 w-3" />
  }
}

function EventItem({ event }: { event: EntityEvent }) {
  const [expanded, setExpanded] = useState(false)
  const hasPayload = Object.keys(event.payload).length > 0

  return (
    <div className="relative pl-6 pb-6 last:pb-0">
      <div className={cn("absolute left-0 top-1 h-3 w-3 rounded-full", getEventTypeColor(event.eventType))} />
      <div className="absolute left-[5px] top-4 bottom-0 w-0.5 bg-border last:hidden" />

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => hasPayload && setExpanded(!expanded)}
            className={cn(
              "flex items-center gap-1 text-sm font-medium",
              hasPayload && "cursor-pointer hover:underline"
            )}
            disabled={!hasPayload}
          >
            {hasPayload && (
              expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
            )}
            <span>{event.eventType}</span>
          </button>
          <Badge variant="outline" className="text-xs gap-1">
            <ActorIcon actorType={event.actorType} />
            {event.actorType}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatTimestamp(event.timestamp)}</span>
          {event.actorId && <span>by {event.actorId}</span>}
        </div>

        {expanded && hasPayload && (
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

export function EntityTimeline({ events }: EntityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-muted-foreground">No events recorded</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {events.map((event) => (
        <EventItem key={event.id} event={event} />
      ))}
    </div>
  )
}
