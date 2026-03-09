"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, Cpu, Zap, User, Bot, Server, Webhook } from "lucide-react"
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

function getStatusColor(status: string) {
  switch (status) {
    case "success": case "completed": return "text-success"
    case "error": case "failed": case "dead": return "text-destructive"
    case "running": case "pending": return "text-amber"
    case "timeout": return "text-warning"
    default: return "text-content-tertiary"
  }
}

function ActorIcon({ actorType }: { actorType: string }) {
  switch (actorType) {
    case "user": return <User className="h-3 w-3 text-content-tertiary" />
    case "agent": return <Bot className="h-3 w-3 text-content-tertiary" />
    case "system": return <Server className="h-3 w-3 text-content-tertiary" />
    case "webhook": return <Webhook className="h-3 w-3 text-content-tertiary" />
    default: return <Server className="h-3 w-3 text-content-tertiary" />
  }
}

function EventActivityItem({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false)
  const hasPayload = data.payload && Object.keys(data.payload).length > 0

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", getEventTypeColor(data.eventType))} />
        <button
          type="button"
          onClick={() => hasPayload && setExpanded(!expanded)}
          className={cn("text-[11px] font-medium truncate", hasPayload && "cursor-pointer hover:underline")}
        >
          {data.eventType}
        </button>
        <span className="text-[10px] text-content-tertiary">·</span>
        <span className="text-[10px] text-content-tertiary shrink-0">{formatRelativeTime(data.timestamp)}</span>
        {data.actorType && (
          <ActorIcon actorType={data.actorType} />
        )}
      </div>
      {expanded && hasPayload && (
        <pre className="overflow-x-auto p-2 text-[10px] max-h-40 overflow-y-auto">
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
        <span className="text-[11px] font-medium truncate">{data.triggerSlug}</span>
        <span className={cn("text-[10px] shrink-0", getStatusColor(data.status))}>{data.status}</span>
        <span className="text-[10px] text-content-tertiary">·</span>
        <span className="text-[10px] text-content-tertiary shrink-0">{formatRelativeTime(data.createdAt)}</span>
      </div>
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
        <pre className="overflow-x-auto p-2 text-[10px] max-h-40 overflow-y-auto pl-5">
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
        <span className="text-[11px] font-medium truncate">{data.model ?? "unknown"}</span>
        <span className={cn("text-[10px] shrink-0", getStatusColor(data.status))}>{data.status}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-content-tertiary pl-5">
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
            <div key={i}>
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

export function ActivityItem({ item, isNew }: { item: ActivityFeedItem; isNew?: boolean }) {
  return (
    <div className={cn("px-3 py-2", isNew && "animate-feed-in")}>
      {item.type === "event" && <EventActivityItem data={item.data} />}
      {item.type === "trigger" && <TriggerActivityItem data={item.data} />}
      {item.type === "execution" && <ExecutionActivityItem data={item.data} />}
    </div>
  )
}
