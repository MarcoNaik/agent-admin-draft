import {
  Cpu,
  Bot,
  Wrench,
  MessageSquare,
  Thermometer,
  Hash,
  Database,
  Clock,
  FileCode,
  AlertCircle,
} from "lucide-react"
import { api, AgentConfig } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface AgentConfigPageProps {
  params: Promise<{ agentId: string }>
  searchParams: Promise<{ environment?: string }>
}

export default async function AgentConfigPage({ params, searchParams }: AgentConfigPageProps) {
  const { agentId } = await params
  const { environment = "development" } = await searchParams
  const token = await getAuthToken()

  let config: AgentConfig | null = null
  let versionInfo: {
    id: string
    version: string
    bundleKey: string
    bundleSize: number
    configHash: string
    metadata: {
      modelProvider: string
      modelName: string
      toolCount: number
      bundleSize: number
    }
    deployedAt: string
    deployedBy: string
  } | undefined
  let error: string | null = null

  try {
    const data = await api.config.get(token!, agentId, environment as "development" | "production")
    config = data.config
    versionInfo = data.version
    if (data.error) {
      error = data.error
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load configuration"
  }

  if (error || !config) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Configuration</h2>
          <p className="text-muted-foreground">View your agent&apos;s deployed configuration</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-medium">No configuration available</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {error || "Deploy your agent to see its configuration"}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configuration</h2>
          <p className="text-muted-foreground">View your agent&apos;s deployed configuration</p>
        </div>
        {versionInfo && (
          <Badge variant="secondary" className="font-mono">
            {versionInfo.version}
          </Badge>
        )}
      </div>

      {versionInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCode className="h-5 w-5" />
              Deployment Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Bundle Size</p>
                <p className="font-medium">{formatBytes(versionInfo.bundleSize)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Config Hash</p>
                <p className="font-mono text-sm">{versionInfo.configHash.slice(0, 12)}...</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deployed At</p>
                <p className="font-medium">{new Date(versionInfo.deployedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deployed By</p>
                <p className="font-mono text-sm">{versionInfo.deployedBy.slice(0, 12)}...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-5 w-5" />
              Model Configuration
            </CardTitle>
            <CardDescription>LLM provider and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Provider</span>
              </div>
              <Badge variant="outline">{config.model?.provider || "anthropic"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Model</span>
              </div>
              <span className="font-mono text-sm">{config.model?.name || "claude-sonnet-4-20250514"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Thermometer className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Temperature</span>
              </div>
              <span className="font-mono text-sm">{config.model?.temperature ?? 0.7}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Max Tokens</span>
              </div>
              <span className="font-mono text-sm">{config.model?.maxTokens ?? 4096}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-5 w-5" />
              Tools
            </CardTitle>
            <CardDescription>Available functions for the agent</CardDescription>
          </CardHeader>
          <CardContent>
            {config.tools && config.tools.length > 0 ? (
              <div className="space-y-3">
                {config.tools.map((tool, index) => (
                  <div key={index} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{tool.name}</span>
                    </div>
                    {tool.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Wrench className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No tools configured</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5" />
            System Prompt
          </CardTitle>
          <CardDescription>The instructions that define your agent&apos;s behavior</CardDescription>
        </CardHeader>
        <CardContent>
          {config.systemPrompt ? (
            <div className="rounded-lg bg-muted p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm">{config.systemPrompt}</pre>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No system prompt configured</p>
            </div>
          )}
        </CardContent>
      </Card>

      {config.state && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-5 w-5" />
              State Configuration
            </CardTitle>
            <CardDescription>How agent state is persisted</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {config.state.storage && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Storage</span>
                  </div>
                  <Badge variant="outline">{config.state.storage}</Badge>
                </div>
              )}
              {config.state.ttl && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">TTL</span>
                  </div>
                  <span className="font-mono text-sm">{config.state.ttl}s</span>
                </div>
              )}
              {config.state.prefix && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Prefix</span>
                  </div>
                  <span className="font-mono text-sm">{config.state.prefix}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
