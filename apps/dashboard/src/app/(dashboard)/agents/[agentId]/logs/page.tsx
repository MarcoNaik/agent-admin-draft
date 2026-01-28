import { ScrollText, AlertCircle, Info, AlertTriangle, Bug } from "lucide-react"
import { api, AgentLog } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface AgentLogsPageProps {
  params: Promise<{ agentId: string }>
}

function LogLevelIcon({ level }: { level: AgentLog["level"] }) {
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

function LogLevelBadge({ level }: { level: AgentLog["level"] }) {
  const variants: Record<AgentLog["level"], "default" | "secondary" | "destructive" | "warning"> = {
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

export default async function AgentLogsPage({ params }: AgentLogsPageProps) {
  const { agentId } = await params
  const token = await getAuthToken()

  let logs: AgentLog[] = []
  let error: string | null = null

  try {
    const data = await api.logs.list(token!, agentId, { limit: 100 })
    logs = data.logs
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load logs"
  }

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
            Recent Logs
          </CardTitle>
          <CardDescription>Latest log entries from your agent</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : logs.length === 0 ? (
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
