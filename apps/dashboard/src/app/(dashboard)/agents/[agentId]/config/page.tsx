"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Loader2, Code, Play, ChevronDown, ChevronRight, Database, Bell, ExternalLink, RefreshCw } from "lucide-react"
import { useAgentWithConfig, useCompileSystemPrompt } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"

interface AgentConfigPageProps {
  params: { agentId: string }
}

interface Tool {
  name: string
  description: string
  isBuiltin: boolean
  parameters?: Record<string, unknown>
}

const TOOL_CATEGORIES: Record<string, { icon: typeof Database; color: string; bgColor: string }> = {
  entity: { icon: Database, color: "text-ocean", bgColor: "bg-ocean/10" },
  event: { icon: Bell, color: "text-amber", bgColor: "bg-amber/10" },
  custom: { icon: Code, color: "text-success", bgColor: "bg-success/10" },
}

function getToolCategory(name: string): keyof typeof TOOL_CATEGORIES {
  if (name.startsWith("entity.")) return "entity"
  if (name.startsWith("event.")) return "event"
  return "custom"
}

function ToolItem({ tool }: { tool: Tool }) {
  const [expanded, setExpanded] = useState(false)
  const category = getToolCategory(tool.name)
  const { icon: Icon, color, bgColor } = TOOL_CATEGORIES[category]

  return (
    <div className="border-b last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background-secondary transition-colors ease-out-soft cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-content-tertiary shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-content-tertiary shrink-0" />
        )}
        <div className={cn("p-1 rounded", bgColor)}>
          <Icon className={cn("h-3.5 w-3.5", color)} />
        </div>
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

interface CompiledPrompt {
  raw: string
  compiled: string
  context: Record<string, unknown>
}

