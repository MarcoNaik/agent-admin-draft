"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, Zap, RotateCcw, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import { useTriggerRunStats, useTriggerRuns, useRetryTriggerRun, useCancelTriggerRun } from "@/hooks/use-convex-data"

function getStatusVariant(status: string) {
  switch (status) {
    case "completed": return "success" as const
    case "failed":
    case "dead": return "destructive" as const
    case "running": return "warning" as const
    case "pending": return "amber" as const
    default: return "secondary" as const
  }
}

function TriggerRunRow({ run }: { run: any }) {
  const [expanded, setExpanded] = useState(false)
  const retryRun = useRetryTriggerRun()
  const cancelRun = useCancelTriggerRun()
  const hasDetail = run.result || run.error

  return (
    <div className="rounded border bg-background">
      <div className="px-3 py-2 flex items-center gap-2">
        <Zap className="h-3 w-3 text-amber shrink-0" />
        <span className="text-xs font-medium truncate">{run.triggerSlug}</span>
        <Badge variant={getStatusVariant(run.status)} className="text-[10px] px-1 py-0 h-4 shrink-0">
          {run.status}
        </Badge>
        <span className="text-[10px] text-content-tertiary ml-auto shrink-0">
          {formatRelativeTime(run.createdAt)}
        </span>
      </div>
      <div className="px-3 pb-2 flex items-center gap-1">
        {hasDetail && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-content-secondary hover:underline"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Details
          </button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {run.status === "failed" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => retryRun({ runId: run._id })}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
          {(run.status === "pending" || run.status === "running") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => cancelRun({ runId: run._id })}
            >
              <XCircle className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {expanded && hasDetail && (
        <pre className="px-3 pb-2 text-[10px] overflow-x-auto max-h-40 overflow-y-auto">
          {JSON.stringify(run.error ?? run.result, null, 2)}
        </pre>
      )}
    </div>
  )
}

export function TriggersTab() {
  const stats = useTriggerRunStats("development")
  const runs = useTriggerRuns("development")

  return (
    <div className="p-3 space-y-3">
      {stats && (
        <div className="flex items-center gap-2 flex-wrap">
          {stats.pending > 0 && <Badge variant="amber" className="text-xs">Pending: {stats.pending}</Badge>}
          {stats.running > 0 && <Badge variant="warning" className="text-xs">Running: {stats.running}</Badge>}
          {stats.completed > 0 && <Badge variant="success" className="text-xs">Completed: {stats.completed}</Badge>}
          {stats.failed > 0 && <Badge variant="destructive" className="text-xs">Failed: {stats.failed}</Badge>}
        </div>
      )}
      {!runs ? (
        <p className="text-sm text-content-tertiary text-center py-4">Loading...</p>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Zap className="h-8 w-8 text-content-tertiary mb-2" />
          <p className="text-sm text-content-secondary">No trigger runs</p>
        </div>
      ) : (
        <div className="space-y-1">
          {(runs as any[]).map((run: any) => (
            <TriggerRunRow key={run._id} run={run} />
          ))}
        </div>
      )}
    </div>
  )
}
