"use client"

import { useState } from "react"
import { Loader2, ChevronDown, ChevronRight, ExternalLink } from "lucide-react"
import { useAgentWithConfig } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Badge } from "@/components/ui/badge"
import { Id } from "@convex/_generated/dataModel"

interface AgentFunctionsPageProps {
  params: { agentId: string }
}

interface Tool {
  name: string
  description: string
  isBuiltin: boolean
  parameters?: {
    type: string
    properties?: Record<string, { type: string; description?: string }>
    required?: string[]
  }
}

function ToolCard({ tool }: { tool: Tool }) {
  const [expanded, setExpanded] = useState(false)
  const hasParams = tool.parameters?.properties && Object.keys(tool.parameters.properties).length > 0

  return (
    <div className="rounded-md border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-background-secondary transition-colors"
      >
        <div className="mt-0.5">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-content-tertiary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-content-tertiary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-medium text-content-primary">{tool.name}</span>
            {tool.isBuiltin && (
              <Badge variant="secondary" className="text-xs">builtin</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-content-secondary">{tool.description}</p>
        </div>
      </button>
      {expanded && hasParams && (
        <div className="px-4 pb-4 pl-11 border-t">
          <div className="pt-4 space-y-2">
            <div className="text-xs font-medium text-content-tertiary uppercase tracking-wider">Parameters</div>
            <div className="space-y-2">
              {Object.entries(tool.parameters?.properties || {}).map(([name, prop]) => (
                <div key={name} className="flex items-start gap-2 text-sm">
                  <code className="font-mono text-content-primary bg-background-tertiary px-1.5 py-0.5 rounded text-xs">
                    {name}
                  </code>
                  <span className="text-content-tertiary text-xs">{prop.type}</span>
                  {tool.parameters?.required?.includes(name) && (
                    <span className="text-xs text-destructive">required</span>
                  )}
                  {prop.description && (
                    <span className="text-xs text-content-secondary">{prop.description}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AgentFunctionsPage({ params }: AgentFunctionsPageProps) {
  const { agentId } = params
  const agent = useAgentWithConfig(agentId as Id<"agents">)
  const { environment } = useEnvironment()

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

  const tools = config?.tools || []
  const builtinTools = tools.filter((t: Tool) => t.isBuiltin)
  const customTools = tools.filter((t: Tool) => !t.isBuiltin)

  if (!config) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-content-primary">Tools</h2>
          <p className="text-sm text-content-secondary mt-0.5">Functions available to your agent</p>
        </div>
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-content-secondary mb-3">
            No configuration available for {environment}.
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
          <h2 className="text-xl font-semibold text-content-primary">Tools</h2>
          <p className="text-sm text-content-secondary mt-0.5">
            {tools.length} tool{tools.length !== 1 ? "s" : ""} available
          </p>
        </div>
        <a
          href="https://docs.struere.dev/tools"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-content-secondary hover:text-content-primary transition-colors"
        >
          Documentation
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {tools.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-content-secondary">
            No tools configured. Add tools in your agent configuration.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {builtinTools.length > 0 && (
            <div>
              <div className="text-xs font-medium text-content-tertiary uppercase tracking-wider mb-3">
                Built-in Tools ({builtinTools.length})
              </div>
              <div className="space-y-2">
                {builtinTools.map((tool: Tool, index: number) => (
                  <ToolCard key={index} tool={tool} />
                ))}
              </div>
            </div>
          )}

          {customTools.length > 0 && (
            <div>
              <div className="text-xs font-medium text-content-tertiary uppercase tracking-wider mb-3">
                Custom Tools ({customTools.length})
              </div>
              <div className="space-y-2">
                {customTools.map((tool: Tool, index: number) => (
                  <ToolCard key={index} tool={tool} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
