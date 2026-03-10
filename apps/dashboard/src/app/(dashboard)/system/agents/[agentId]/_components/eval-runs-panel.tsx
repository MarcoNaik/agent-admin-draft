"use client"

import { useState } from "react"
import { Loader2, Play } from "@/lib/icons"
import { useEvalRunsByAgent, useEvalSuitesMap, useStartEvalRun } from "@/hooks/use-convex-data"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { RunStatusBadge } from "@/components/evals/eval-status"
import { formatDuration, formatTime } from "@/lib/format"
import { Id } from "@convex/_generated/dataModel"
import { EvalRunDetailSheet } from "./eval-run-detail-sheet"

type StatusFilter = "all" | "running" | "completed" | "failed"

interface EvalRunsPanelProps {
  agentId: Id<"agents">
}

export function EvalRunsPanel({ agentId }: EvalRunsPanelProps) {
  const runs = useEvalRunsByAgent(agentId)
  const suitesMap = useEvalSuitesMap(agentId)
  const [suiteFilter, setSuiteFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [selectedRunId, setSelectedRunId] = useState<Id<"evalRuns"> | undefined>()

  const suiteNameMap = new Map<string, string>()
  if (suitesMap) {
    for (const s of suitesMap) {
      suiteNameMap.set(s._id, s.name)
    }
  }

  const filteredRuns = (runs || []).filter((run: any) => {
    if (suiteFilter !== "all" && run.suiteId !== suiteFilter) return false
    if (statusFilter !== "all" && run.status !== statusFilter) return false
    return true
  })

  if (runs === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={suiteFilter} onValueChange={setSuiteFilter}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="All suites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suites</SelectItem>
            {(suitesMap || []).map((s: any) => (
              <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          {(["all", "running", "completed", "failed"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ease-out-soft ${
                statusFilter === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-background-secondary text-content-secondary hover:bg-background-tertiary"
              }`}
            >
              {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <span className="text-xs text-content-tertiary ml-auto">
          {filteredRuns.length} run{filteredRuns.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filteredRuns.length === 0 ? (
        <div className="rounded-md border bg-card p-8 text-center">
          <p className="text-sm text-content-secondary">No eval runs yet</p>
          <p className="text-xs text-content-tertiary mt-1">Run a suite from the Suites tab to see results here</p>
        </div>
      ) : (
        <div className="rounded-md border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-background-secondary border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">Suite</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">Started</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">Pass Rate</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">Score</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run: any) => {
                const passRate = run.totalCases > 0 ? `${run.passedCases}/${run.totalCases}` : "\u2014"

                return (
                  <tr
                    key={run._id}
                    onClick={() => setSelectedRunId(run._id)}
                    className="border-b hover:bg-background-secondary transition-colors ease-out-soft cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <RunStatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-content-secondary">
                      {suiteNameMap.get(run.suiteId) || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-sm text-content-secondary">
                      {run.startedAt ? formatTime(run.startedAt) : formatTime(run.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-content-secondary text-right font-input">
                      {passRate}
                    </td>
                    <td className="px-4 py-3 text-sm text-content-secondary text-right font-input">
                      {run.overallScore !== undefined ? `${(run.overallScore / 5 * 100).toFixed(0)}%` : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-sm text-content-secondary text-right font-input">
                      {run.totalDurationMs ? formatDuration(run.totalDurationMs) : "\u2014"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <EvalRunDetailSheet
        open={!!selectedRunId}
        onOpenChange={(open) => { if (!open) setSelectedRunId(undefined) }}
        runId={selectedRunId}
        agentId={agentId}
      />
    </div>
  )
}
