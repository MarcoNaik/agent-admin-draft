"use client"

import { ExternalLink, Activity, Clock, Zap, TrendingUp } from "@/lib/icons"
import { CopyButton } from "./copy-button"
import { formatDuration } from "@/lib/format"

function formatTokens(tokens: number): string {
  if (tokens < 1000) return tokens.toString()
  return `${(tokens / 1000).toFixed(1)}k`
}

interface AgentHeaderProps {
  agent: {
    name: string
    slug: string
    description?: string
  }
  config: any
  stats: {
    total: number
    successRate: number
    averageDurationMs: number
    totalTokens: number
    totalInputTokens: number
    totalOutputTokens: number
  } | null
  chatUrl: string
  apiEndpoint: string
  environment: string
}

export function AgentHeader({ agent, config, stats, chatUrl, apiEndpoint, environment }: AgentHeaderProps) {
  const totalExecutions = stats?.total ?? 0
  const successRate = totalExecutions > 0 ? (stats?.successRate ?? 0) : 0
  const avgDuration = stats?.averageDurationMs ?? 0
  const totalTokens = stats?.totalTokens ?? 0
  const inputTokens = stats?.totalInputTokens ?? 0
  const outputTokens = stats?.totalOutputTokens ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold font-display text-content-primary">{agent.name}</h2>
          <p className="text-sm text-content-secondary mt-0.5">{agent.description || "No description"}</p>
        </div>
        <div className="space-y-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-content-tertiary uppercase tracking-wider w-8 text-right">Chat</span>
            <code className="rounded bg-background-tertiary px-2 py-0.5 text-[11px] font-mono text-content-primary truncate max-w-[280px]">
              {chatUrl}
            </code>
            <CopyButton text={chatUrl} />
            <a
              href={chatUrl}
              className="p-0.5 rounded hover:bg-background-tertiary transition-colors ease-out-soft"
            >
              <ExternalLink className="h-3 w-3 text-content-tertiary" />
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-content-tertiary uppercase tracking-wider w-8 text-right">API</span>
            <code className="rounded bg-background-tertiary px-2 py-0.5 text-[11px] font-mono text-content-primary truncate max-w-[280px]">
              {apiEndpoint}
            </code>
            <CopyButton text={apiEndpoint} />
          </div>
        </div>
      </div>

      {config && (
        <div className="flex items-center gap-4 text-xs text-content-secondary">
          <span>{config.model?.provider || "xai"} <span className="text-content-primary font-mono">{config.model?.name || "grok-4-1-fast"}</span></span>
          <span className="text-border">|</span>
          <span>v{config.version}</span>
          <span className="text-border">|</span>
          <span>temp {config.model?.temperature ?? 0.7}</span>
          <span className="text-border">|</span>
          <span>{config.model?.maxTokens ?? 4096} max tokens</span>
        </div>
      )}

      <div className="flex items-center gap-6 text-xs py-2 px-3 rounded-md bg-background-secondary/50">
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
  )
}
