"use client"

import { useMemo, useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  RotateCcw,
  XCircle,
  Clock,
  Repeat,
  Zap,
  CircleDot,
  CheckCircle2,
  XOctagon,
  Loader2,
  Timer,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRelativeTime, formatDuration } from "@/lib/format"
import {
  useTriggers,
  useTriggerRuns,
  useTriggerRunStats,
  useRetryTriggerRun,
  useCancelTriggerRun,
} from "@/hooks/use-convex-data"

function getStatusColor(status: string) {
  switch (status) {
    case "completed": return "text-success"
    case "failed": case "dead": return "text-destructive"
    case "running": return "text-warning"
    case "pending": return "text-amber"
    default: return "text-content-tertiary"
  }
}

function StatusIcon({ status }: { status: string }) {
  const cls = cn("h-3 w-3 shrink-0", getStatusColor(status))
  switch (status) {
    case "completed": return <CheckCircle2 className={cls} />
    case "failed": case "dead": return <XOctagon className={cls} />
    case "running": return <Loader2 className={cn(cls, "animate-spin")} />
    case "pending": return <Timer className={cls} />
    default: return <CircleDot className={cls} />
  }
}

function formatCondition(condition: unknown): string {
  if (typeof condition === "string") return condition
  if (typeof condition !== "object" || condition === null) return String(condition)
  const obj = condition as Record<string, unknown>
  return Object.entries(obj)
    .map(([k, v]) => `${k} = ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ")
}

function formatDetail(data: unknown, depth = 0): React.ReactNode {
  if (data === null || data === undefined) return null
  if (typeof data === "string") return <span>{data}</span>
  if (typeof data === "number" || typeof data === "boolean")
    return <span>{String(data)}</span>
  if (Array.isArray(data)) {
    return (
      <div className="space-y-0.5">
        {data.map((item, i) => (
          <div key={i} className="flex gap-1">
            <span className="text-content-tertiary shrink-0">{i}:</span>
            <div>{formatDetail(item, depth + 1)}</div>
          </div>
        ))}
      </div>
    )
  }
  if (typeof data === "object") {
    return (
      <div className={cn(depth > 0 && "pl-2 border-l border-border")}>
        {Object.entries(data as Record<string, unknown>).map(([key, val]) => (
          <div key={key} className="flex gap-1">
            <span className="text-content-tertiary shrink-0">{key}:</span>
            <div className="min-w-0">{formatDetail(val, depth + 1)}</div>
          </div>
        ))}
      </div>
    )
  }
  return <span>{String(data)}</span>
}

function TriggerRunItem({ run }: { run: any }) {
  const [expanded, setExpanded] = useState(false)
  const retryRun = useRetryTriggerRun()
  const cancelRun = useCancelTriggerRun()
  const hasDetail = run.result || run.error

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        {hasDetail ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center transition-colors ease-out-soft hover:text-content-primary"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-content-tertiary" />
            ) : (
              <ChevronRight className="h-3 w-3 text-content-tertiary" />
            )}
          </button>
        ) : (
          <div className="w-3" />
        )}
        <StatusIcon status={run.status} />
        <span className="text-[11px] text-content-secondary">{run.status}</span>
        <span className="text-[10px] text-content-tertiary">
          {formatRelativeTime(run.createdAt)}
        </span>
        {run.attempt && run.attempt > 1 && (
          <span className="text-[10px] text-content-tertiary">
            #{run.attempt}
          </span>
        )}
        <div className="flex items-center gap-0.5 ml-auto">
          {run.status === "failed" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => retryRun({ runId: run._id })}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
          {(run.status === "pending" || run.status === "running") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => cancelRun({ runId: run._id })}
            >
              <XCircle className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {expanded && hasDetail && (
        <div className="ml-5 text-[10px] text-content-secondary max-h-40 overflow-y-auto overflow-x-auto">
          {run.error && (
            <div className="text-destructive">{formatDetail(run.error)}</div>
          )}
          {run.result && !run.error && formatDetail(run.result)}
        </div>
      )}
    </div>
  )
}

function TriggerCard({
  trigger,
  runs,
}: {
  trigger: any
  runs: any[]
}) {
  const recentRuns = runs.slice(0, 5)

  return (
    <div className="px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium truncate">{trigger.name}</span>
        <div className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          trigger.enabled ? "bg-success" : "bg-content-tertiary"
        )} />
      </div>

      <div className="text-[11px] text-content-secondary">
        <span className="text-content-tertiary">on </span>
        <span className="text-content-primary font-medium">{trigger.entityType}</span>
        <span className="text-content-tertiary"> . </span>
        <span className="text-content-primary font-medium">{trigger.action}</span>
      </div>

      {trigger.condition && (
        <p className="text-[10px] text-content-tertiary truncate">
          where {formatCondition(trigger.condition)}
        </p>
      )}

      {trigger.schedule && (
        <div className="flex items-center gap-1 text-[10px] text-content-tertiary">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          {trigger.schedule.delay && (
            <span>delay {formatDuration(trigger.schedule.delay)}</span>
          )}
          {trigger.schedule.at && <span>at {trigger.schedule.at}</span>}
          {trigger.schedule.offset && (
            <span>offset {formatDuration(trigger.schedule.offset)}</span>
          )}
          {trigger.schedule.cancelPrevious && <span>(cancels prev)</span>}
        </div>
      )}

      {trigger.retry && (
        <div className="flex items-center gap-1 text-[10px] text-content-tertiary">
          <Repeat className="h-2.5 w-2.5 shrink-0" />
          <span>
            {trigger.retry.maxAttempts} retries
            {trigger.retry.backoffMs && `, ${formatDuration(trigger.retry.backoffMs)} backoff`}
          </span>
        </div>
      )}

      {trigger.actions && trigger.actions.length > 0 && (
        <div className="text-[10px] text-content-tertiary">
          <span>runs </span>
          <span className="text-content-secondary font-mono">
            {trigger.actions.map((a: any) => a.tool).join(" → ")}
          </span>
        </div>
      )}

      {recentRuns.length > 0 && (
        <div className="pt-1.5 mt-0.5 border-t border-border/50 space-y-1">
          {recentRuns.map((run: any) => (
            <TriggerRunItem key={run._id} run={run} />
          ))}
        </div>
      )}
    </div>
  )
}

export function TriggersTab() {
  const triggers = useTriggers("development")
  const runs = useTriggerRuns("development")
  const stats = useTriggerRunStats("development")

  const runsBySlug = useMemo(() => {
    const map = new Map<string, any[]>()
    if (!runs) return map
    for (const run of runs as any[]) {
      const existing = map.get(run.triggerSlug)
      if (existing) {
        existing.push(run)
      } else {
        map.set(run.triggerSlug, [run])
      }
    }
    return map
  }, [runs])

  const loading = triggers === undefined || runs === undefined

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-content-tertiary">Loading...</p>
      </div>
    )
  }

  if ((triggers as any[]).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Zap className="h-8 w-8 text-content-tertiary mb-2" />
        <p className="text-sm text-content-secondary">No triggers defined</p>
      </div>
    )
  }

  const hasStats = stats && (stats.pending > 0 || stats.running > 0 || stats.completed > 0 || stats.failed > 0)

  return (
    <div>
      {hasStats && (
        <div className="flex items-center gap-3 px-3 py-2 border-b text-[10px] text-content-tertiary">
          {stats.pending > 0 && <span>{stats.pending} pending</span>}
          {stats.running > 0 && <span>{stats.running} running</span>}
          {stats.completed > 0 && <span>{stats.completed} completed</span>}
          {stats.failed > 0 && <span className="text-destructive">{stats.failed} failed</span>}
        </div>
      )}
      <div className="divide-y">
        {(triggers as any[]).map((trigger: any) => (
          <TriggerCard
            key={trigger._id}
            trigger={trigger}
            runs={runsBySlug.get(trigger.slug) ?? []}
          />
        ))}
      </div>
    </div>
  )
}
