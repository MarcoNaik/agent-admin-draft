import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Zap,
} from "lucide-react"
import { api } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface AgentHealthPageProps {
  params: Promise<{ agentId: string }>
}

export default async function AgentHealthPage({ params }: AgentHealthPageProps) {
  const { agentId } = await params
  const token = await getAuthToken()

  let agent = null
  let versions: Awaited<ReturnType<typeof api.agents.get>>["versions"] = []

  try {
    const data = await api.agents.get(token!, agentId)
    agent = data.agent
    versions = data.versions
  } catch {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Failed to load agent data</p>
      </div>
    )
  }

  const latestVersion = versions[0]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Health</h2>
        <p className="text-muted-foreground">Monitor your agent&apos;s performance and status</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Current agent status and deployment info</CardDescription>
            </div>
            <Badge variant={agent?.status === "active" ? "success" : "secondary"}>
              {agent?.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-full bg-green-500/10 p-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{agent?.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-full bg-blue-500/10 p-2">
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Version</p>
                <p className="font-medium">{latestVersion?.version || "Not deployed"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-full bg-purple-500/10 p-2">
                <Activity className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Versions</p>
                <p className="font-medium">{versions.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-full bg-orange-500/10 p-2">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-medium">
                  {agent?.updatedAt
                    ? new Date(agent.updatedAt).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Function Performance
            </CardTitle>
            <CardDescription>Failure rate and cache hit rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Failure Rate</span>
                <span className="text-2xl font-bold text-green-500">0.0%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 w-0 rounded-full bg-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cache Hit Rate</span>
                <span className="text-2xl font-bold text-blue-500">--</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 w-0 rounded-full bg-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Concurrency
            </CardTitle>
            <CardDescription>Current function concurrency metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Executions</span>
                <span className="text-2xl font-bold">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Queued</span>
                <span className="text-2xl font-bold">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Max Concurrency</span>
                <span className="text-2xl font-bold">100</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Recent Insights
          </CardTitle>
          <CardDescription>Recent events and notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-medium">No insights yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Insights will appear here when your agent has activity
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
