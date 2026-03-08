"use client"

import { useMemo, useState } from "react"
import {
  Zap,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  XCircle,
  Clock,
  Repeat,
  Play,
  Pause,
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

function getStatusVariant(status: string) {
  switch (status) {
    case "completed":
      return "success" as const
    case "failed":
    case "dead":
      return "destructive" as const
    case "running":
      return "warning" as const
    case "pending":
      return "amber" as const
    default:
      return "secondary" as const
  }
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
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {hasDetail ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-0.5 transition-colors ease-out-soft hover:text-content-primary"
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
        <Badge
          variant={getStatusVariant(run.status)}
          className="text-[10px] px-1.5 py-0 h-4"
        >
          {run.status}
        </Badge>
        <span className="text-[10px] text-content-tertiary">
          {formatRelativeTime(run.createdAt)}
        </span>
        {run.attempt && run.attempt > 1 && (
          <span className="text-[10px] text-content-tertiary">
            attempt {run.attempt}
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
    <div className="border rounded-lg bg-background">
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="h-3.5 w-3.5 text-amber shrink-0" />
          <span className="text-sm font-medium truncate">{trigger.name}</span>
        </div>
        {trigger.enabled ? (
          <Badge variant="success" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
            <Play className="h-2.5 w-2.5 mr-0.5" />
            enabled
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
            <Pause className="h-2.5 w-2.5 mr-0.5" />
            disabled
          </Badge>
        )}
      </div>

      <div className="px-3 pb-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-content-tertiary uppercase tracking-wide">
            When
          </span>
          <Badge variant="ocean" className="text-[10px] px-1.5 py-0 h-4">
            {trigger.entityType}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {trigger.action}
          </Badge>
        </div>

        {trigger.condition && (
          <p className="text-[10px] text-content-tertiary pl-0.5 truncate">
            if {typeof trigger.condition === "object" ? JSON.stringify(trigger.condition) : String(trigger.condition)}
          </p>
        )}

        {trigger.schedule && (
          <div className="flex items-center gap-1 text-[10px] text-content-secondary">
            <Clock className="h-3 w-3 text-content-tertiary shrink-0" />
            {trigger.schedule.delay && (
              <span>delay {formatDuration(trigger.schedule.delay)}</span>
            )}
            {trigger.schedule.at && <span>at {trigger.schedule.at}</span>}
            {trigger.schedule.offset && (
              <span>offset {formatDuration(trigger.schedule.offset)}</span>
            )}
            {trigger.schedule.cancelPrevious && (
              <span className="text-content-tertiary">(cancels previous)</span>
            )}
          </div>
        )}

        {trigger.retry && (
          <div className="flex items-center gap-1 text-[10px] text-content-secondary">
            <Repeat className="h-3 w-3 text-content-tertiary shrink-0" />
            <span>
              {trigger.retry.maxAttempts} attempts
              {trigger.retry.backoffMs &&
                `, ${formatDuration(trigger.retry.backoffMs)} backoff`}
            </span>
          </div>
        )}

        {trigger.actions && trigger.actions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-content-tertiary uppercase tracking-wide">
              Then
            </span>
            {trigger.actions.map((action: any, i: number) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {action.tool}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-2 mt-0 mx-3 pb-2.5">
        {recentRuns.length === 0 ? (
          <p className="text-[10px] text-content-tertiary text-center py-1">
            No runs yet
          </p>
        ) : (
          <div className="space-y-1.5">
            {recentRuns.map((run: any) => (
              <TriggerRunItem key={run._id} run={run} />
            ))}
          </div>
        )}
      </div>
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

  return (
    <div className="p-3 space-y-3">
      {loading ? (
        <p className="text-sm text-content-tertiary text-center py-4">
          Loading...
        </p>
      ) : (triggers as any[]).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Zap className="h-8 w-8 text-content-tertiary mb-2" />
          <p className="text-sm text-content-secondary">No triggers defined</p>
        </div>
      ) : (
        <>
          {stats && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {stats.pending > 0 && (
                <Badge variant="amber" className="text-[10px] px-1.5 py-0 h-4">
                  {stats.pending} pending
                </Badge>
              )}
              {stats.running > 0 && (
                <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-4">
                  {stats.running} running
                </Badge>
              )}
              {stats.completed > 0 && (
                <Badge variant="success" className="text-[10px] px-1.5 py-0 h-4">
                  {stats.completed} completed
                </Badge>
              )}
              {stats.failed > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                  {stats.failed} failed
                </Badge>
              )}
              {(stats as any).dead > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                  {(stats as any).dead} dead
                </Badge>
              )}
            </div>
          )}
          <div className="space-y-2">
            {(triggers as any[]).map((trigger: any) => (
              <TriggerCard
                key={trigger._id}
                trigger={trigger}
                runs={runsBySlug.get(trigger.slug) ?? []}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
