import { Clock, Rocket, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { api, Deployment, AgentVersion } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface AgentHistoryPageProps {
  params: Promise<{ agentId: string }>
}

function DeploymentStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "deployed":
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />
    case "deploying":
    case "pending":
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
    default:
      return <Rocket className="h-4 w-4 text-muted-foreground" />
  }
}

function DeploymentStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
    deployed: "success",
    success: "success",
    failed: "destructive",
    deploying: "warning",
    pending: "warning",
  }

  return (
    <Badge variant={variants[status] || "secondary"} className="capitalize">
      {status}
    </Badge>
  )
}

export default async function AgentHistoryPage({ params }: AgentHistoryPageProps) {
  const { agentId } = await params
  const token = await getAuthToken()

  let deployments: Deployment[] = []
  let versions: AgentVersion[] = []
  let error: string | null = null

  try {
    const [deploymentsData, agentData] = await Promise.all([
      api.deployments.list(token!, agentId).catch(() => ({ deployments: [] })),
      api.agents.get(token!, agentId),
    ])
    deployments = deploymentsData.deployments
    versions = agentData.versions
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load history"
  }

  const historyItems = [
    ...deployments.map((d) => ({
      id: d.id,
      type: "deployment" as const,
      version: versions.find((v) => v.id === d.versionId)?.version || "unknown",
      environment: d.environment,
      status: d.status,
      url: d.url,
      timestamp: d.createdAt,
    })),
    ...versions.map((v) => ({
      id: v.id,
      type: "version" as const,
      version: v.version,
      environment: null,
      status: v.status,
      url: null,
      timestamp: v.deployedAt,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">History</h2>
        <p className="text-muted-foreground">View deployment history and version changes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Deployment History
          </CardTitle>
          <CardDescription>Timeline of deployments and version changes</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : historyItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-medium">No deployment history</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Deployment history will appear here after your first deployment
              </p>
            </div>
          ) : (
            <div className="relative space-y-0">
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
              {historyItems.map((item, index) => (
                <div key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border bg-background">
                    <DeploymentStatusIcon status={item.status} />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {item.type === "deployment" ? "Deployed" : "Version created"}
                      </span>
                      <Badge variant="outline" className="font-mono text-xs">
                        v{item.version}
                      </Badge>
                      <DeploymentStatusBadge status={item.status} />
                      {item.environment && (
                        <Badge
                          variant={item.environment === "production" ? "success" : "secondary"}
                          className="capitalize"
                        >
                          {item.environment}
                        </Badge>
                      )}
                    </div>
                    {item.url && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{item.url}</p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
