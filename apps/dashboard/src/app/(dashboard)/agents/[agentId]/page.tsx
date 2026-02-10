"use client"

import { Loader2, ExternalLink, Copy, Check, Activity, Clock, Zap, TrendingUp } from "lucide-react"
import { useState } from "react"
import { useAgentWithConfig, useExecutionStats, useRecentExecutions, useCurrentOrganization } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Id, Doc } from "@convex/_generated/dataModel"

interface AgentOverviewPageProps {
  params: { agentId: string }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="p-1 rounded hover:bg-background-tertiary transition-colors"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-content-tertiary" />
      )}
    </button>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return tokens.toString()
  return `${(tokens / 1000).toFixed(1)}k`
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function AgentOverviewPage({ params }: AgentOverviewPageProps) {
  const { agentId } = params
  const { environment } = useEnvironment()
  const org = useCurrentOrganization()
  const agent = useAgentWithConfig(agentId as Id<"agents">)
  const stats = useExecutionStats(agentId as Id<"agents">, environment)
  const executions = useRecentExecutions(agentId as Id<"agents">, environment, 10)

  if (agent === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-content-secondary">Agent not found</p>
      </div>
    )
  }

  const config = environment === "production" ? agent.productionConfig : agent.developmentConfig
  const isDeployed = !!config
  const chatUrl = `/chat/${org?.slug ?? "..."}/${agent.slug}`
  const apiEndpoint = `${process.env.NEXT_PUBLIC_CONVEX_URL}/v1/agents/${agent.slug}/chat`

  const totalExecutions = stats?.total ?? 0
  const successRate = totalExecutions > 0 ? (stats?.successRate ?? 0) : 0
  const avgDuration = stats?.averageDurationMs ?? 0
  const totalTokens = stats?.totalTokens ?? 0
  const inputTokens = stats?.totalInputTokens ?? 0
  const outputTokens = stats?.totalOutputTokens ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-content-primary">{agent.name}</h2>
          <p className="text-sm text-content-secondary mt-0.5">{agent.description || "No description"}</p>
        </div>
        <Badge variant={isDeployed ? "success" : "secondary"}>
          {isDeployed ? "Deployed" : "Not deployed"}
        </Badge>
      </div>

      <div className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-medium text-content-primary">Chat</div>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <div className="text-xs text-content-secondary mb-1.5">Chat UI</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-background-tertiary px-3 py-2 text-sm font-mono text-content-primary">
                {chatUrl}
              </code>
              <CopyButton text={chatUrl} />
              <a
                href={chatUrl}
                className="p-2 rounded hover:bg-background-tertiary transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-content-tertiary" />
              </a>
            </div>
          </div>
          <div>
            <div className="text-xs text-content-secondary mb-1.5">API Endpoint</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-background-tertiary px-3 py-2 text-sm font-mono text-content-primary truncate">
                {apiEndpoint}
              </code>
              <CopyButton text={apiEndpoint} />
            </div>
          </div>
          {config && (
            <div className="flex items-center gap-4 text-xs text-content-secondary pt-2 border-t">
              <span>Version: <span className="font-mono text-content-primary">{config.version}</span></span>
              <span>Model: <span className="font-mono text-content-primary">{config.model?.name || "claude-sonnet-4-20250514"}</span></span>
              <span>Tools: <span className="text-content-primary">{config.tools?.length || 0}</span></span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-medium text-content-primary">Activity</div>
          <Button variant="ghost" size="sm" asChild>
            <a href={`/agents/${agentId}/logs`}>View all</a>
          </Button>
        </div>

        <div className="px-4 py-3 border-b bg-background-secondary/30">
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-content-tertiary" />
              <span className="text-content-secondary">Executions</span>
              <span className="font-medium text-content-primary">{totalExecutions}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-content-tertiary" />
              <span className="text-content-secondary">Success</span>
              <span className="font-medium text-content-primary">{successRate.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-content-tertiary" />
              <span className="text-content-secondary">Avg</span>
              <span className="font-medium text-content-primary">{formatDuration(avgDuration)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-content-tertiary" />
              <span className="text-content-secondary">Tokens</span>
              <span className="font-medium text-content-primary">
                {formatTokens(totalTokens)}
                {totalTokens > 0 && (
                  <span className="text-content-tertiary font-normal ml-1">
                    ({formatTokens(inputTokens)} in / {formatTokens(outputTokens)} out)
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {executions === undefined ? (
          <div className="p-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-content-secondary mx-auto" />
          </div>
        ) : executions.length === 0 ? (
          <div className="p-8 text-center text-sm text-content-secondary">
            No executions yet. Send a request to your agent to get started.
          </div>
        ) : (
          <div className="divide-y">
            {executions.slice(0, 5).map((exec: Doc<"executions">) => (
              <div key={exec._id} className="px-4 py-3 flex items-center gap-4">
                <div className={`h-2 w-2 rounded-full ${exec.status === "error" ? "bg-destructive" : "bg-success"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-content-primary truncate">
                    {exec.status === "error" ? exec.errorMessage || "Execution failed" : "Execution completed"}
                  </div>
                  <div className="text-xs text-content-tertiary">
                    {formatDuration(exec.durationMs)} · {exec.inputTokens + exec.outputTokens} tokens
                  </div>
                </div>
                <div className="text-xs text-content-tertiary whitespace-nowrap">
                  {timeAgo(exec.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isDeployed && (
        <div className="rounded-md border border-dashed p-6 text-center">
          <p className="text-sm text-content-secondary mb-3">
            {environment === "production"
              ? "Deploy your agent to production to make it available at the endpoint above."
              : "Sync your agent configuration to see it here."}
          </p>
          <code className="inline-block rounded bg-background-tertiary px-3 py-1.5 text-sm font-mono text-content-primary">
            {environment === "production" ? "struere deploy" : "struere dev"}
          </code>
        </div>
      )}
    </div>
  )
}