export default function AgentConfigPage({ params }: AgentConfigPageProps) {
  const { agentId } = params
  const agent = useAgentWithConfig(agentId as Id<"agents">)
  const { environment } = useEnvironment()
  const [showCompiled, setShowCompiled] = useState(false)
  const [compiledPrompt, setCompiledPrompt] = useState<CompiledPrompt | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)
  const [sampleMessage, setSampleMessage] = useState("Hello, this is a sample message.")
  const [sampleChannel, setSampleChannel] = useState("")
  const [sampleParams, setSampleParams] = useState<Record<string, string>>({})
  const compileAction = useCompileSystemPrompt()

  const config = environment === "production"
    ? agent?.productionConfig
    : agent?.developmentConfig

  const declaredParams: Array<{ name: string; type: string; required?: boolean; description?: string }> =
    config?.threadContextParams ?? []

  const threadContextParams = (() => {
    const declaredNames = new Set(declaredParams.map((p) => p.name))
    const inferred: Array<{ name: string; type: string; required?: boolean; description?: string }> = []
    if (config?.systemPrompt) {
      const matches = config.systemPrompt.matchAll(/\{\{threadContext\.params\.(\w+)\}\}/g)
      for (const match of matches) {
        if (!declaredNames.has(match[1])) {
          declaredNames.add(match[1])
          inferred.push({ name: match[1], type: "string" })
        }
      }
    }
    return [...declaredParams, ...inferred]
  })()

  const runCompile = useCallback(async () => {
    setIsCompiling(true)
    try {
      const threadMetadata: Record<string, unknown> = {}
      for (const param of threadContextParams) {
        const raw = sampleParams[param.name]
        if (raw === undefined || raw === "") continue
        if (param.type === "number") {
          threadMetadata[param.name] = Number(raw)
        } else if (param.type === "boolean") {
          threadMetadata[param.name] = raw === "true"
        } else {
          threadMetadata[param.name] = raw
        }
      }

      const result = await compileAction({
        agentId: agentId as Id<"agents">,
        environment: environment as "development" | "production",
        sampleContext: {
          message: sampleMessage,
          channel: sampleChannel || undefined,
          threadMetadata: Object.keys(threadMetadata).length > 0 ? threadMetadata : undefined,
        },
      })
      setCompiledPrompt(result)
    } catch (error) {
      console.error("Failed to compile:", error)
    } finally {
      setIsCompiling(false)
    }
  }, [compileAction, agentId, environment, sampleMessage, sampleChannel, sampleParams, threadContextParams])

  useEffect(() => {
    if (showCompiled && !compiledPrompt && !isCompiling) {
      runCompile()
    }
  }, [showCompiled, compiledPrompt, isCompiling, runCompile])

  useEffect(() => {
    setCompiledPrompt(null)
  }, [environment])

  if (agent === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (!agent || !config) {
    const envLabel = environment === "production" ? "production" : "development"
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold font-display text-content-primary">Configuration</h2>
          <p className="text-sm text-content-secondary mt-0.5">
            Viewing {envLabel} configuration
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center">
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
          <h2 className="text-xl font-semibold font-display text-content-primary">Configuration</h2>
          <p className="text-sm text-content-secondary mt-0.5">
            Viewing {environment} configuration
          </p>
        </div>
        <Badge variant="outline" className="font-mono">
          {config.version}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card">
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

        <div className="rounded-lg border bg-card">
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

      <div className="rounded-lg border bg-card">
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
              {showCompiled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={runCompile}
                  disabled={isCompiling}
                  className="h-7 text-xs"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isCompiling && "animate-spin")} />
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="p-4">
          {config.systemPrompt ? (
            <div className="space-y-4">
              <div className="rounded bg-background-tertiary p-4 max-h-96 overflow-auto">
                {showCompiled ? (
                  isCompiling || !compiledPrompt ? (
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
              {threadContextParams.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-content-tertiary">Context params:</span>
                  {threadContextParams.map((param) => (
                    <span key={param.name} className="inline-flex items-center gap-1.5 rounded-full bg-background-tertiary px-2.5 py-1 text-xs font-mono text-content-secondary">
                      {param.name}
                      <span className="text-[10px] text-content-tertiary">{param.type}</span>
                      {param.required && <span className="text-red-400">*</span>}
                    </span>
                  ))}
                </div>
              )}
              {showCompiled && (
                <div className="rounded-lg border border-dashed p-4 space-y-4">
                  <div className="text-xs font-medium text-content-secondary uppercase tracking-wider">Sample Context</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="sample-message" className="text-xs text-content-tertiary">message</Label>
                      <Input
                        id="sample-message"
                        value={sampleMessage}
                        onChange={(e) => setSampleMessage(e.target.value)}
                        className="h-8 text-xs font-mono"
                        placeholder="Sample user message..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sample-channel" className="text-xs text-content-tertiary">threadContext.channel</Label>
                      <Select value={sampleChannel} onValueChange={setSampleChannel}>
                        <SelectTrigger id="sample-channel" className="h-8 text-xs font-mono">
                          <SelectValue placeholder="No channel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">whatsapp</SelectItem>
                          <SelectItem value="widget">widget</SelectItem>
                          <SelectItem value="api">api</SelectItem>
                          <SelectItem value="dashboard">dashboard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {threadContextParams.map((param) => (
                      <div key={param.name} className="space-y-1.5">
                        <Label htmlFor={`param-${param.name}`} className="text-xs text-content-tertiary">
                          threadContext.params.{param.name}
                          {param.required && <span className="text-red-400 ml-0.5">*</span>}
                        </Label>
                        {param.type === "boolean" ? (
                          <Select
                            value={sampleParams[param.name] ?? ""}
                            onValueChange={(val) => setSampleParams((prev) => ({ ...prev, [param.name]: val }))}
                          >
                            <SelectTrigger id={`param-${param.name}`} className="h-8 text-xs font-mono">
                              <SelectValue placeholder="(empty)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">true</SelectItem>
                              <SelectItem value="false">false</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={`param-${param.name}`}
                            type={param.type === "number" ? "number" : "text"}
                            value={sampleParams[param.name] ?? ""}
                            onChange={(e) => setSampleParams((prev) => ({ ...prev, [param.name]: e.target.value }))}
                            className="h-8 text-xs font-mono"
                            placeholder={param.description || `Sample ${param.type}...`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                  <div className="rounded bg-background-secondary p-2">
                    <div className="text-content-tertiary">threadContext.channel</div>
                    <div className="font-mono text-content-secondary truncate">
                      {(compiledPrompt.context.threadContext as { channel?: string })?.channel || "(none)"}
                    </div>
                  </div>
                  {Object.entries(
                    (compiledPrompt.context.threadContext as { params: Record<string, unknown> })?.params || {}
                  ).map(([key, value]) => (
                    <div key={key} className="rounded bg-background-secondary p-2">
                      <div className="text-content-tertiary">threadContext.params.{key}</div>
                      <div className="font-mono text-content-secondary truncate">
                        {String(value)}
                      </div>
                    </div>
                  ))}
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

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-medium text-content-primary">
            First Message Suggestions ({config.firstMessageSuggestions?.length || 0})
          </div>
        </div>
        {config.firstMessageSuggestions && config.firstMessageSuggestions.length > 0 ? (
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {config.firstMessageSuggestions.map((suggestion: string, i: number) => (
                <span
                  key={i}
                  className="rounded-full bg-background-tertiary text-content-primary px-3 py-1.5 text-sm"
                >
                  {suggestion}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-content-secondary">No suggestions configured</p>
            <p className="text-xs text-content-tertiary mt-1">
              Add <code className="font-mono bg-background-tertiary px-1 py-0.5 rounded">firstMessageSuggestions</code> to your agent config
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-content-primary">
              Tools ({config.tools?.length || 0})
            </div>
            {config.tools && config.tools.length > 0 && (
              <div className="flex items-center gap-3 mt-1">
                {(() => {
                  const builtinCount = config.tools.filter((t: Tool) => t.isBuiltin).length
                  const customCount = config.tools.length - builtinCount
                  const entityCount = config.tools.filter((t: Tool) => t.name.startsWith("entity.")).length
                  const eventCount = config.tools.filter((t: Tool) => t.name.startsWith("event.")).length
                  return (
                    <>
                      {entityCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-content-tertiary">
                          <Database className="h-3 w-3 text-ocean" />
                          {entityCount} entity
                        </span>
                      )}
                      {eventCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-content-tertiary">
                          <Bell className="h-3 w-3 text-amber" />
                          {eventCount} event
                        </span>
                      )}
                      {customCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-content-tertiary">
                          <Code className="h-3 w-3 text-success" />
                          {customCount} custom
                        </span>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
          <Link
            href={`/agents/${agentId}/functions`}
            className="inline-flex items-center gap-1.5 text-xs text-content-secondary hover:text-content-primary transition-colors ease-out-soft"
          >
            View All
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        {config.tools && config.tools.length > 0 ? (
          <div>
            {config.tools.map((tool: Tool, index: number) => (
              <ToolItem key={index} tool={tool} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-content-secondary mb-2">No tools configured</p>
            <p className="text-xs text-content-tertiary mb-3">
              9 built-in tools available for entities and events
            </p>
            <Link
              href={`/agents/${agentId}/functions`}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              View Available Tools
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
