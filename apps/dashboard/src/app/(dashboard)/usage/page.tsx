import { auth } from "@clerk/nextjs/server"
import { Activity, Zap, Clock, CheckCircle } from "lucide-react"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber } from "@/lib/utils"

export default async function UsagePage() {
  const { getToken } = await auth()
  const token = await getToken()

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
        <h1 className="text-3xl font-bold">Usage</h1>
        <p className="text-muted-foreground">Monitor your agent usage and performance</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.name}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.name}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Usage Over Time</CardTitle>
              <CardDescription>Token consumption and executions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Chart coming soon
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
