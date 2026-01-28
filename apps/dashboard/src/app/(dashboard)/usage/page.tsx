import { Activity, Zap, Clock, CheckCircle } from "lucide-react"
import { api } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber } from "@/lib/utils"

export default async function UsagePage() {
  const token = await getAuthToken()

  let usage: Awaited<ReturnType<typeof api.usage.get>> | null = null
  let error: string | null = null

  try {
    usage = await api.usage.get(token!, "day")
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load usage"
  }

  const stats = [
    {
      name: "Total Executions",
      value: usage ? formatNumber(usage.summary.executions) : "-",
      icon: Activity,
      description: "Agent invocations today",
    },
    {
      name: "Total Tokens",
      value: usage ? formatNumber(usage.summary.totalTokens) : "-",
      icon: Zap,
      description: `${formatNumber(usage?.summary.inputTokens || 0)} in / ${formatNumber(usage?.summary.outputTokens || 0)} out`,
    },
    {
      name: "Avg. Duration",
      value: usage ? `${Math.round(usage.summary.avgDurationMs)}ms` : "-",
      icon: Clock,
      description: "Average response time",
    },
    {
      name: "Success Rate",
      value: usage ? `${(usage.summary.successRate * 100).toFixed(1)}%` : "-",
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

      {error ? (
        <Card className="bg-background-secondary">
          <CardContent className="py-8 text-center">
            <p className="text-content-secondary">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
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
        </>
      )}
    </div>
  )
}
