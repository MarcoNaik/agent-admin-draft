"use client"

import { Loader2, ExternalLink, Copy, Check } from "lucide-react"
import { useState } from "react"
import { useAgentWithConfig, useExecutionStats, useRecentExecutions } from "@/hooks/use-convex-data"
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

function StatCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs text-content-secondary mb-1">{label}</div>
      <div className="text-2xl font-semibold text-content-primary">{value}</div>
      {subtext && <div className="text-xs text-content-tertiary mt-1">{subtext}</div>}
    </div>
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
  const agent = useAgentWithConfig(agentId as Id<"agents">)
  const stats = useExecutionStats(agentId as Id<"agents">)
  const executions = useRecentExecutions(agentId as Id<"agents">, 10)
  const { environment } = useEnvironment()

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
  const endpoint = environment === "production"
    ? `https://${agent.slug}.struere.dev`
    : `https://${agent.slug}-dev.struere.dev`

  const successRate = stats?.successRate ?? 1
  const totalExecutions = stats?.executions ?? 0
  const avgDuration = stats?.avgDuration ?? 0

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
          <div className="text-sm font-medium text-content-primary">Endpoint</div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-background-tertiary px-3 py-2 text-sm font-mono text-content-primary">
              {endpoint}
            </code>
            <CopyButton text={endpoint} />
            <a
              href={endpoint}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded hover:bg-background-tertiary transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-content-tertiary" />
            </a>
          </div>
          {config && (
            <div className="mt-3 flex items-center gap-4 text-xs text-content-secondary">
              <span>Version: <span className="font-mono text-content-primary">{config.version}</span></span>
              <span>Model: <span className="font-mono text-content-primary">{config.model?.name || "claude-sonnet-4-20250514"}</span></span>
              <span>Tools: <span className="text-content-primary">{config.tools?.length || 0}</span></span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Executions"
          value={totalExecutions}
        />
        <StatCard
          label="Success Rate"
          value={`${(successRate * 100).toFixed(1)}%`}
        />
        <StatCard
          label="Avg Duration"
          value={formatDuration(avgDuration)}
        />
        <StatCard
          label="Total Tokens"
          value={formatTokens(stats?.totalTokens ?? 0)}
          subtext={stats?.totalTokens ? `${formatTokens(stats.inputTokens ?? 0)} in / ${formatTokens(stats.outputTokens ?? 0)} out` : undefined}
        />
      </div>

      <div className="rounded-md border bg-card">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-medium text-content-primary">Recent Activity</div>
          <Button variant="ghost" size="sm" asChild>
            <a href={`/agents/${agentId}/logs`}>View all</a>
          </Button>
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
