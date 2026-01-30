"use client"

import { Clock, Rocket, CheckCircle, XCircle, Loader2 as Loader2Icon } from "lucide-react"
import { useAgentWithConfig, useRecentExecutions } from "@/hooks/use-convex-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Id } from "@convex/_generated/dataModel"

interface AgentHistoryPageProps {
  params: { agentId: string }
}

function DeploymentStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "deployed":
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "failed":
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />
    case "deploying":
    case "pending":
      return <Loader2Icon className="h-4 w-4 animate-spin text-yellow-500" />
    default:
      return <Rocket className="h-4 w-4 text-muted-foreground" />
  }
}

function DeploymentStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
    deployed: "success",
    success: "success",
    failed: "destructive",
    error: "destructive",
    deploying: "warning",
    pending: "warning",
  }

  return (
    <Badge variant={variants[status] || "secondary"} className="capitalize">
      {status}
    </Badge>
  )
}

export default function AgentHistoryPage({ params }: AgentHistoryPageProps) {
  const { agentId } = params
  const agentData = useAgentWithConfig(agentId as Id<"agents">)
  const executions = useRecentExecutions(agentId as Id<"agents">, 50)

  if (agentData === undefined || executions === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (!agentData) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    )
  }

  const { agent, config } = agentData

  if (!agent) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    )
  }

  const historyItems = [
    ...(config ? [{
      id: config._id,
      type: "config" as const,
      version: config.version,
      environment: config.environment,
      status: "deployed",
      timestamp: config.createdAt,
    }] : []),
    ...executions.map((exec) => ({
      id: exec._id,
      type: "execution" as const,
      version: null,
      environment: null,
      status: exec.status,
      timestamp: exec.createdAt,
      duration: exec.durationMs,
      tokens: exec.inputTokens + exec.outputTokens,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">History</h2>
        <p className="text-muted-foreground">View deployment history and execution logs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activity History
          </CardTitle>
          <CardDescription>Timeline of deployments and executions</CardDescription>
        </CardHeader>
        <CardContent>
          {historyItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-medium">No activity history</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Activity will appear here after your first deployment or execution
              </p>
            </div>
          ) : (
            <div className="relative space-y-0">
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
              {historyItems.map((item) => (
                <div key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border bg-background">
                    <DeploymentStatusIcon status={item.status} />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {item.type === "config" ? "Configuration deployed" : "Execution"}
                      </span>
                      {item.version && (
                        <Badge variant="outline" className="font-mono text-xs">
                          v{item.version}
                        </Badge>
                      )}
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
                    {item.type === "execution" && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.duration}ms • {item.tokens} tokens
                      </p>
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
