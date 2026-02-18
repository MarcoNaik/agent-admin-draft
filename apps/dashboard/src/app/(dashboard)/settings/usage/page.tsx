"use client"

import { Doc } from "@convex/_generated/dataModel"
import { Activity, Zap, Clock, CheckCircle, Loader2 } from "lucide-react"
import {
  useExecutionStats,
  useUsageByAgent,
  useEvalStats,
  useRecentExecutions,
  useAgents,
} from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber } from "@/lib/utils"
import { formatDuration, formatRelativeTime } from "@/lib/format"

export default function UsagePage() {
  const { environment } = useEnvironment()
  const stats = useExecutionStats(undefined, environment)
  const agentUsage = useUsageByAgent(environment)
  const evalStats = useEvalStats(environment)
  const recentExecs = useRecentExecutions(undefined, environment, 20)
  const agents = useAgents()

  const agentNameMap = new Map<string, string>()
  if (agents) {
    for (const a of agents) {
      agentNameMap.set(a._id, a.name)
    }
  }

  if (stats === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-content-primary">Usage</h1>
          <p className="text-sm text-content-secondary">Token consumption, execution stats, and eval usage</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  const sortedAgentUsage = agentUsage
    ? [...agentUsage].sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens))
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content-primary">Usage</h1>
        <p className="text-sm text-content-secondary">Token consumption, execution stats, and eval usage</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-background-secondary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-content-secondary">Total Executions</CardTitle>
            <Activity className="h-4 w-4 text-content-tertiary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-content-primary">{formatNumber(stats.total)}</div>
            <p className="text-xs text-content-secondary">
              {formatNumber(stats.successful)} succeeded / {formatNumber(stats.failed)} failed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-background-secondary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-content-secondary">Total Tokens</CardTitle>
            <Zap className="h-4 w-4 text-content-tertiary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-content-primary">{formatNumber(stats.totalTokens)}</div>
            <p className="text-xs text-content-secondary">
              {formatNumber(stats.totalInputTokens)} in / {formatNumber(stats.totalOutputTokens)} out
            </p>
          </CardContent>
        </Card>

        <Card className="bg-background-secondary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-content-secondary">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-content-tertiary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-content-primary">
              {stats.averageDurationMs > 0 ? formatDuration(stats.averageDurationMs) : "-"}
            </div>
            <p className="text-xs text-content-secondary">Average response time</p>
          </CardContent>
        </Card>

        <Card className="bg-background-secondary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-content-secondary">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-content-tertiary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-content-primary">
              {stats.total > 0 ? `${stats.successRate.toFixed(1)}%` : "-"}
            </div>
            <p className="text-xs text-content-secondary">Successful executions</p>
          </CardContent>
        </Card>
      </div>

      {sortedAgentUsage.length > 0 && (
        <Card className="bg-background-secondary">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-content-primary">Agent Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-content-secondary">
                    <th className="text-left py-2 pr-4 font-medium">Agent</th>
                    <th className="text-right py-2 px-4 font-medium">Runs</th>
                    <th className="text-right py-2 px-4 font-medium">Input tokens</th>
                    <th className="text-right py-2 px-4 font-medium">Output tokens</th>
                    <th className="text-right py-2 px-4 font-medium">Total tokens</th>
                    <th className="text-right py-2 pl-4 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAgentUsage.map((row) => (
                    <tr key={row.agentId} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-content-primary">
                        {agentNameMap.get(row.agentId) ?? "Unknown"}
                      </td>
                      <td className="text-right py-2 px-4 text-content-secondary">{formatNumber(row.count)}</td>
                      <td className="text-right py-2 px-4 text-content-secondary">{formatNumber(row.inputTokens)}</td>
                      <td className="text-right py-2 px-4 text-content-secondary">{formatNumber(row.outputTokens)}</td>
                      <td className="text-right py-2 px-4 text-content-primary font-medium">
                        {formatNumber(row.inputTokens + row.outputTokens)}
                      </td>
                      <td className="text-right py-2 pl-4 text-content-secondary">
                        {row.errors > 0 ? (
                          <span className="text-destructive">{row.errors}</span>
                        ) : (
                          "0"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {evalStats && evalStats.totalRuns > 0 && (
        <Card className="bg-background-secondary">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-content-primary">Eval Token Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-content-secondary">Total Runs</p>
                <p className="text-xl font-bold text-content-primary">{formatNumber(evalStats.totalRuns)}</p>
                <p className="text-xs text-content-secondary">{formatNumber(evalStats.completedRuns)} completed</p>
              </div>
              <div>
                <p className="text-sm text-content-secondary">Agent Tokens</p>
                <p className="text-xl font-bold text-content-primary">{formatNumber(evalStats.agentTokens)}</p>
              </div>
              <div>
                <p className="text-sm text-content-secondary">Judge Tokens</p>
                <p className="text-xl font-bold text-content-primary">{formatNumber(evalStats.judgeTokens)}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-content-secondary">
                Combined eval tokens: <span className="font-medium text-content-primary">{formatNumber(evalStats.totalTokens)}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {recentExecs && recentExecs.length > 0 && (
        <Card className="bg-background-secondary">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-content-primary">Recent Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(recentExecs ?? []).map((exec: Doc<"executions">) => (
                <div key={exec._id} className="flex items-center gap-3 py-1.5">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      exec.status === "success"
                        ? "bg-emerald-500"
                        : exec.status === "error"
                          ? "bg-destructive"
                          : "bg-amber-500"
                    }`}
                  />
                  <span className="text-sm text-content-primary truncate flex-1">
                    {agentNameMap.get(exec.agentId) ?? "Unknown"}
                  </span>
                  <span className="text-xs text-content-secondary shrink-0">
                    {formatDuration(exec.durationMs)}
                  </span>
                  <span className="text-xs text-content-secondary shrink-0">
                    {formatNumber(exec.inputTokens + exec.outputTokens)} tok
                  </span>
                  <span className="text-xs text-content-tertiary shrink-0">
                    {formatRelativeTime(exec.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
