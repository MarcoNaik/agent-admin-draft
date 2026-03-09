"use client"

import { useMemo, useState, useCallback } from "react"
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
import { useAnimateNew, idKeyFn } from "@/hooks/use-animate-new"

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

function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    created: "is created",
    updated: "is updated",
    deleted: "is deleted",
  }
  return map[action] || action
}

function humanizeCondition(condition: unknown): string {
  if (typeof condition === "string") return condition
  if (typeof condition !== "object" || condition === null) return String(condition)
  const obj = condition as Record<string, unknown>
  return Object.entries(obj)
    .map(([k, v]) => {
      const field = k.replace(/^data\./, "").replace(/([A-Z])/g, " $1").replace(/_/g, " ").toLowerCase().trim()
      const value = typeof v === "string" ? v : JSON.stringify(v)
      return `${field} is "${value}"`
    })
    .join(" and ")
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

function formatToolName(tool: string): string {
  const parts = tool.split(".")
  if (parts.length === 2) {
    return parts[1].replace(/([A-Z])/g, " $1").replace(/^\w/, c => c.toUpperCase()).trim()
  }
  return tool
}

function RunCountSummary({ runs }: { runs: any[] }) {
  if (runs.length === 0) return null
  const failed = runs.filter(r => r.status === "failed" || r.status === "dead").length
  const running = runs.filter(r => r.status === "running" || r.status === "pending").length

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-content-tertiary">
      <span>{runs.length} run{runs.length !== 1 ? "s" : ""}</span>
      {running > 0 && <span className="text-warning">{running} active</span>}
      {failed > 0 && <span className="text-destructive">{failed} failed</span>}
    </div>
  )
}

