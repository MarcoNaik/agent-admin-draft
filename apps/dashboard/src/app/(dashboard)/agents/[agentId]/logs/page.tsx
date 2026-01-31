"use client"

import { Loader2, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { useRecentExecutions } from "@/hooks/use-convex-data"
import { Badge } from "@/components/ui/badge"
import { Id, Doc } from "@convex/_generated/dataModel"

interface AgentLogsPageProps {
  params: { agentId: string }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function LogRow({ execution }: { execution: Doc<"executions"> }) {
  const [expanded, setExpanded] = useState(false)
  const isError = execution.status === "error"

  return (
    <>
      <tr
        className="border-b hover:bg-background-secondary cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 w-8">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-content-tertiary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-content-tertiary" />
          )}
        </td>
        <td className="px-4 py-3">
          <Badge variant={isError ? "destructive" : "success"} className="text-xs font-normal">
            {isError ? "error" : "success"}
          </Badge>
        </td>
        <td className="px-4 py-3 text-sm text-content-primary font-mono">
          {formatTimestamp(execution.createdAt)}
        </td>
        <td className="px-4 py-3 text-sm text-content-secondary text-right font-mono">
          {formatDuration(execution.durationMs)}
        </td>
        <td className="px-4 py-3 text-sm text-content-secondary text-right font-mono">
          {execution.inputTokens.toLocaleString()}
        </td>
        <td className="px-4 py-3 text-sm text-content-secondary text-right font-mono">
          {execution.outputTokens.toLocaleString()}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-background-secondary">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-3">
              {isError && execution.errorMessage && (
                <div>
                  <div className="text-xs font-medium text-content-secondary mb-1">Error Message</div>
                  <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive font-mono">
                    {execution.errorMessage}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-content-tertiary">Execution ID</div>
                  <div className="font-mono text-content-secondary truncate">{execution._id}</div>
                </div>
                <div>
                  <div className="text-xs text-content-tertiary">Environment</div>
                  <div className="text-content-secondary">{execution.environment || "development"}</div>
                </div>
                <div>
                  <div className="text-xs text-content-tertiary">Total Tokens</div>
                  <div className="font-mono text-content-secondary">
                    {(execution.inputTokens + execution.outputTokens).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-content-tertiary">Created</div>
                  <div className="text-content-secondary">
                    {new Date(execution.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function AgentLogsPage({ params }: AgentLogsPageProps) {
  const { agentId } = params
  const executions = useRecentExecutions(agentId as Id<"agents">, 100)

  if (executions === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-content-primary">Logs</h2>
        <p className="text-sm text-content-secondary mt-0.5">Execution history and performance metrics</p>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        {executions.length === 0 ? (
          <div className="p-12 text-center text-sm text-content-secondary">
            No executions yet. Logs will appear here when your agent receives requests.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-secondary border-b">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Input
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Output
                  </th>
                </tr>
              </thead>
              <tbody>
                {executions.map((execution: Doc<"executions">) => (
                  <LogRow key={execution._id} execution={execution} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {executions.length > 0 && (
        <div className="text-xs text-content-tertiary text-right">
          Showing {executions.length} most recent executions
        </div>
      )}
    </div>
  )
}
