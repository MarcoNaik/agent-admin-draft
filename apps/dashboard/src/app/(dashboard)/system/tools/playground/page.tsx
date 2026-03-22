"use client"

import { useState, useEffect } from "react"
import { useQuery, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { useEnvironment } from "@/contexts/environment-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, Loader2 } from "@/lib/icons"
import { cn } from "@/lib/utils"

function generateArgsTemplate(parameters: any): string {
  if (!parameters?.properties) return "{}"
  const template: Record<string, unknown> = {}
  for (const [key, prop] of Object.entries(parameters.properties as Record<string, any>)) {
    if (prop.type === "string") template[key] = ""
    else if (prop.type === "number") template[key] = 0
    else if (prop.type === "boolean") template[key] = false
    else if (prop.type === "array") template[key] = []
    else if (prop.type === "object") template[key] = {}
    else template[key] = null
  }
  return JSON.stringify(template, null, 2)
}

export default function ToolPlaygroundPage() {
  const { environment } = useEnvironment()
  const agents = useQuery(api.agents.list, {})
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")
  const [selectedTool, setSelectedTool] = useState<string>("")
  const [toolArgs, setToolArgs] = useState("{}")
  const [result, setResult] = useState<any>(null)
  const [isRunning, setIsRunning] = useState(false)
  const runTool = useAction(api.toolTesting.runTool)

  const agentTools = useQuery(
    api.toolTesting.listAgentTools,
    selectedAgentId ? { agentId: selectedAgentId as Id<"agents">, environment: environment as "development" | "production" | "eval" } : "skip"
  )

  const selectedToolDef = agentTools?.find((t: any) => t.name === selectedTool)

  useEffect(() => {
    if (selectedToolDef?.parameters) {
      setToolArgs(generateArgsTemplate(selectedToolDef.parameters))
    } else {
      setToolArgs("{}")
    }
    setResult(null)
  }, [selectedTool, selectedToolDef])

  useEffect(() => {
    setSelectedTool("")
    setResult(null)
  }, [selectedAgentId])

  const handleRun = async () => {
    setIsRunning(true)
    setResult(null)
    try {
      const parsed = JSON.parse(toolArgs)
      const res = await runTool({
        agentId: selectedAgentId as Id<"agents">,
        environment: environment as "development" | "production" | "eval",
        toolName: selectedTool,
        toolArgs: parsed,
      })
      setResult(res)
    } catch (err) {
      setResult({ error: true, errorType: "parse_error", message: err instanceof Error ? err.message : "Invalid JSON" })
    } finally {
      setIsRunning(false)
    }
  }

  const isProduction = environment === "production"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-semibold text-content-primary">Tool Playground</h1>
        <p className="text-sm text-content-secondary mt-1">
          Test tools as they would execute during a real agent conversation
        </p>
      </div>

      {isProduction && (
        <div className="rounded-lg border border-amber/30 bg-amber/5 px-4 py-3">
          <p className="text-sm text-amber font-medium">Production Environment</p>
          <p className="text-xs text-content-secondary mt-0.5">Tools will execute against production data with real side effects.</p>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 space-y-3">
          <div>
            <label className="block text-xs text-content-secondary mb-1">Agent</label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="w-full rounded bg-background-tertiary px-3 py-2 text-sm text-content-primary border-0 outline-none"
            >
              <option value="">Select an agent...</option>
              {(agents ?? []).map((a: any) => (
                <option key={a._id} value={a._id}>{a.name} ({a.slug})</option>
              ))}
            </select>
          </div>

          {selectedAgentId && (
            <div>
              <label className="block text-xs text-content-secondary mb-1">Tool</label>
              <select
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value)}
                className="w-full rounded bg-background-tertiary px-3 py-2 text-sm text-content-primary border-0 outline-none"
              >
                <option value="">Select a tool...</option>
                {(agentTools ?? []).filter((t: any) => !t.templateOnly).map((t: any) => (
                  <option key={t.name} value={t.name}>{t.name} — {t.description}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedTool && (
          <div className="border-b px-4 py-3">
            <label className="block text-xs text-content-secondary mb-1">Arguments (JSON)</label>
            <textarea
              value={toolArgs}
              onChange={(e) => setToolArgs(e.target.value)}
              className="w-full rounded bg-background-tertiary p-3 text-xs font-mono resize-y min-h-[120px] text-content-primary border-0 outline-none"
              spellCheck={false}
            />
          </div>
        )}

        {selectedTool && (
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              onClick={handleRun}
              disabled={isRunning || !selectedTool}
              variant={isProduction ? "destructive" : "default"}
              size="sm"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Run Tool
                </>
              )}
            </Button>
            {isProduction && !isRunning && (
              <span className="text-xs text-amber">This will execute against production</span>
            )}
          </div>
        )}

        {result && (
          <div className="border-t px-4 py-3">
            {result.error ? (
              <div className="rounded border-l-2 border-destructive bg-destructive/5 p-3">
                <p className="text-xs font-medium text-destructive">{result.errorType}</p>
                <p className="text-xs text-content-secondary mt-1">{result.message}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-background-tertiary text-content-secondary px-1.5 py-0.5 rounded">{result.durationMs}ms</span>
                  <span className="text-[10px] bg-background-tertiary text-content-secondary px-1.5 py-0.5 rounded">{result.identity?.identityMode} mode</span>
                  {result.tool?.isBuiltin && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">builtin</Badge>
                  )}
                </div>
                <div className="rounded border-l-2 border-success bg-success/5 p-3">
                  <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap text-content-primary">
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
