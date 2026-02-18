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
  RefreshCw,
  XOctagon,
  Skull,
  Timer,
} from "lucide-react"
import {
  useTriggers,
  useTriggerLastRunStatuses,
  useTriggerExecutions,
  useTriggerRuns,
  useTriggerRunStats,
  useRetryTriggerRun,
  useCancelTriggerRun,
} from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { AdminOnly } from "@/components/role-redirect"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger as SelectTriggerUI,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatDate } from "@/lib/utils"
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
  schedule?: {
    delay?: number
    at?: string
    offset?: number
    cancelPrevious?: boolean
  }
  retry?: {
    maxAttempts?: number
    backoffMs?: number
  }
  enabled: boolean
}

type LastRun = {
  status: string
  timestamp: number
  error?: string
  entityId?: string
}

type RunStatus = "pending" | "running" | "completed" | "failed" | "dead"

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

function ScheduleDisplay({ schedule, retry }: { schedule: Trigger["schedule"]; retry: Trigger["retry"] }) {
  if (!schedule) return null

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] text-content-tertiary">
        <Timer className="h-3 w-3" />
        <span>Schedule</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {schedule.delay && (
          <div className="rounded bg-background-tertiary/50 px-2 py-1">
            <span className="font-mono text-[11px] text-content-secondary">delay: {schedule.delay}ms</span>
          </div>
        )}
        {schedule.at && (
          <div className="rounded bg-background-tertiary/50 px-2 py-1">
            <span className="font-mono text-[11px] text-content-secondary">at: {schedule.at}</span>
          </div>
        )}
        {schedule.offset !== undefined && schedule.offset !== 0 && (
          <div className="rounded bg-background-tertiary/50 px-2 py-1">
            <span className="font-mono text-[11px] text-content-secondary">offset: {schedule.offset}ms</span>
          </div>
        )}
        {schedule.cancelPrevious && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">cancelPrevious</Badge>
        )}
        {retry && (
          <div className="rounded bg-background-tertiary/50 px-2 py-1">
            <span className="font-mono text-[11px] text-content-secondary">
              retry: {retry.maxAttempts ?? 1}x / {retry.backoffMs ?? 60000}ms
            </span>
          </div>
        )}
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

type ExecutionLogEntry = {
  tool: string
  as?: string
  args: Record<string, unknown>
  status: "success" | "failed"
  result?: unknown
  error?: string
  stack?: string
  durationMs: number
}

