"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Play, RotateCcw } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Id } from "@convex/_generated/dataModel"
import { useCompileSystemPrompt } from "@/hooks/use-agents"

interface CompiledPrompt {
  raw: string
  compiled: string
  context: Record<string, unknown>
}

interface AgentConfigTabProps {
  agentId: string
  config: any
  environment: string
}

export function AgentConfigTab({ agentId, config, environment }: AgentConfigTabProps) {
  const compileAction = useCompileSystemPrompt()
  const [compiledPrompt, setCompiledPrompt] = useState<CompiledPrompt | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)
  const [sampleMessage, setSampleMessage] = useState("Hello, this is a sample message.")
  const [sampleChannel, setSampleChannel] = useState("")
  const [sampleParams, setSampleParams] = useState<Record<string, string>>({})

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
    setCompiledPrompt(null)
  }, [environment])

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-medium text-content-primary">System Prompt</div>
          {config.systemPrompt && (
            <div className="flex items-center gap-1">
              {compiledPrompt && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCompiledPrompt(null)}
                  className="h-7 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Raw
                </Button>
              )}
              <Button
                size="sm"
                variant={compiledPrompt ? "secondary" : "default"}
                onClick={runCompile}
                disabled={isCompiling}
                className="h-7 text-xs"
              >
                {isCompiling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                )}
                Compile
              </Button>
            </div>
          )}
        </div>
        <div className="p-4">
          {config.systemPrompt ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                <div>
                  <div className="text-[10px] text-content-tertiary mb-1 truncate">message</div>
                  <Input
                    value={sampleMessage}
                    onChange={(e) => setSampleMessage(e.target.value)}
                    className="h-7 text-xs font-mono"
                    placeholder="Sample message..."
                  />
                </div>
                <div>
                  <div className="text-[10px] text-content-tertiary mb-1 truncate">channel</div>
                  <Select value={sampleChannel} onValueChange={setSampleChannel}>
                    <SelectTrigger className="h-7 text-xs font-mono">
                      <SelectValue placeholder="(none)" />
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
                  <div key={param.name}>
                    <div className="text-[10px] text-content-tertiary mb-1 truncate">
                      {param.name}
                      {param.required && <span className="text-red-400 ml-0.5">*</span>}
                    </div>
                    {param.type === "boolean" ? (
                      <Select
                        value={sampleParams[param.name] ?? ""}
                        onValueChange={(val) => setSampleParams((prev) => ({ ...prev, [param.name]: val }))}
                      >
                        <SelectTrigger className="h-7 text-xs font-mono">
                          <SelectValue placeholder="(empty)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">true</SelectItem>
                          <SelectItem value="false">false</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={param.type === "number" ? "number" : "text"}
                        value={sampleParams[param.name] ?? ""}
                        onChange={(e) => setSampleParams((prev) => ({ ...prev, [param.name]: e.target.value }))}
                        className="h-7 text-xs font-mono"
                        placeholder={param.description || param.type}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="rounded bg-background-tertiary p-4 max-h-[600px] overflow-auto">
                <pre className="whitespace-pre-wrap font-mono text-sm text-content-primary">
                  {compiledPrompt ? compiledPrompt.compiled : config.systemPrompt}
                </pre>
              </div>
              {compiledPrompt && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-tertiary font-mono">
                  <span className="text-content-secondary text-[10px] uppercase tracking-wider font-sans">Injected:</span>
                  <span>agent.name = &quot;{(compiledPrompt.context.agent as { name: string })?.name}&quot;</span>
                  <span>&middot;</span>
                  <span>agent.slug = &quot;{(compiledPrompt.context.agent as { slug: string })?.slug}&quot;</span>
                  <span>&middot;</span>
                  <span>datetime = &quot;{String(compiledPrompt.context.datetime).slice(0, 19)}&quot;</span>
                  {Array.isArray(compiledPrompt.context.entityTypes) && (
                    <>
                      <span>&middot;</span>
                      <span>entityTypes = {(compiledPrompt.context.entityTypes as unknown[]).length} types</span>
                    </>
                  )}
                </div>
              )}
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
            </div>
          ) : (
            <div className="text-sm text-content-secondary text-center py-8">
              No system prompt configured
            </div>
          )}
        </div>
      </div>

      {config.firstMessageSuggestions && config.firstMessageSuggestions.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <div className="text-sm font-medium text-content-primary">
              First Message Suggestions
            </div>
          </div>
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
        </div>
      )}
    </div>
  )
}
