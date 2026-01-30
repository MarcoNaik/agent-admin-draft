"use client"

import { ScrollText, AlertCircle, Info, AlertTriangle, Bug, Loader2 } from "lucide-react"
import { useRecentExecutions } from "@/hooks/use-convex-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Id } from "@convex/_generated/dataModel"

interface AgentLogsPageProps {
  params: { agentId: string }
}

type LogLevel = "info" | "warn" | "error" | "debug"

function LogLevelIcon({ level }: { level: LogLevel }) {
  switch (level) {
    case "info":
      return <Info className="h-4 w-4 text-blue-500" />
    case "warn":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500" />
    case "debug":
      return <Bug className="h-4 w-4 text-gray-500" />
    default:
      return <Info className="h-4 w-4" />
  }
}

function LogLevelBadge({ level }: { level: LogLevel }) {
  const variants: Record<LogLevel, "default" | "secondary" | "destructive" | "warning"> = {
    info: "default",
    warn: "warning",
    error: "destructive",
    debug: "secondary",
  }

  return (
    <Badge variant={variants[level]} className="text-xs uppercase">
      {level}
    </Badge>
  )
}

export default function AgentLogsPage({ params }: AgentLogsPageProps) {
  const { agentId } = params
  const executions = useRecentExecutions(agentId as Id<"agents">, 100)

  if (executions === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  const logs = executions.map((exec) => ({
    id: exec._id,
    level: (exec.status === "error" ? "error" : "info") as LogLevel,
    message: exec.status === "error"
      ? `Execution failed: ${exec.errorMessage || "Unknown error"}`
      : `Execution completed in ${exec.durationMs}ms (${exec.inputTokens} in / ${exec.outputTokens} out)`,
    timestamp: exec.createdAt,
    metadata: {
      inputTokens: exec.inputTokens,
      outputTokens: exec.outputTokens,
      durationMs: exec.durationMs,
    },
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Logs</h2>
        <p className="text-muted-foreground">View agent execution logs and events</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Recent Executions
          </CardTitle>
          <CardDescription>Latest execution entries from your agent</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ScrollText className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-medium">No logs yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Logs will appear here when your agent runs
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-lg border p-3 font-mono text-sm"
                >
                  <LogLevelIcon level={log.level} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <LogLevelBadge level={log.level} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 break-words">{log.message}</p>
                    {Object.keys(log.metadata).length > 0 && (
                      <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
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
