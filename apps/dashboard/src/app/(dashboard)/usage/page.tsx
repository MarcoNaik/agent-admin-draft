"use client"

import { Activity, Zap, Clock, CheckCircle, Loader2 } from "lucide-react"
import { useExecutionStats } from "@/hooks/use-convex-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber } from "@/lib/utils"

export default function UsagePage() {
  const stats = useExecutionStats()

  if (stats === undefined) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Usage</h1>
          <p className="text-content-secondary">Monitor your agent usage and performance</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  const statCards = [
    {
      name: "Total Executions",
      value: formatNumber(stats.executions || 0),
      icon: Activity,
      description: "Agent invocations today",
    },
    {
      name: "Total Tokens",
      value: formatNumber(stats.totalTokens || 0),
      icon: Zap,
      description: `${formatNumber(stats.inputTokens || 0)} in / ${formatNumber(stats.outputTokens || 0)} out`,
    },
    {
      name: "Avg. Duration",
      value: stats.avgDurationMs ? `${Math.round(stats.avgDurationMs)}ms` : "-",
      icon: Clock,
      description: "Average response time",
    },
    {
      name: "Success Rate",
      value: stats.successRate ? `${(stats.successRate * 100).toFixed(1)}%` : "-",
      icon: CheckCircle,
      description: "Successful executions",
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">Usage</h1>
        <p className="text-content-secondary">Monitor your agent usage and performance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.name} className="bg-background-secondary">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-content-secondary">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-content-tertiary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-content-primary">{stat.value}</div>
              <p className="text-xs text-content-secondary">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">Usage Over Time</CardTitle>
          <CardDescription className="text-content-secondary">Token consumption and executions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-content-secondary">
            Chart coming soon
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
