"use client"

import { useState } from "react"
import { Loader2, Code, Play, ChevronDown, ChevronRight } from "lucide-react"
import { useAgentWithConfig, useCompileSystemPrompt } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Id } from "@convex/_generated/dataModel"

interface AgentConfigPageProps {
  params: { agentId: string }
}

interface Tool {
  name: string
  description: string
  isBuiltin: boolean
  parameters?: Record<string, unknown>
}

function ToolItem({ tool }: { tool: Tool }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background-secondary transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-content-tertiary shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-content-tertiary shrink-0" />
        )}
        <span className="font-mono text-sm text-content-primary">{tool.name}</span>
        {tool.isBuiltin && (
          <Badge variant="secondary" className="text-xs">builtin</Badge>
        )}
        <span className="text-sm text-content-secondary truncate ml-auto">
          {tool.description}
        </span>
      </button>
      {expanded && tool.parameters && (
        <div className="px-4 pb-4 pl-11">
          <pre className="rounded bg-background-tertiary p-3 text-xs font-mono overflow-x-auto">
            {JSON.stringify(tool.parameters, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function AgentConfigPage({ params }: AgentConfigPageProps) {
  const { agentId } = params
  const agent = useAgentWithConfig(agentId as Id<"agents">)
  const { environment } = useEnvironment()
  const [showCompiled, setShowCompiled] = useState(false)
  const compiledPrompt = useCompileSystemPrompt(
    agentId as Id<"agents">,
    environment as "development" | "production"
  )

  if (agent === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  const config = environment === "production"
    ? agent?.productionConfig
    : agent?.developmentConfig

  if (!agent || !config) {
    const envLabel = environment === "production" ? "production" : "development"
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-content-primary">Configuration</h2>
          <p className="text-sm text-content-secondary mt-0.5">
            Viewing {envLabel} configuration
          </p>
        </div>
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-content-secondary mb-3">
            No {envLabel} configuration available.
          </p>
          <code className="inline-block rounded bg-background-tertiary px-3 py-1.5 text-sm font-mono text-content-primary">
            {environment === "production" ? "struere deploy" : "struere dev"}
          </code>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-content-primary">Configuration</h2>
          <p className="text-sm text-content-secondary mt-0.5">
            Viewing {environment} configuration
          </p>
        </div>
        <Badge variant="outline" className="font-mono">
          {config.version}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <div className="text-sm font-medium text-content-primary">Model</div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">Provider</span>
              <span className="font-mono text-content-primary">{config.model?.provider || "anthropic"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">Model</span>
              <span className="font-mono text-content-primary">{config.model?.name || "claude-sonnet-4-20250514"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">Temperature</span>
              <span className="font-mono text-content-primary">{config.model?.temperature ?? 0.7}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">Max Tokens</span>
              <span className="font-mono text-content-primary">{config.model?.maxTokens ?? 4096}</span>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <div className="text-sm font-medium text-content-primary">Deployment</div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">Environment</span>
              <span className="text-content-primary capitalize">{config.environment}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">Version</span>
              <span className="font-mono text-content-primary">{config.version}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">Created</span>
              <span className="text-content-primary">{new Date(config.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">Tools</span>
              <span className="text-content-primary">{config.tools?.length || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-medium text-content-primary">System Prompt</div>
          {config.systemPrompt && (
            <div className="flex items-center gap-1">
              <Button
                variant={showCompiled ? "ghost" : "secondary"}
                size="sm"
                onClick={() => setShowCompiled(false)}
                className="h-7 text-xs"
              >
                <Code className="h-3.5 w-3.5 mr-1.5" />
                Raw
              </Button>
              <Button
                variant={showCompiled ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowCompiled(true)}
                className="h-7 text-xs"
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Compiled
              </Button>
            </div>
          )}
        </div>
        <div className="p-4">
          {config.systemPrompt ? (
            <div className="space-y-4">
              <div className="rounded bg-background-tertiary p-4 max-h-96 overflow-auto">
                {showCompiled ? (
                  compiledPrompt === undefined ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-content-secondary" />
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap font-mono text-sm text-content-primary">
                      {compiledPrompt.compiled}
                    </pre>
                  )
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm text-content-primary">
                    {config.systemPrompt}
                  </pre>
                )}
              </div>
              {showCompiled && compiledPrompt && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded bg-background-secondary p-2">
                    <div className="text-content-tertiary">agent.name</div>
                    <div className="font-mono text-content-secondary truncate">
                      {(compiledPrompt.context.agent as { name: string })?.name}
                    </div>
                  </div>
                  <div className="rounded bg-background-secondary p-2">
                    <div className="text-content-tertiary">agent.slug</div>
                    <div className="font-mono text-content-secondary truncate">
                      {(compiledPrompt.context.agent as { slug: string })?.slug}
                    </div>
                  </div>
                  <div className="rounded bg-background-secondary p-2">
                    <div className="text-content-tertiary">datetime</div>
                    <div className="font-mono text-content-secondary truncate">
                      {String(compiledPrompt.context.datetime)}
                    </div>
                  </div>
                  <div className="rounded bg-background-secondary p-2">
                    <div className="text-content-tertiary">message</div>
                    <div className="font-mono text-content-secondary truncate">
                      {String(compiledPrompt.context.message)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-content-secondary text-center py-8">
              No system prompt configured
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-medium text-content-primary">
            Tools ({config.tools?.length || 0})
          </div>
        </div>
        {config.tools && config.tools.length > 0 ? (
          <div>
            {config.tools.map((tool: Tool, index: number) => (
              <ToolItem key={index} tool={tool} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-content-secondary">
            No tools configured
          </div>
        )}
      </div>
    </div>
  )
}
