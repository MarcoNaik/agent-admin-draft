"use client"

import { useState } from "react"
import {
  Zap,
  Loader2,
  Terminal,
  Search,
  ChevronDown,
  ArrowRight,
  Database,
  Play,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react"
import { useTriggers, useTriggerLastRunStatuses, useTriggerExecutions } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { Id } from "@convex/_generated/dataModel"

type Trigger = {
  _id: Id<"triggers">
  name: string
  slug: string
  description?: string
  entityType: string
  action: string
  condition?: Record<string, unknown>
  actions: Array<{
    tool: string
    args: Record<string, unknown>
    as?: string
  }>
  enabled: boolean
}

type LastRun = {
  status: string
  timestamp: number
  error?: string
  entityId?: string
}

const ACTION_COLORS: Record<string, string> = {
  created: "bg-success/12 text-success border-success/20",
  updated: "bg-warning/12 text-warning border-warning/20",
  deleted: "bg-destructive/12 text-destructive border-destructive/20",
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? "bg-primary/12 text-primary border-primary/20"
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-normal border", color)}>
      {action}
    </Badge>
  )
}

function ConditionDisplay({ condition }: { condition: Record<string, unknown> }) {
  const entries = Object.entries(condition)
  if (entries.length === 0) return null

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] text-content-tertiary">
        <Filter className="h-3 w-3" />
        <span>Conditions</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([path, value]) => (
          <div
            key={path}
            className="flex items-center gap-1 rounded bg-background-tertiary/50 px-2 py-1"
          >
            <span className="font-mono text-[11px] text-content-secondary">{path}</span>
            <span className="text-[11px] text-content-tertiary">=</span>
            <span className="font-mono text-[11px] text-content-primary">{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionPipeline({ actions }: { actions: Trigger["actions"] }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] text-content-tertiary">
        <Play className="h-3 w-3" />
        <span>Action Pipeline</span>
        <span className="text-[10px]">({actions.length} step{actions.length !== 1 ? "s" : ""})</span>
      </div>
      <div className="space-y-1.5">
        {actions.map((action, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-background-tertiary text-[10px] font-medium text-content-tertiary mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 rounded-lg border border-border/20 bg-background-tertiary/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium text-content-primary">
                  {action.tool}
                </span>
                {action.as && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono">
                    as: {action.as}
                  </Badge>
                )}
              </div>
              {Object.keys(action.args).length > 0 && (
                <pre className="mt-1.5 text-[11px] text-content-tertiary font-mono leading-relaxed overflow-x-auto">
                  {JSON.stringify(action.args, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TriggerExecutionRow({ event }: { event: Record<string, any> }) {
  const [showError, setShowError] = useState(false)
  const isSuccess = event.eventType === "trigger.executed"
  const payload = event.payload ?? {}

  return (
    <div className="rounded-lg border border-border/20 bg-background-tertiary/20 px-3 py-2.5">
      <div className="flex items-center gap-3">
        {isSuccess ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
        ) : (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-medium", isSuccess ? "text-success" : "text-destructive")}>
              {isSuccess ? "Success" : "Failed"}
            </span>
            {isSuccess && payload.actionsCount && (
              <span className="text-[11px] text-content-tertiary">
                {payload.actionsCount} action{payload.actionsCount !== 1 ? "s" : ""}
              </span>
            )}
            {!isSuccess && payload.failedAction && (
              <span className="font-mono text-[11px] text-content-tertiary">
                {payload.failedAction}
              </span>
            )}
          </div>
        </div>

        {event.entityId && (
          <span className="hidden sm:block font-mono text-[10px] text-content-tertiary truncate max-w-[120px]">
            {event.entityId}
          </span>
        )}

        <div className="flex items-center gap-1 text-[11px] text-content-tertiary shrink-0">
          <Clock className="h-3 w-3" />
          <span>{timeAgo(event.timestamp)}</span>
        </div>

        {!isSuccess && payload.error && (
          <button
            onClick={() => setShowError(!showError)}
            className="text-content-tertiary hover:text-content-secondary transition-colors cursor-pointer"
          >
            <AlertTriangle className="h-3 w-3" />
          </button>
        )}
      </div>

      {showError && payload.error && (
        <div className="mt-2 rounded bg-destructive/5 border border-destructive/10 px-2.5 py-2">
          <pre className="text-[11px] text-destructive/80 font-mono whitespace-pre-wrap break-all">
            {payload.error}
          </pre>
        </div>
      )}
    </div>
  )
}

function TriggerExecutionHistory({ triggerSlug }: { triggerSlug: string }) {
  const { environment } = useEnvironment()
  const executions = useTriggerExecutions(environment, triggerSlug, 20)

  if (executions === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-content-tertiary" />
      </div>
    )
  }

  if (executions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Clock className="h-5 w-5 text-content-tertiary mb-2" />
        <p className="text-xs text-content-tertiary">No executions yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {executions.map((event: Record<string, any>) => (
        <TriggerExecutionRow key={event._id} event={event} />
      ))}
    </div>
  )
}

function TriggerExpandedDetail({ trigger }: { trigger: Trigger }) {
  return (
    <Tabs defaultValue="definition" className="w-full">
      <TabsList className="h-8 bg-background-tertiary/50">
        <TabsTrigger value="definition" className="text-xs px-3 py-1 h-6">
          Definition
        </TabsTrigger>
        <TabsTrigger value="history" className="text-xs px-3 py-1 h-6">
          History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="definition" className="mt-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-md bg-background-tertiary px-3 py-1.5 text-content-secondary">
              <Database className="h-3.5 w-3.5" />
              <span className="text-xs font-mono font-medium">{trigger.entityType}</span>
            </div>
            <ArrowRight className="h-3 w-3 text-content-tertiary/40" />
            <ActionBadge action={trigger.action} />
            <ArrowRight className="h-3 w-3 text-content-tertiary/40" />
            <div className="flex items-center gap-2 rounded-md bg-background-tertiary px-3 py-1.5 text-content-secondary">
              <Play className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {trigger.condition && Object.keys(trigger.condition).length > 0 && (
            <ConditionDisplay condition={trigger.condition} />
          )}

          <ActionPipeline actions={trigger.actions} />
        </div>
      </TabsContent>

      <TabsContent value="history" className="mt-4">
        <TriggerExecutionHistory triggerSlug={trigger.slug} />
      </TabsContent>
    </Tabs>
  )
}

function LastRunIndicator({ lastRun }: { lastRun: LastRun }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
      {lastRun.status === "success" ? (
        <CheckCircle2 className="h-3 w-3 text-success" />
      ) : (
        <XCircle className="h-3 w-3 text-destructive" />
      )}
      <span className="text-[11px] text-content-tertiary">{timeAgo(lastRun.timestamp)}</span>
    </div>
  )
}

function TriggerRow({
  trigger,
  isExpanded,
  onToggle,
  lastRun,
}: {
  trigger: Trigger
  isExpanded: boolean
  onToggle: () => void
  lastRun?: LastRun
}) {
  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200",
        isExpanded
          ? "border-border/60 bg-background-secondary/70 shadow-sm shadow-black/5"
          : "border-border/30 bg-background-secondary/30 hover:border-border/50 hover:bg-background-secondary/50"
      )}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-4 text-left cursor-pointer"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background-tertiary text-content-secondary transition-colors duration-200">
          <Zap className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-content-primary">
              {trigger.name}
            </span>
            {!trigger.enabled && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                disabled
              </Badge>
            )}
          </div>
          {trigger.description && (
            <p className="text-xs text-content-tertiary mt-0.5 line-clamp-1">
              {trigger.description}
            </p>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs text-content-tertiary">
          <div className="flex items-center gap-1.5">
            <Database className="h-3 w-3" />
            <span className="font-mono">{trigger.entityType}</span>
          </div>
          <ActionBadge action={trigger.action} />
          <div className="flex items-center gap-1">
            <Play className="h-3 w-3" />
            <span>{trigger.actions.length}</span>
          </div>
        </div>

        {lastRun && <LastRunIndicator lastRun={lastRun} />}

        <div
          className={cn(
            "shrink-0 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        >
          <ChevronDown className="h-4 w-4 text-content-tertiary" />
        </div>
      </button>

      <div className="sm:hidden px-4 pb-3 -mt-1">
        <div className="flex items-center gap-3 text-xs text-content-tertiary">
          <div className="flex items-center gap-1.5">
            <Database className="h-3 w-3" />
            <span className="font-mono">{trigger.entityType}</span>
          </div>
          <ActionBadge action={trigger.action} />
          {lastRun && (
            <div className="flex items-center gap-1">
              {lastRun.status === "success" ? (
                <CheckCircle2 className="h-3 w-3 text-success" />
              ) : (
                <XCircle className="h-3 w-3 text-destructive" />
              )}
              <span className="text-[11px]">{timeAgo(lastRun.timestamp)}</span>
            </div>
          )}
        </div>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/20 px-5 py-5">
            {isExpanded && <TriggerExpandedDetail trigger={trigger} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatsBar({ triggers }: { triggers: Trigger[] }) {
  const enabledCount = triggers.filter((t) => t.enabled).length
  const disabledCount = triggers.filter((t) => !t.enabled).length
  const entityTypes = new Set(triggers.map((t) => t.entityType))

  return (
    <div className="flex items-center gap-4 text-xs text-content-tertiary">
      <span>{triggers.length} total</span>
      {enabledCount > 0 && <span>{enabledCount} enabled</span>}
      {disabledCount > 0 && <span>{disabledCount} disabled</span>}
      <span>{entityTypes.size} entity type{entityTypes.size !== 1 ? "s" : ""}</span>
    </div>
  )
}

export default function TriggersPage() {
  const { environment } = useEnvironment()
  const triggers = useTriggers(environment) as Trigger[] | undefined
  const lastRunStatuses = useTriggerLastRunStatuses(environment)
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<Id<"triggers"> | null>(null)

  if (triggers === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Triggers</h1>
          <p className="text-sm text-content-secondary mt-1">
            Automated actions on entity changes
          </p>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-content-tertiary" />
        </div>
      </div>
    )
  }

  const filtered = triggers.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      t.entityType.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase())
  )

  const toggleTrigger = (id: Id<"triggers">) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Triggers</h1>
          <p className="text-sm text-content-secondary mt-1">
            Automated actions on entity changes
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-xs font-normal text-content-tertiary"
        >
          {environment}
        </Badge>
      </div>

      <div className="flex items-center gap-3 rounded-md border border-border/20 bg-background-secondary/30 px-3 py-2 text-xs text-content-tertiary">
        <Terminal className="h-3.5 w-3.5 shrink-0 text-content-tertiary" />
        <span>
          Triggers are managed via{" "}
          <code className="mx-0.5 rounded bg-background-tertiary px-1.5 py-0.5 text-[11px] font-mono text-content-secondary">
            defineTrigger()
          </code>{" "}
          in your project and synced with{" "}
          <code className="mx-0.5 rounded bg-background-tertiary px-1.5 py-0.5 text-[11px] font-mono text-content-secondary">
            struere dev
          </code>
        </span>
      </div>

      {triggers.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-tertiary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter triggers..."
              className="h-8 bg-background-secondary/50 border-border/30 pl-9 text-xs placeholder:text-content-tertiary"
            />
          </div>
          <StatsBar triggers={triggers} />
        </div>
      )}

      {triggers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/30 py-20">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-secondary mb-4">
            <Zap className="h-6 w-6 text-content-tertiary" />
          </div>
          <p className="text-sm font-medium text-content-secondary">
            No triggers defined
          </p>
          <p className="text-xs text-content-tertiary mt-1.5 max-w-[280px] text-center">
            Define triggers in your project using the CLI to automate actions when entities change
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-content-tertiary">
            No triggers matching &quot;{search}&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((trigger) => (
            <TriggerRow
              key={trigger._id}
              trigger={trigger}
              isExpanded={expandedId === trigger._id}
              onToggle={() => toggleTrigger(trigger._id)}
              lastRun={lastRunStatuses?.[trigger.slug]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
