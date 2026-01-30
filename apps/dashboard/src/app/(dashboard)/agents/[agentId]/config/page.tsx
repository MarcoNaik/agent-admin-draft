"use client"

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
  Loader2,
} from "lucide-react"
import { useAgentWithConfig } from "@/hooks/use-convex-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Id } from "@convex/_generated/dataModel"

interface AgentConfigPageProps {
  params: { agentId: string }
}

export default function AgentConfigPage({ params }: AgentConfigPageProps) {
  const { agentId } = params
  const agentData = useAgentWithConfig(agentId as Id<"agents">)

  if (agentData === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (!agentData || !agentData.config) {
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
              Deploy your agent to see its configuration
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { config } = agentData

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configuration</h2>
          <p className="text-muted-foreground">View your agent&apos;s deployed configuration</p>
        </div>
        <Badge variant="secondary" className="font-mono">
          {config.version}
        </Badge>
      </div>

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
              <p className="text-sm text-muted-foreground">Environment</p>
              <p className="font-medium">{config.environment}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Version</p>
              <p className="font-mono text-sm">{config.version}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created At</p>
              <p className="font-medium">{new Date(config.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tools Count</p>
              <p className="font-mono text-sm">{config.tools?.length || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                      {tool.isBuiltin && (
                        <Badge variant="secondary" className="text-xs">builtin</Badge>
                      )}
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
    </div>
  )
}
