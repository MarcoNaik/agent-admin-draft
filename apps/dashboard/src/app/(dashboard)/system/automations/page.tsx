"use client"

import { useState, useMemo } from "react"
import {
  Zap,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Database,
  Play,
  Filter,
  Clock,
  RefreshCw,
  XOctagon,
  Timer,
  X,
} from "@/lib/icons"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger as SelectTriggerUI,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn, formatDate } from "@/lib/utils"
import { Id } from "@convex/_generated/dataModel"
import { EmptyState } from "@/components/empty-state"

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

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`
  return `${Math.round(ms / 3600000)}h`
}

function StatusDot({ status }: { status: "success" | "failed" | "idle" | "disabled" | "pending" | "running" | "dead" }) {
  const colors = {
    success: "bg-success",
    failed: "bg-destructive",
    idle: "bg-content-tertiary/40",
    disabled: "bg-content-tertiary/20",
    pending: "bg-warning",
    running: "bg-ocean",
    dead: "bg-content-tertiary/30",
  }
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", colors[status])} />
}

function getTriggerStatus(trigger: Trigger, lastRun?: LastRun): "success" | "failed" | "idle" | "disabled" {
  if (!trigger.enabled) return "disabled"
  if (!lastRun) return "idle"
  return lastRun.status === "success" ? "success" : "failed"
}

function PipelineStep({ action, index, defaultExpanded }: { action: Trigger["actions"][0]; index: number; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const paramCount = Object.keys(action.args).length

  return (
    <div className="rounded-lg border border-border/20 bg-background-tertiary/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left cursor-pointer"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-background-tertiary text-[11px] font-medium text-content-tertiary">
          {index + 1}
        </span>
        <span className="font-mono text-xs font-medium text-content-primary">{action.tool}</span>
        {action.as && (
          <span className="text-[11px] text-content-tertiary">as {action.as}</span>
        )}
        <span className="ml-auto text-[11px] text-content-tertiary">
          {paramCount > 0 ? `${paramCount} param${paramCount !== 1 ? "s" : ""}` : "no params"}
        </span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 shrink-0 text-content-tertiary transition-transform duration-150",
          expanded && "rotate-180"
        )} />
      </button>
      {expanded && (
        <div className="border-t border-border/10 px-3 pb-2.5 pt-2">
          <pre className="text-[11px] text-content-secondary font-mono whitespace-pre-wrap break-all bg-background-tertiary/40 rounded px-2.5 py-2 max-h-[200px] overflow-auto leading-relaxed">
            {JSON.stringify(action.args, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function ExecutionLogStep({ step, index }: { step: ExecutionLogEntry; index: number }) {
  const [expanded, setExpanded] = useState(step.status === "failed")

  return (
    <div className={cn(
      "rounded-lg border px-3 py-2",
      step.status === "failed" ? "border-destructive/20 bg-destructive/5" : "border-border/15 bg-background-tertiary/15"
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 text-left cursor-pointer"
      >
        <StatusDot status={step.status === "failed" ? "failed" : "success"} />
        <span className="font-mono text-xs text-content-primary">{step.tool}</span>
        {step.as && (
          <span className="text-[11px] text-content-tertiary">as {step.as}</span>
        )}
        <span className="ml-auto text-[11px] text-content-tertiary">{formatMs(step.durationMs)}</span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 shrink-0 text-content-tertiary transition-transform duration-150",
          expanded && "rotate-180"
        )} />
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-border/10 pt-2">
          <div>
            <span className="text-[10px] font-medium text-content-tertiary uppercase tracking-wider">Args</span>
            <pre className="mt-1 text-[11px] text-content-secondary font-mono whitespace-pre-wrap break-all bg-background-tertiary/40 rounded px-2 py-1.5 max-h-[200px] overflow-auto">
              {JSON.stringify(step.args, null, 2)}
            </pre>
          </div>
          {step.status === "success" && step.result !== undefined && (
            <div>
              <span className="text-[10px] font-medium text-success/70 uppercase tracking-wider">Result</span>
              <pre className="mt-1 text-[11px] text-content-secondary font-mono whitespace-pre-wrap break-all bg-background-tertiary/40 rounded px-2 py-1.5 max-h-[200px] overflow-auto">
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
              <span className="text-[10px] font-medium text-destructive/50 uppercase tracking-wider">Stack</span>
              <pre className="mt-1 text-[10px] text-content-tertiary font-mono whitespace-pre-wrap break-all bg-background-tertiary/40 rounded px-2 py-1.5 max-h-[120px] overflow-auto">
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
  const [expanded, setExpanded] = useState(false)
  const isSuccess = event.eventType === "trigger.executed"
  const payload = event.payload ?? {}
  const executionLog = (payload.executionLog ?? []) as ExecutionLogEntry[]
  const totalDuration = executionLog.reduce((sum: number, s: ExecutionLogEntry) => sum + s.durationMs, 0)

  return (
    <div className={cn(
      "rounded-lg border transition-colors",
      expanded ? "border-border/40 bg-background-tertiary/20" : "border-border/15 hover:border-border/30"
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left cursor-pointer"
      >
        <StatusDot status={isSuccess ? "success" : "failed"} />
        <span className={cn("text-xs font-medium", isSuccess ? "text-content-primary" : "text-destructive")}>
          {isSuccess ? "Completed" : "Failed"}
          {!isSuccess && payload.failedAction && (
            <span className="font-normal text-content-tertiary"> at {payload.failedAction}</span>
          )}
        </span>
        <span className="text-[11px] text-content-tertiary">
          {executionLog.length} step{executionLog.length !== 1 ? "s" : ""}
          {totalDuration > 0 && ` · ${formatMs(totalDuration)}`}
        </span>
        <span className="ml-auto text-[11px] text-content-tertiary">{timeAgo(event.timestamp)}</span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 shrink-0 text-content-tertiary transition-transform duration-150",
          expanded && "rotate-180"
        )} />
      </button>

      {expanded && executionLog.length > 0 && (
        <div className="border-t border-border/15 px-3 pb-3 pt-2.5 space-y-2">
          {payload.triggerData && (
            <div>
              <span className="text-[10px] font-medium text-content-tertiary uppercase tracking-wider">Trigger Data</span>
              <pre className="mt-1 text-[11px] text-content-secondary font-mono whitespace-pre-wrap break-all bg-background-tertiary/40 rounded px-2 py-1.5 max-h-[120px] overflow-auto">
                {JSON.stringify(payload.triggerData, null, 2)}
              </pre>
            </div>
          )}
          <div className="space-y-1.5">
            {executionLog.map((step: ExecutionLogEntry, i: number) => (
              <ExecutionLogStep key={i} step={step} index={i} />
            ))}
          </div>
        </div>
      )}

      {expanded && !isSuccess && executionLog.length === 0 && payload.error && (
        <div className="border-t border-border/15 px-3 pb-3 pt-2.5">
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
  const executions = useTriggerExecutions(environment, triggerSlug, 10)

  if (executions === undefined) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-content-tertiary" />
      </div>
    )
  }

  if (executions.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-content-tertiary">No executions yet</p>
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

function TriggerExpandedDetail({ trigger, onViewRuns }: { trigger: Trigger; onViewRuns?: () => void }) {
  const [showHistory, setShowHistory] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 rounded-md bg-background-tertiary px-2.5 py-1 font-mono text-content-secondary">
          <Database className="h-3.5 w-3.5" />
          {trigger.entityType}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-content-tertiary/40" />
        <span className={cn(
          "rounded-md px-2.5 py-1 font-medium",
          trigger.action === "created" && "bg-success/10 text-success",
          trigger.action === "updated" && "bg-warning/10 text-warning",
          trigger.action === "deleted" && "bg-destructive/10 text-destructive",
          !["created", "updated", "deleted"].includes(trigger.action) && "bg-primary/10 text-primary"
        )}>
          {trigger.action}
        </span>
        {trigger.schedule && (
          <>
            <ArrowRight className="h-3.5 w-3.5 text-content-tertiary/40" />
            <span className="rounded-md bg-ocean/10 px-2.5 py-1 text-ocean">scheduled</span>
          </>
        )}
        <ArrowRight className="h-3.5 w-3.5 text-content-tertiary/40" />
        <span className="flex items-center gap-1.5 rounded-md bg-background-tertiary px-2.5 py-1 text-content-secondary">
          <Play className="h-3.5 w-3.5" />
          {trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {trigger.condition && Object.keys(trigger.condition).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-medium text-content-tertiary uppercase tracking-wider">Conditions</h4>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(trigger.condition).map(([path, value]) => (
              <span key={path} className="inline-flex items-center gap-1.5 rounded-md bg-background-tertiary/60 px-2.5 py-1 text-xs">
                <span className="font-mono text-content-secondary">{path}</span>
                <span className="text-content-tertiary">=</span>
                <span className="font-mono text-content-primary">{String(value)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {trigger.schedule && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-medium text-content-tertiary uppercase tracking-wider">Schedule</h4>
          <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
            {trigger.schedule.delay && (
              <span className="rounded-md bg-background-tertiary/60 px-2.5 py-1 font-mono">
                delay {formatMs(trigger.schedule.delay)}
              </span>
            )}
            {trigger.schedule.at && (
              <span className="rounded-md bg-background-tertiary/60 px-2.5 py-1 font-mono">
                at {trigger.schedule.at}
              </span>
            )}
            {trigger.schedule.offset !== undefined && trigger.schedule.offset !== 0 && (
              <span className="rounded-md bg-background-tertiary/60 px-2.5 py-1 font-mono">
                offset {formatMs(trigger.schedule.offset)}
              </span>
            )}
            {trigger.schedule.cancelPrevious && (
              <span className="rounded-md bg-background-tertiary/60 px-2.5 py-1">cancel previous</span>
            )}
            {trigger.retry && (
              <span className="rounded-md bg-background-tertiary/60 px-2.5 py-1 font-mono">
                retry {trigger.retry.maxAttempts ?? 1}× / {formatMs(trigger.retry.backoffMs ?? 60000)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-[11px] font-medium text-content-tertiary uppercase tracking-wider">
          Pipeline ({trigger.actions.length} step{trigger.actions.length !== 1 ? "s" : ""})
        </h4>
        <div className="space-y-1.5">
          {trigger.actions.map((action, i) => (
            <PipelineStep key={i} action={action} index={i} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-medium text-content-tertiary uppercase tracking-wider">Recent Runs</h4>
          <div className="flex items-center gap-2">
            {onViewRuns && (
              <button
                onClick={onViewRuns}
                className="text-[11px] text-ocean hover:text-ocean/80 transition-colors cursor-pointer"
              >
                View all runs →
              </button>
            )}
            {!showHistory && (
              <button
                onClick={() => setShowHistory(true)}
                className="text-[11px] text-content-tertiary hover:text-content-secondary transition-colors cursor-pointer"
              >
                Load history
              </button>
            )}
          </div>
        </div>
        {showHistory ? (
          <TriggerExecutionHistory triggerSlug={trigger.slug} />
        ) : (
          <p className="py-4 text-center text-xs text-content-tertiary">
            Click &quot;Load history&quot; to see execution logs
          </p>
        )}
      </div>
    </div>
  )
}

function TriggerRow({
  trigger,
  isExpanded,
  onToggle,
  lastRun,
  onViewRuns,
}: {
  trigger: Trigger
  isExpanded: boolean
  onToggle: () => void
  lastRun?: LastRun
  onViewRuns?: () => void
}) {
  const status = getTriggerStatus(trigger, lastRun)

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200",
        isExpanded
          ? "border-border/50 bg-background-secondary/60 shadow-sm shadow-black/5"
          : "border-border/20 hover:border-border/40 hover:bg-background-secondary/30",
        !trigger.enabled && "opacity-50"
      )}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left cursor-pointer"
      >
        <StatusDot status={status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-content-primary truncate">
              {trigger.name}
            </span>
            {!trigger.enabled && (
              <span className="text-xs text-content-tertiary">(paused)</span>
            )}
          </div>
          <p className="text-xs text-content-tertiary mt-0.5">
            When <span className="font-mono">{trigger.entityType}</span> is {trigger.action}
            {trigger.schedule && " · scheduled"}
            {" · "}{trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""}
          </p>
        </div>

        {lastRun && (
          <span className="hidden sm:block text-[11px] text-content-tertiary shrink-0">
            {timeAgo(lastRun.timestamp)}
          </span>
        )}

        <ChevronDown className={cn(
          "h-4 w-4 shrink-0 text-content-tertiary transition-transform duration-200",
          isExpanded && "rotate-180"
        )} />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/15 px-5 py-5">
            {isExpanded && <TriggerExpandedDetail trigger={trigger} onViewRuns={onViewRuns} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function ScheduledRunsTab({ triggerSlugFilter, onClearFilter }: { triggerSlugFilter?: string; onClearFilter: () => void }) {
  const { environment } = useEnvironment()
  const [statusFilter, setStatusFilter] = useState<RunStatus | undefined>(undefined)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const runs = useTriggerRuns(environment, statusFilter, triggerSlugFilter)
  const stats = useTriggerRunStats(environment)
  const retryRun = useRetryTriggerRun()
  const cancelRun = useCancelTriggerRun()

  const grouped = useMemo(() => {
    if (!runs) return {}
    const groups: Record<string, typeof runs> = {}
    for (const run of runs) {
      const key = (run as any).triggerSlug || "unknown"
      if (!groups[key]) groups[key] = []
      groups[key].push(run)
    }
    return groups
  }, [runs])

  const nonZeroStats = useMemo(() => {
    if (!stats) return []
    return (["pending", "running", "completed", "failed", "dead"] as const)
      .filter((s) => (stats[s] || 0) > 0)
      .map((s) => `${stats[s]} ${s}`)
  }, [stats])

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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {triggerSlugFilter && (
            <div className="flex items-center gap-1.5 rounded-md bg-ocean/10 px-2.5 py-1 text-xs text-ocean">
              <span className="font-mono">{triggerSlugFilter}</span>
              <button onClick={onClearFilter} className="cursor-pointer hover:text-ocean/70">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <span className="text-xs text-content-tertiary">
            {nonZeroStats.length > 0 ? nonZeroStats.join(" · ") : "No runs"}
          </span>
        </div>
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v as RunStatus)}
        >
          <SelectTriggerUI className="w-[140px] h-8 text-xs">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTriggerUI>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="dead">Dead</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Timer className="mb-2 h-5 w-5 text-content-tertiary/40" />
          <p className="text-sm text-content-secondary">No scheduled runs</p>
          <p className="mt-1 text-xs text-content-tertiary">
            {triggerSlugFilter ? `No runs for "${triggerSlugFilter}"` : "Scheduled runs will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([slug, slugRuns]) => (
            <div key={slug}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium font-mono text-content-secondary">{slug}</span>
                <span className="text-[11px] text-content-tertiary">({slugRuns.length})</span>
              </div>
              <div className="space-y-1.5">
                {slugRuns.map((run: any) => {
                  const statusLabel = {
                    pending: `Scheduled for ${formatDate(new Date(run.scheduledFor).toISOString())}`,
                    running: `Running since ${run.startedAt ? timeAgo(run.startedAt) : "now"}`,
                    completed: `Completed ${run.completedAt ? timeAgo(run.completedAt) : ""}`,
                    failed: `Failed ${run.completedAt ? timeAgo(run.completedAt) : ""}`,
                    dead: `Dead ${run.completedAt ? timeAgo(run.completedAt) : ""}`,
                  }[run.status as RunStatus] || run.status

                  return (
                    <div
                      key={run._id}
                      className="flex items-center gap-3 rounded-lg border border-border/15 px-3 py-2.5 hover:border-border/30 transition-colors"
                    >
                      <StatusDot status={run.status as any} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-content-primary">{statusLabel}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-content-tertiary">
                            {run.attempts}/{run.maxAttempts} attempts
                          </span>
                          {run.errorMessage && (
                            <span className="text-[11px] text-destructive/70 truncate max-w-[300px]">
                              {run.errorMessage}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {run.status === "pending" && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleCancel(run._id)}
                                  disabled={actionLoading === run._id}
                                >
                                  <XOctagon className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Cancel</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {(run.status === "failed" || run.status === "dead") && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleRetry(run._id)}
                                  disabled={actionLoading === run._id}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Retry</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
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
  onViewRuns,
}: {
  triggers: Trigger[]
  filtered: Trigger[]
  search: string
  setSearch: (s: string) => void
  expandedId: Id<"triggers"> | null
  toggleTrigger: (id: Id<"triggers">) => void
  lastRunStatuses: Record<string, LastRun> | undefined
  onViewRuns: (slug: string) => void
}) {
  return (
    <>
      {triggers.length > 0 && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-tertiary" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter automations..."
            className="h-8 bg-background-secondary/50 border-border/20 pl-9 text-xs placeholder:text-content-tertiary"
          />
        </div>
      )}

      {triggers.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No automations defined"
          description="Define automations in your project using the CLI to run actions when data changes."
          action={{
            label: "Read the docs",
            onClick: () => window.open("https://docs.struere.dev/triggers", "_blank"),
          }}
        />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-content-tertiary">
            No automations matching &quot;{search}&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((trigger) => (
            <TriggerRow
              key={trigger._id}
              trigger={trigger}
              isExpanded={expandedId === trigger._id}
              onToggle={() => toggleTrigger(trigger._id)}
              lastRun={lastRunStatuses?.[trigger.slug]}
              onViewRuns={trigger.schedule ? () => onViewRuns(trigger.slug) : undefined}
            />
          ))}
        </div>
      )}
    </>
  )
}

function TriggersPageContent() {
  const { environment } = useEnvironment()
  const triggers = useTriggers(environment) as Trigger[] | undefined
  const lastRunStatuses = useTriggerLastRunStatuses(environment)
  const stats = useTriggerRunStats(environment)
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<Id<"triggers"> | null>(null)
  const [activeTab, setActiveTab] = useState("triggers")
  const [triggerSlugFilter, setTriggerSlugFilter] = useState<string | undefined>(undefined)

  if (triggers === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-display font-semibold text-content-primary">Automations</h1>
          <p className="text-sm text-content-secondary mt-1">Automated actions on data changes</p>
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

  const handleViewRuns = (slug: string) => {
    setTriggerSlugFilter(slug)
    setActiveTab("runs")
  }

  const pendingCount = stats?.pending || 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-display font-semibold text-content-primary">Automations</h1>
        <p className="text-sm text-content-secondary mt-1">Automated actions on data changes</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-9 bg-background-tertiary/50">
          <TabsTrigger value="triggers" className="text-xs px-4 py-1.5 h-7">
            Automations{triggers.length > 0 && ` (${triggers.length})`}
          </TabsTrigger>
          <TabsTrigger value="runs" className="text-xs px-4 py-1.5 h-7">
            Runs{pendingCount > 0 && ` (${pendingCount} pending)`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="triggers" className="mt-4 space-y-3">
          <TriggersListContent
            triggers={triggers}
            filtered={filtered}
            search={search}
            setSearch={setSearch}
            expandedId={expandedId}
            toggleTrigger={toggleTrigger}
            lastRunStatuses={lastRunStatuses}
            onViewRuns={handleViewRuns}
          />
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <ScheduledRunsTab
            triggerSlugFilter={triggerSlugFilter}
            onClearFilter={() => setTriggerSlugFilter(undefined)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function SystemAutomationsPage() {
  return <TriggersPageContent />
}