function ExecutionLogStep({ step, index }: { step: ExecutionLogEntry; index: number }) {
  const [expanded, setExpanded] = useState(step.status === "failed")

  return (
    <div className={cn(
      "rounded-lg border px-3 py-2",
      step.status === "failed"
        ? "border-destructive/20 bg-destructive/5"
        : "border-border/20 bg-background-tertiary/20"
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left cursor-pointer"
      >
        <div className={cn(
          "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded text-[10px] font-medium",
          step.status === "failed"
            ? "bg-destructive/15 text-destructive"
            : "bg-success/15 text-success"
        )}>
          {index + 1}
        </div>
        <span className="font-mono text-[11px] font-medium text-content-primary">{step.tool}</span>
        {step.as && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono">
            as: {step.as}
          </Badge>
        )}
        <span className="text-[10px] text-content-tertiary ml-auto shrink-0">
          {step.durationMs}ms
        </span>
        {step.status === "failed" && (
          <XCircle className="h-3 w-3 shrink-0 text-destructive" />
        )}
        {step.status === "success" && (
          <CheckCircle2 className="h-3 w-3 shrink-0 text-success" />
        )}
        <ChevronDown className={cn(
          "h-3 w-3 shrink-0 text-content-tertiary transition-transform duration-150",
          expanded && "rotate-180"
        )} />
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-border/10 pt-2">
          <div>
            <span className="text-[10px] font-medium text-content-tertiary uppercase tracking-wider">Args</span>
            <pre className="mt-1 text-[11px] text-content-secondary font-mono whitespace-pre-wrap break-all bg-background-tertiary/50 rounded px-2 py-1.5 max-h-[200px] overflow-auto">
              {JSON.stringify(step.args, null, 2)}
            </pre>
          </div>

          {step.status === "success" && step.result !== undefined && (
            <div>
              <span className="text-[10px] font-medium text-success/70 uppercase tracking-wider">Result</span>
              <pre className="mt-1 text-[11px] text-content-secondary font-mono whitespace-pre-wrap break-all bg-background-tertiary/50 rounded px-2 py-1.5 max-h-[200px] overflow-auto">
                {JSON.stringify(step.result, null, 2)}
              </pre>
            </div>
          )}

          {step.status === "failed" && step.error && (
            <div>
              <span className="text-[10px] font-medium text-destructive/70 uppercase tracking-wider">Error</span>
              <pre className="mt-1 text-[11px] text-destructive/80 font-mono whitespace-pre-wrap break-all bg-destructive/5 border border-destructive/10 rounded px-2 py-1.5">
                {step.error}
              </pre>
            </div>
          )}

          {step.status === "failed" && step.stack && (
            <div>
              <span className="text-[10px] font-medium text-destructive/50 uppercase tracking-wider">Stack Trace</span>
              <pre className="mt-1 text-[10px] text-content-tertiary font-mono whitespace-pre-wrap break-all bg-background-tertiary/50 rounded px-2 py-1.5 max-h-[150px] overflow-auto">
                {step.stack}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TriggerExecutionRow({ event }: { event: Record<string, any> }) {
  const [showLogs, setShowLogs] = useState(false)
  const isSuccess = event.eventType === "trigger.executed"
  const payload = event.payload ?? {}
  const executionLog = (payload.executionLog ?? []) as ExecutionLogEntry[]
  const hasLogs = executionLog.length > 0

  return (
    <div className={cn(
      "rounded-lg border transition-colors",
      showLogs ? "border-border/40 bg-background-tertiary/30" : "border-border/20 bg-background-tertiary/20"
    )}>
      <button
        onClick={() => hasLogs && setShowLogs(!showLogs)}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2.5 text-left",
          hasLogs && "cursor-pointer"
        )}
      >
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
            {!isSuccess && payload.failedActionIndex !== undefined && payload.totalActions && (
              <span className="text-[11px] text-content-tertiary">
                at step {payload.failedActionIndex + 1}/{payload.totalActions}
              </span>
            )}
            {!isSuccess && payload.failedAction && (
              <span className="font-mono text-[11px] text-destructive/60">
                {payload.failedAction}
              </span>
            )}
            {isSuccess && payload.actionsCount && (
              <span className="text-[11px] text-content-tertiary">
                {payload.actionsCount} action{payload.actionsCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {!isSuccess && payload.error && !showLogs && (
            <p className="text-[11px] text-destructive/60 mt-0.5 line-clamp-1 font-mono">
              {payload.error}
            </p>
          )}
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

        {hasLogs && (
          <ChevronDown className={cn(
            "h-3.5 w-3.5 shrink-0 text-content-tertiary transition-transform duration-150",
            showLogs && "rotate-180"
          )} />
        )}

        {!hasLogs && !isSuccess && payload.error && (
          <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
        )}
      </button>

      {showLogs && (
        <div className="border-t border-border/20 px-3 pb-3 pt-2 space-y-3">
          {payload.triggerData && (
            <div>
              <span className="text-[10px] font-medium text-content-tertiary uppercase tracking-wider">Trigger Data</span>
              <pre className="mt-1 text-[11px] text-content-secondary font-mono whitespace-pre-wrap break-all bg-background-tertiary/50 rounded px-2 py-1.5 max-h-[150px] overflow-auto">
                {JSON.stringify(payload.triggerData, null, 2)}
              </pre>
            </div>
          )}

          <div>
            <span className="text-[10px] font-medium text-content-tertiary uppercase tracking-wider">
              Execution Log ({executionLog.length} step{executionLog.length !== 1 ? "s" : ""})
            </span>
            <div className="mt-1.5 space-y-1.5">
              {executionLog.map((step, i) => (
                <ExecutionLogStep key={i} step={step} index={i} />
              ))}
            </div>
          </div>
        </div>
      )}

      {!hasLogs && !isSuccess && payload.error && showLogs && (
        <div className="border-t border-border/20 px-3 pb-3 pt-2">
          <pre className="text-[11px] text-destructive/80 font-mono whitespace-pre-wrap break-all bg-destructive/5 border border-destructive/10 rounded px-2.5 py-2">
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
            {trigger.schedule && (
              <>
                <ArrowRight className="h-3 w-3 text-content-tertiary/40" />
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal border border-blue-500/20 bg-blue-500/12 text-blue-400">
                  scheduled
                </Badge>
              </>
            )}
            <ArrowRight className="h-3 w-3 text-content-tertiary/40" />
            <div className="flex items-center gap-2 rounded-md bg-background-tertiary px-3 py-1.5 text-content-secondary">
              <Play className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {trigger.condition && Object.keys(trigger.condition).length > 0 && (
            <ConditionDisplay condition={trigger.condition} />
          )}

          <ScheduleDisplay schedule={trigger.schedule} retry={trigger.retry} />

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
            {trigger.schedule && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal border-blue-500/20 text-blue-400">
                scheduled
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
  const scheduledCount = triggers.filter((t) => t.schedule).length
  const entityTypes = new Set(triggers.map((t) => t.entityType))

  return (
    <div className="flex items-center gap-4 text-xs text-content-tertiary">
      <span>{triggers.length} total</span>
      {enabledCount > 0 && <span>{enabledCount} enabled</span>}
      {disabledCount > 0 && <span>{disabledCount} disabled</span>}
      {scheduledCount > 0 && <span>{scheduledCount} scheduled</span>}
      <span>{entityTypes.size} entity type{entityTypes.size !== 1 ? "s" : ""}</span>
    </div>
  )
}

function getRunStatusIcon(status: RunStatus) {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-500" />
    case "running":
      return <Play className="h-4 w-4 text-blue-500" />
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />
    case "dead":
      return <Skull className="h-4 w-4 text-gray-500" />
  }
}

function getRunStatusVariant(status: RunStatus): "default" | "secondary" | "destructive" | "success" | "warning" {
  switch (status) {
    case "pending": return "warning"
    case "running": return "default"
    case "completed": return "success"
    case "failed": return "destructive"
    case "dead": return "secondary"
  }
}

function ScheduledRunsTab() {
  const { environment } = useEnvironment()
  const [statusFilter, setStatusFilter] = useState<RunStatus | undefined>(undefined)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const runs = useTriggerRuns(environment, statusFilter)
  const stats = useTriggerRunStats(environment)
  const retryRun = useRetryTriggerRun()
  const cancelRun = useCancelTriggerRun()

  const handleCancel = async (runId: string) => {
    setActionLoading(runId)
    try {
      await cancelRun({ runId: runId as any })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRetry = async (runId: string) => {
    setActionLoading(runId)
    try {
      await retryRun({ runId: runId as any })
    } finally {
      setActionLoading(null)
    }
  }

  if (runs === undefined || stats === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-content-tertiary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-5">
        {(["pending", "running", "completed", "failed", "dead"] as const).map((status) => {
          const icons = { pending: Clock, running: Play, completed: CheckCircle2, failed: XCircle, dead: Skull }
          const colors = { pending: "text-yellow-500 bg-yellow-500/10", running: "text-blue-500 bg-blue-500/10", completed: "text-green-500 bg-green-500/10", failed: "text-red-500 bg-red-500/10", dead: "text-gray-500 bg-gray-500/10" }
          const Icon = icons[status]
          const color = colors[status]
          return (
            <Card key={status}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2.5">
                  <div className={cn("rounded-full p-1.5", color.split(" ")[1])}>
                    <Icon className={cn("h-3.5 w-3.5", color.split(" ")[0])} />
                  </div>
                  <div>
                    <p className="text-[11px] text-content-tertiary capitalize">{status}</p>
                    <p className="text-lg font-bold">{stats[status] || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-content-secondary">{runs.length} runs</span>
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v as RunStatus)}
        >
          <SelectTriggerUI className="w-[140px] h-8 text-xs">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTriggerUI>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="dead">Dead</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Timer className="mb-3 h-8 w-8 text-content-tertiary/50" />
          <p className="text-sm text-content-secondary">No scheduled runs</p>
          <p className="mt-1 text-xs text-content-tertiary">
            Scheduled trigger runs will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run: any) => (
            <div
              key={run._id}
              className="flex items-center justify-between rounded-lg border border-border/30 bg-background-secondary/30 p-3"
            >
              <div className="flex items-center gap-3">
                {getRunStatusIcon(run.status)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{run.triggerSlug}</span>
                    <Badge variant={getRunStatusVariant(run.status)} className="text-[10px]">{run.status}</Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-content-tertiary">
                    <span>Attempts: {run.attempts}/{run.maxAttempts}</span>
                    <span>Scheduled: {formatDate(new Date(run.scheduledFor).toISOString())}</span>
                    {run.completedAt && <span>Done: {formatDate(new Date(run.completedAt).toISOString())}</span>}
                  </div>
                  {run.errorMessage && (
                    <p className="mt-1 text-[11px] text-destructive line-clamp-1">{run.errorMessage}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {run.status === "pending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleCancel(run._id)}
                    disabled={actionLoading === run._id}
                  >
                    <XOctagon className="mr-1.5 h-3 w-3" />
                    Cancel
                  </Button>
                )}
                {(run.status === "failed" || run.status === "dead") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleRetry(run._id)}
                    disabled={actionLoading === run._id}
                  >
                    <RefreshCw className="mr-1.5 h-3 w-3" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TriggersPageContent() {
  const { environment } = useEnvironment()
  const triggers = useTriggers(environment) as Trigger[] | undefined
  const lastRunStatuses = useTriggerLastRunStatuses(environment)
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<Id<"triggers"> | null>(null)
  const [activeTab, setActiveTab] = useState("triggers")

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

  const hasScheduledTriggers = triggers.some((t) => t.schedule)

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

      {hasScheduledTriggers ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-9 bg-background-tertiary/50">
            <TabsTrigger value="triggers" className="text-xs px-4 py-1.5 h-7">
              Triggers
            </TabsTrigger>
            <TabsTrigger value="runs" className="text-xs px-4 py-1.5 h-7">
              Scheduled Runs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="triggers" className="mt-4">
            <TriggersListContent
              triggers={triggers}
              filtered={filtered}
              search={search}
              setSearch={setSearch}
              expandedId={expandedId}
              toggleTrigger={toggleTrigger}
              lastRunStatuses={lastRunStatuses}
            />
          </TabsContent>

          <TabsContent value="runs" className="mt-4">
            <ScheduledRunsTab />
          </TabsContent>
        </Tabs>
      ) : (
        <TriggersListContent
          triggers={triggers}
          filtered={filtered}
          search={search}
          setSearch={setSearch}
          expandedId={expandedId}
          toggleTrigger={toggleTrigger}
          lastRunStatuses={lastRunStatuses}
        />
      )}
    </div>
  )
}

function TriggersListContent({
  triggers,
  filtered,
  search,
  setSearch,
  expandedId,
  toggleTrigger,
  lastRunStatuses,
}: {
  triggers: Trigger[]
  filtered: Trigger[]
  search: string
  setSearch: (s: string) => void
  expandedId: Id<"triggers"> | null
  toggleTrigger: (id: Id<"triggers">) => void
  lastRunStatuses: Record<string, LastRun> | undefined
}) {
  return (
    <>
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
    </>
  )
}

export default function TriggersPage() {
  return (
    <AdminOnly>
      <div className="p-6 max-w-4xl">
        <TriggersPageContent />
      </div>
    </AdminOnly>
  )
}
