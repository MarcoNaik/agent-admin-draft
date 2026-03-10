"use client"

import { useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Zap,
  Search,
  Plus,
  Pencil,
  Trash2,
  Link,
  Unlink,
  Send,
  Calendar,
  CreditCard,
  Bot,
  Wrench,
  MessageSquare,
  Sparkles,
} from "@/lib/icons"
import { cn } from "@/lib/utils"
import { formatRelativeTime, formatDuration } from "@/lib/format"

export interface ActivityFeedItem {
  type: "event" | "trigger" | "tool_call" | "thinking"
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

function ToolIcon({ name }: { name: string }) {
  const cls = "h-3 w-3 shrink-0"
  if (name.startsWith("entity.query") || name.startsWith("event.query")) return <Search className={cn(cls, "text-ocean")} />
  if (name.startsWith("entity.create")) return <Plus className={cn(cls, "text-success")} />
  if (name.startsWith("entity.update")) return <Pencil className={cn(cls, "text-ocean")} />
  if (name.startsWith("entity.delete")) return <Trash2 className={cn(cls, "text-destructive")} />
  if (name.startsWith("entity.link")) return <Link className={cn(cls, "text-ocean")} />
  if (name.startsWith("entity.unlink")) return <Unlink className={cn(cls, "text-content-tertiary")} />
  if (name.startsWith("whatsapp.") || name.startsWith("email.")) return <Send className={cn(cls, "text-ocean")} />
  if (name.startsWith("calendar.")) return <Calendar className={cn(cls, "text-amber")} />
  if (name.startsWith("payment.")) return <CreditCard className={cn(cls, "text-success")} />
  if (name.startsWith("agent.chat")) return <MessageSquare className={cn(cls, "text-ocean")} />
  if (name.startsWith("event.emit")) return <Zap className={cn(cls, "text-amber")} />
  return <Wrench className={cn(cls, "text-content-tertiary")} />
}

function humanizeToolCall(name: string, args: any): string {
  const a = args ?? {}

  if (name === "entity.query") {
    const type = a.entityType ?? a.type ?? ""
    const filters = a.filter ?? a.where ?? a.filters
    if (type && filters) return `Searched ${type} with filters`
    if (type) return `Looked up ${type} records`
    return "Queried data"
  }
  if (name === "entity.create") {
    const type = a.entityType ?? a.type ?? "record"
    const displayName = a.data?.name ?? a.data?.title ?? a.data?.student ?? a.data?.email ?? ""
    return displayName ? `Created ${type} "${displayName}"` : `Created new ${type}`
  }
  if (name === "entity.update") {
    const type = a.entityType ?? a.type ?? "record"
    return `Updated ${type}`
  }
  if (name === "entity.delete") {
    const type = a.entityType ?? a.type ?? "record"
    return `Deleted ${type}`
  }
  if (name === "entity.get") {
    const type = a.entityType ?? a.type ?? "record"
    return `Retrieved ${type}`
  }
  if (name === "entity.link") return "Linked records"
  if (name === "entity.unlink") return "Unlinked records"
  if (name === "event.emit") return `Emitted ${a.eventType ?? "event"}`
  if (name === "event.query") return "Queried events"
  if (name === "whatsapp.send") return `Sent WhatsApp message`
  if (name === "whatsapp.sendTemplate") return `Sent WhatsApp template`
  if (name === "whatsapp.sendMedia") return `Sent WhatsApp media`
  if (name === "whatsapp.getConversation") return "Loaded conversation"
  if (name === "email.send") return `Sent email${a.to ? ` to ${a.to}` : ""}`
  if (name === "calendar.list") return "Checked calendar"
  if (name === "calendar.create") return "Created appointment"
  if (name === "calendar.update") return "Updated appointment"
  if (name === "calendar.delete") return "Cancelled appointment"
  if (name === "calendar.freeBusy") return "Checked availability"
  if (name === "payment.create") return `Created payment${a.amount ? ` for $${a.amount}` : ""}`
  if (name === "payment.getStatus") return "Checked payment status"
  if (name === "agent.chat") return `Consulted ${a.agentSlug ?? "another agent"}`

  const clean = name
    .replace(/([A-Z])/g, " $1")
    .replace(/[._]/g, " ")
    .replace(/^\w/, c => c.toUpperCase())
    .trim()
  return clean
}

function summarizeResult(name: string, result: any): string | null {
  if (!result) return null
  if (name === "entity.query") {
    if (Array.isArray(result)) return `${result.length} result${result.length !== 1 ? "s" : ""}`
    if (result.results && Array.isArray(result.results)) return `${result.results.length} result${result.results.length !== 1 ? "s" : ""}`
    return null
  }
  if (name === "entity.create" || name === "entity.get") {
    const id = result._id ?? result.id
    const display = result.data?.name ?? result.data?.title ?? result.data?.email
    if (display) return String(display)
    if (id) return `ID: ${String(id).slice(-6)}`
    return null
  }
  if (name === "payment.create" && result.url) return "Payment link created"
  if (result.success === true) return "Done"
  if (result.error) return result.error
  return null
}

function ToolCallItem({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false)
  const label = humanizeToolCall(data.name, data.arguments)
  const resultSummary = summarizeResult(data.name, data.result)
  const failed = data.result?.error || data.result?.success === false

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <ToolIcon name={data.name} />
        <span className="text-[11px] text-content-primary truncate">{label}</span>
        <span className="text-[10px] text-content-tertiary shrink-0">{formatRelativeTime(data.timestamp)}</span>
      </div>
      {resultSummary && (
        <div className="pl-5">
          <span className={cn("text-[10px]", failed ? "text-destructive" : "text-content-tertiary")}>
            {resultSummary}
          </span>
        </div>
      )}
      {(data.arguments || data.result) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-content-tertiary hover:text-content-secondary transition-colors pl-5"
        >
          {expanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
          Details
        </button>
      )}
      {expanded && (
        <div className="pl-5 space-y-1">
          {data.arguments && Object.keys(data.arguments).length > 0 && (
            <pre className="text-[10px] text-content-secondary overflow-x-auto max-h-32 overflow-y-auto">
              {JSON.stringify(data.arguments, null, 2)}
            </pre>
          )}
          {data.result && (
            <pre className={cn("text-[10px] overflow-x-auto max-h-32 overflow-y-auto", failed ? "text-destructive" : "text-content-tertiary")}>
              {JSON.stringify(data.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function ThinkingItem({ data }: { data: any }) {
  return (
    <div className="flex items-center gap-2">
      <Sparkles className="h-3 w-3 shrink-0 text-content-tertiary" />
      <span className="text-[11px] text-content-tertiary">
        {data.status === "running" ? "Thinking..." : "Thought"}
      </span>
      {data.durationMs && (
        <span className="text-[10px] text-content-tertiary">{formatDuration(data.durationMs)}</span>
      )}
      <span className="text-[10px] text-content-tertiary shrink-0">{formatRelativeTime(data.createdAt)}</span>
    </div>
  )
}

function EventItem({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false)
  const hasPayload = data.payload && Object.keys(data.payload).length > 0

  const parts = (data.eventType ?? "").split(".")
  const entity = parts[0] ?? ""
  const action = parts[1] ?? data.eventType

  let label = data.eventType
  if (entity && action) {
    const actionMap: Record<string, string> = {
      created: "was created",
      updated: "was updated",
      deleted: "was deleted",
      linked: "was linked",
      unlinked: "was unlinked",
    }
    label = `${entity.charAt(0).toUpperCase() + entity.slice(1)} ${actionMap[action] ?? action}`
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", getEventTypeColor(data.eventType))} />
        <span className="text-[11px] text-content-primary truncate">{label}</span>
        <span className="text-[10px] text-content-tertiary shrink-0">{formatRelativeTime(data.timestamp)}</span>
      </div>
      {hasPayload && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-content-tertiary hover:text-content-secondary transition-colors pl-4"
        >
          {expanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
          Details
        </button>
      )}
      {expanded && hasPayload && (
        <pre className="overflow-x-auto pl-4 text-[10px] text-content-tertiary max-h-32 overflow-y-auto">
          {JSON.stringify(data.payload, null, 2)}
        </pre>
      )}
    </div>
  )
}

function TriggerItem({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = data.result || data.errorMessage

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <Zap className="h-3 w-3 text-amber shrink-0" />
        <span className="text-[11px] text-content-primary truncate">{data.triggerSlug}</span>
        <span className={cn("text-[10px] shrink-0", getStatusColor(data.status))}>{data.status}</span>
        <span className="text-[10px] text-content-tertiary shrink-0">{formatRelativeTime(data.createdAt)}</span>
      </div>
      {hasDetail && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-content-tertiary hover:text-content-secondary transition-colors pl-5"
        >
          {expanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
          Details
        </button>
      )}
      {expanded && hasDetail && (
        <pre className="overflow-x-auto pl-5 text-[10px] text-content-tertiary max-h-32 overflow-y-auto">
          {JSON.stringify(data.errorMessage ?? data.result, null, 2)}
        </pre>
      )}
    </div>
  )
}

export function ActivityItem({ item, isNew }: { item: ActivityFeedItem; isNew?: boolean }) {
  return (
    <div className={cn("px-3 py-2", isNew && "animate-feed-in")}>
      {item.type === "tool_call" && <ToolCallItem data={item.data} />}
      {item.type === "thinking" && <ThinkingItem data={item.data} />}
      {item.type === "event" && <EventItem data={item.data} />}
      {item.type === "trigger" && <TriggerItem data={item.data} />}
    </div>
  )
}
