"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Activity,
  Clock,
  Zap,
  TrendingUp,
  Code,
  Play,
  ChevronDown,
  ChevronRight,
  Database,
  Bell,
  RefreshCw,
  User,
  Bot,
  Wrench,
} from "lucide-react"
import {
  useAgentWithConfig,
  useExecutionStats,
  useRecentExecutions,
  useCurrentOrganization,
  useCompileSystemPrompt,
} from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Id, Doc } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"

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
      className="p-1 rounded hover:bg-background-tertiary transition-colors ease-out-soft"
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

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "..."
}

interface Tool {
  name: string
  description: string
  isBuiltin: boolean
  templateOnly?: boolean
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
        {tool.templateOnly && (
          <Badge variant="amber" className="text-xs">template-only</Badge>
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

interface ToolCallData {
  name: string
  arguments: unknown
  result?: unknown
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user"
  const Icon = isUser ? User : Bot
  const bgColor = isUser ? "bg-primary/10" : "bg-background-tertiary"
  const borderColor = isUser ? "border-primary/20" : "border-border"

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 text-content-tertiary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-content-secondary mb-1 capitalize">{role}</div>
          <div className="text-sm text-content-primary whitespace-pre-wrap break-words">
            {content || "[Empty]"}
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolCallBubble({ toolCall }: { toolCall: ToolCallData }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-amber/20 bg-amber/10 p-3">
      <div className="flex items-start gap-2">
        <Wrench className="h-4 w-4 mt-0.5 text-amber shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-amber">{toolCall.name}</span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-content-tertiary hover:text-content-secondary"
            >
              {expanded ? "Hide details" : "Show details"}
            </button>
          </div>
          {expanded && (
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-xs text-content-tertiary mb-1">Arguments</div>
                <pre className="text-xs bg-background-tertiary rounded p-2 overflow-x-auto">
                  {JSON.stringify(toolCall.arguments, null, 2)}
                </pre>
              </div>
              {toolCall.result !== undefined && (
                <div>
                  <div className="text-xs text-content-tertiary mb-1">Result</div>
                  <pre className="text-xs bg-background-tertiary rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                    {truncateText(JSON.stringify(toolCall.result, null, 2), 500)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ExecutionDetails({ execution }: { execution: Doc<"executions"> & { inputMessage?: string; outputMessage?: string; toolCalls?: ToolCallData[] } }) {
  const isError = execution.status === "error"
  const hasConversation = execution.inputMessage || execution.outputMessage

  return (
    <div className="space-y-4">
      {isError && execution.errorMessage && (
        <div>
          <div className="text-xs font-medium text-content-secondary mb-1">Error Message</div>
          <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive font-mono">
            {execution.errorMessage}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-xs text-content-tertiary">Execution ID</div>
          <div className="font-mono text-content-secondary truncate">{execution._id}</div>
        </div>
        <div>
          <div className="text-xs text-content-tertiary">Thread ID</div>
          <div className="font-mono text-content-secondary truncate">{execution.threadId || "\u2014"}</div>
        </div>
        <div>
          <div className="text-xs text-content-tertiary">Total Tokens</div>
          <div className="font-mono text-content-secondary">
            {(execution.inputTokens + execution.outputTokens).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-content-tertiary">Created</div>
          <div className="text-content-secondary">
            {new Date(execution.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      {hasConversation && (
        <div className="space-y-3">
          <div className="text-xs font-medium text-content-secondary">Request / Response</div>
          <div className="space-y-2">
            {execution.inputMessage && (
              <MessageBubble role="user" content={execution.inputMessage} />
            )}
            {execution.toolCalls && execution.toolCalls.length > 0 && (
              <div className="pl-4 border-l-2 border-amber/30 space-y-2">
                {execution.toolCalls.slice(0, 5).map((tc: any, i: number) => (
                  <ToolCallBubble key={i} toolCall={tc} />
                ))}
                {execution.toolCalls.length > 5 && (
                  <div className="text-xs text-content-tertiary">+{execution.toolCalls.length - 5} more tool calls</div>
                )}
              </div>
            )}
            {execution.outputMessage && (
              <MessageBubble role="assistant" content={execution.outputMessage} />
            )}
          </div>
        </div>
      )}

      {!hasConversation && (
        <div className="text-sm text-content-tertiary">
          No message data available for this execution.
        </div>
      )}
    </div>
  )
}

function LogRow({ execution }: { execution: Doc<"executions"> }) {
  const [expanded, setExpanded] = useState(false)
  const isError = execution.status === "error"

  return (
    <>
      <tr
        className="border-b hover:bg-background-secondary cursor-pointer transition-colors ease-out-soft"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 w-8">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-content-tertiary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-content-tertiary" />
          )}
        </td>
        <td className="px-4 py-3">
          <Badge variant={isError ? "destructive" : "success"} className="text-xs font-normal">
            {isError ? "error" : "success"}
          </Badge>
        </td>
        <td className="px-4 py-3 text-sm text-content-primary font-mono">
          {formatTimestamp(execution.createdAt)}
        </td>
        <td className="px-4 py-3 text-sm text-content-secondary text-right font-mono">
          {formatDuration(execution.durationMs)}
        </td>
        <td className="px-4 py-3 text-sm text-content-secondary text-right font-mono">
          {execution.inputTokens.toLocaleString()}
        </td>
        <td className="px-4 py-3 text-sm text-content-secondary text-right font-mono">
          {execution.outputTokens.toLocaleString()}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-background-secondary">
          <td colSpan={6} className="px-4 py-4">
            <ExecutionDetails execution={execution} />
          </td>
        </tr>
      )}
    </>
  )
}

interface CompiledPrompt {
  raw: string
  compiled: string
  context: Record<string, unknown>
}

export default function AgentDetailPage({ params }: { params: { agentId: string } }) {
  const { agentId } = params
  const { environment } = useEnvironment()
  const org = useCurrentOrganization()
  const agent = useAgentWithConfig(agentId as Id<"agents">)
  const stats = useExecutionStats(agentId as Id<"agents">, environment)
  const executions = useRecentExecutions(agentId as Id<"agents">, environment, 100)
  const compileAction = useCompileSystemPrompt()

  const [showCompiled, setShowCompiled] = useState(false)
  const [compiledPrompt, setCompiledPrompt] = useState<CompiledPrompt | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)
  const [sampleMessage, setSampleMessage] = useState("Hello, this is a sample message.")
  const [sampleChannel, setSampleChannel] = useState("")
  const [sampleParams, setSampleParams] = useState<Record<string, string>>({})

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

  if (!agent) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-content-secondary">Agent not found</p>
      </div>
    )
  }

  const isDeployed = !!config
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const chatUrl = environment === "production"
    ? `${origin}/chat/${org?.slug ?? "..."}/${agent.slug}`
    : `${origin}/dev-chat/${agent.slug}`
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
          <h2 className="text-xl font-semibold font-display text-content-primary">{agent.name}</h2>
          <p className="text-sm text-content-secondary mt-0.5">{agent.description || "No description"}</p>
        </div>
        <Badge variant={isDeployed ? "success" : "secondary"}>
          {isDeployed ? "Deployed" : "Not deployed"}
        </Badge>
      </div>

      <div className="rounded-lg border bg-card">
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
                className="p-2 rounded hover:bg-background-tertiary transition-colors ease-out-soft"
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
              <span>Model: <span className="font-mono text-content-primary">{config.model?.name || "grok-4-1-fast"}</span></span>
              <span>Tools: <span className="text-content-primary">{config.tools?.length || 0}</span></span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-medium text-content-primary">Activity</div>
        </div>
        <div className="px-4 py-3 bg-background-secondary/30">
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
      </div>

      {config && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <div className="text-sm font-medium text-content-primary">Model</div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-content-secondary">Provider</span>
                  <span className="font-mono text-content-primary">{config.model?.provider || "xai"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-content-secondary">Model</span>
                  <span className="font-mono text-content-primary">{config.model?.name || "grok-4-1-fast"}</span>
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
                href="/system/tools"
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
                  href="/system/tools"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  View Available Tools
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-medium text-content-primary">Logs</div>
          <p className="text-xs text-content-secondary mt-0.5">Execution history and performance metrics</p>
        </div>
        {executions === undefined ? (
          <div className="p-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-content-secondary mx-auto" />
          </div>
        ) : executions.length === 0 ? (
          <div className="p-12 text-center text-sm text-content-secondary">
            No executions yet. Logs will appear here when your agent receives requests.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-secondary border-b">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Input
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Output
                  </th>
                </tr>
              </thead>
              <tbody>
                {executions.map((execution: Doc<"executions">) => (
                  <LogRow key={execution._id} execution={execution} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {executions && executions.length > 0 && (
          <div className="px-4 py-2 border-t text-xs text-content-tertiary text-right">
            Showing {executions.length} most recent executions
          </div>
        )}
      </div>

      {!isDeployed && (
        <div className="rounded-lg border border-dashed p-6 text-center">
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