function TriggerRunItem({ run, isNew }: { run: any; isNew?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const retryRun = useRetryTriggerRun()
  const cancelRun = useCancelTriggerRun()
  const hasDetail = run.result || run.error

  return (
    <div className={cn("space-y-0.5", isNew && "animate-highlight-new")}>
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

function TriggerRow({
  trigger,
  runs,
  isNew,
}: {
  trigger: any
  runs: any[]
  isNew?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [showRuns, setShowRuns] = useState(false)
  const newRunKeys = useAnimateNew(runs, idKeyFn)
  const recentRuns = runs.slice(0, 5)
  const actionCount = trigger.actions?.length ?? 0

  const toggle = useCallback(() => setExpanded(prev => !prev), [])
  const toggleRuns = useCallback(() => setShowRuns(prev => !prev), [])

  const hasDetails = trigger.condition || trigger.schedule || trigger.retry || actionCount > 0

  return (
    <div className={cn("px-3", isNew && "animate-highlight-new")}>
      <button
        type="button"
        onClick={toggle}
        className="w-full py-2.5 flex items-center gap-2 text-left group"
      >
        <div className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0 mt-0.5",
          trigger.enabled ? "bg-success" : "bg-content-tertiary/40"
        )} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate">{trigger.name}</span>
          </div>
          <p className="text-[11px] text-content-tertiary mt-0.5 truncate">
            When {trigger.entityType} {humanizeAction(trigger.action)}
            {trigger.condition && (
              <span> &middot; {humanizeCondition(trigger.condition)}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {actionCount > 0 && (
            <span className="text-[10px] text-content-tertiary">
              {actionCount} step{actionCount !== 1 ? "s" : ""}
            </span>
          )}
          {hasDetails && (
            expanded
              ? <ChevronDown className="h-3 w-3 text-content-tertiary" />
              : <ChevronRight className="h-3 w-3 text-content-tertiary group-hover:text-content-secondary transition-colors" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="pb-2.5 pl-[14px] space-y-2">
          {trigger.schedule && (
            <div className="flex items-center gap-1.5 text-[11px] text-content-secondary">
              <Clock className="h-3 w-3 shrink-0 text-content-tertiary" />
              <span>
                {trigger.schedule.delay && `Waits ${formatDuration(trigger.schedule.delay)}`}
                {trigger.schedule.at && `Runs at ${trigger.schedule.at}`}
                {trigger.schedule.offset && `, offset ${formatDuration(trigger.schedule.offset)}`}
                {trigger.schedule.cancelPrevious && " (replaces previous)"}
              </span>
            </div>
          )}

          {trigger.retry && (
            <div className="flex items-center gap-1.5 text-[11px] text-content-secondary">
              <Repeat className="h-3 w-3 shrink-0 text-content-tertiary" />
              <span>
                Retries up to {trigger.retry.maxAttempts} times
                {trigger.retry.backoffMs && `, ${formatDuration(trigger.retry.backoffMs)} between`}
              </span>
            </div>
          )}

          {actionCount > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-content-tertiary">
                Steps
              </span>
              <ol className="space-y-0.5">
                {trigger.actions.map((a: any, i: number) => (
                  <li key={i} className="flex items-baseline gap-1.5 text-[11px]">
                    <span className="text-content-tertiary shrink-0 tabular-nums w-3 text-right">{i + 1}.</span>
                    <span className="text-content-secondary">{formatToolName(a.tool)}</span>
                    <span className="text-[10px] text-content-tertiary font-mono">{a.tool}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {recentRuns.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={toggleRuns}
                className="flex items-center gap-1 text-[11px] text-content-tertiary hover:text-content-secondary transition-colors"
              >
                {showRuns
                  ? <ChevronDown className="h-2.5 w-2.5" />
                  : <ChevronRight className="h-2.5 w-2.5" />
                }
                <RunCountSummary runs={recentRuns} />
              </button>
              {showRuns && (
                <div className="mt-1.5 space-y-1 pl-0.5">
                  {recentRuns.map((run: any) => (
                    <TriggerRunItem key={run._id} run={run} isNew={newRunKeys.has(run._id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EntityGroup({
  entityType,
  triggers,
  runsBySlug,
  newTriggerKeys,
}: {
  entityType: string
  triggers: any[]
  runsBySlug: Map<string, any[]>
  newTriggerKeys: Set<string>
}) {
  return (
    <div>
      <div className="px-3 pt-3 pb-1">
        <span className="text-[10px] uppercase tracking-wider text-content-tertiary">
          {entityType}
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {triggers.map((trigger: any) => (
          <TriggerRow
            key={trigger._id}
            trigger={trigger}
            runs={runsBySlug.get(trigger.slug) ?? []}
            isNew={newTriggerKeys.has(trigger._id)}
          />
        ))}
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

  const groupedByEntity = useMemo(() => {
    if (!triggers) return []
    const map = new Map<string, any[]>()
    for (const trigger of triggers as any[]) {
      const key = trigger.entityType ?? "other"
      const existing = map.get(key)
      if (existing) {
        existing.push(trigger)
      } else {
        map.set(key, [trigger])
      }
    }
    return Array.from(map.entries()).map(([entityType, items]) => ({
      entityType,
      triggers: items,
    }))
  }, [triggers])

  const newTriggerKeys = useAnimateNew(triggers as any[] | undefined, idKeyFn)

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
      {groupedByEntity.length === 1 ? (
        <div className="divide-y divide-border/50">
          {groupedByEntity[0].triggers.map((trigger: any) => (
            <TriggerRow
              key={trigger._id}
              trigger={trigger}
              runs={runsBySlug.get(trigger.slug) ?? []}
              isNew={newTriggerKeys.has(trigger._id)}
            />
          ))}
        </div>
      ) : (
        <div className="divide-y">
          {groupedByEntity.map(({ entityType, triggers: groupTriggers }) => (
            <EntityGroup
              key={entityType}
              entityType={entityType}
              triggers={groupTriggers}
              runsBySlug={runsBySlug}
              newTriggerKeys={newTriggerKeys}
            />
          ))}
        </div>
      )}
    </div>
  )
}
