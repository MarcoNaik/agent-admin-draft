"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, Cpu, Zap, User, Bot, Server, Webhook } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatRelativeTime, formatDuration } from "@/lib/format"

export interface ActivityFeedItem {
  type: "event" | "trigger" | "execution"
  id: string
  timestamp: number
  data: any
}

function getEventTypeColor(eventType: string): string {
  if (eventType.includes("created")) return "bg-success"
  if (eventType.includes("updated")) return "bg-ocean"
  if (eventType.includes("deleted")) return "bg-destructive"
  if (eventType.includes("completed")) return "bg-success"
  if (eventType.includes("failed")) return "bg-destructive"
  if (eventType.includes("cancelled")) return "bg-warning"
  return "bg-muted-foreground"
}

function ActorIcon({ actorType }: { actorType: string }) {
  switch (actorType) {
    case "user": return <User className="h-3 w-3" />
    case "agent": return <Bot className="h-3 w-3" />
    case "system": return <Server className="h-3 w-3" />
    case "webhook": return <Webhook className="h-3 w-3" />
    default: return <Server className="h-3 w-3" />
  }
}

function getStatusVariant(status: string) {
  switch (status) {
    case "success":
    case "completed": return "success" as const
    case "error":
    case "failed": return "destructive" as const
    case "running":
    case "pending": return "warning" as const
    case "timeout": return "amber" as const
    default: return "secondary" as const
  }
}

function EventActivityItem({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false)
  const hasPayload = data.payload && Object.keys(data.payload).length > 0

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className={cn("h-2 w-2 rounded-full shrink-0", getEventTypeColor(data.eventType))} />
        <button
          type="button"
          onClick={() => hasPayload && setExpanded(!expanded)}
          className={cn("text-xs font-medium truncate", hasPayload && "cursor-pointer hover:underline")}
        >
          {data.eventType}
        </button>
        {data.actorType && (
          <Badge variant="outline" className="text-[10px] gap-0.5 px-1 py-0 h-4 shrink-0">
            <ActorIcon actorType={data.actorType} />
          </Badge>
        )}
      </div>
      <p className="text-[10px] text-content-tertiary pl-4">
        {formatRelativeTime(data.timestamp)}
      </p>
      {expanded && hasPayload && (
        <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[10px] max-h-40 overflow-y-auto">
          {JSON.stringify(data.payload, null, 2)}
        </pre>
      )}
    </div>
  )
}

function TriggerActivityItem({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = data.result || data.error

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Zap className="h-3 w-3 text-amber shrink-0" />
        <span className="text-xs font-medium truncate">{data.triggerSlug}</span>
        <Badge variant={getStatusVariant(data.status)} className="text-[10px] px-1 py-0 h-4 shrink-0">
          {data.status}
        </Badge>
      </div>
      <p className="text-[10px] text-content-tertiary pl-5">
        {formatRelativeTime(data.createdAt)}
      </p>
      {hasDetail && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-content-secondary pl-5 hover:underline"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Details
        </button>
      )}
      {expanded && hasDetail && (
        <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[10px] max-h-40 overflow-y-auto">
          {JSON.stringify(data.error ?? data.result, null, 2)}
        </pre>
      )}
    </div>
  )
}

function ExecutionActivityItem({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false)
  const hasToolCalls = data.toolCalls && data.toolCalls.length > 0

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Cpu className="h-3 w-3 text-ocean shrink-0" />
        <span className="text-xs font-medium truncate">{data.model ?? "unknown"}</span>
        <Badge variant={getStatusVariant(data.status)} className="text-[10px] px-1 py-0 h-4 shrink-0">
          {data.status}
        </Badge>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-content-tertiary pl-5">
        <span>{data.inputTokens + data.outputTokens} tokens</span>
        <span>·</span>
        <span>{formatDuration(data.durationMs)}</span>
        <span>·</span>
        <span>{formatRelativeTime(data.createdAt)}</span>
      </div>
      {hasToolCalls && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-content-secondary pl-5 hover:underline"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {data.toolCalls.length} tool call{data.toolCalls.length > 1 ? "s" : ""}
        </button>
      )}
      {expanded && hasToolCalls && (
        <div className="pl-5 space-y-1">
          {data.toolCalls.map((tc: any, i: number) => (
            <div key={i} className="rounded bg-muted p-2">
              <span className="text-[10px] font-mono font-medium">{tc.name}</span>
              <pre className="text-[10px] overflow-x-auto max-h-24 overflow-y-auto mt-0.5">
                {JSON.stringify(tc.arguments, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ActivityItem({ item }: { item: ActivityFeedItem }) {
  return (
    <div className="rounded-md border px-3 py-2 bg-background">
      {item.type === "event" && <EventActivityItem data={item.data} />}
      {item.type === "trigger" && <TriggerActivityItem data={item.data} />}
      {item.type === "execution" && <ExecutionActivityItem data={item.data} />}
    </div>
  )
}
