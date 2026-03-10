"use client"

import { useMemo, useState } from "react"
import { ChevronRight, ChevronDown, Wrench } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

interface ToolsTabProps {
  agentId: Id<"agents"> | undefined
}

interface ToolDef {
  name: string
  description: string
  parameters: any
  handlerCode?: string
  isBuiltin?: boolean
  templateOnly?: boolean
}

function extractCategory(name: string): string {
  const dotIndex = name.indexOf(".")
  if (dotIndex === -1) return "Custom"
  const prefix = name.slice(0, dotIndex)
  return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

function ParameterList({ parameters }: { parameters: any }) {
  const [expanded, setExpanded] = useState(false)

  if (!parameters?.properties || Object.keys(parameters.properties).length === 0) {
    return null
  }

  const props = parameters.properties as Record<string, any>
  const required = new Set(parameters.required ?? [])

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-content-tertiary hover:text-content-secondary transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-2.5 w-2.5" />
        ) : (
          <ChevronRight className="h-2.5 w-2.5" />
        )}
        {Object.keys(props).length} parameters
      </button>
      {expanded && (
        <div className="mt-1 ml-3 space-y-0.5">
          {Object.entries(props).map(([name, schema]: [string, any]) => (
            <div key={name} className="flex items-baseline gap-1.5 text-[10px]">
              <span className="font-mono text-content-primary">{name}</span>
              <span className="text-content-tertiary">
                {schema.type ?? "any"}
                {required.has(name) ? "" : "?"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CodeBlock({ code }: { code: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-content-tertiary hover:text-content-secondary transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-2.5 w-2.5" />
        ) : (
          <ChevronRight className="h-2.5 w-2.5" />
        )}
        View code
      </button>
      {expanded && (
        <pre className="mt-1 ml-3 text-[10px] font-mono text-content-secondary bg-background rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
          {code}
        </pre>
      )}
    </div>
  )
}

function ToolItem({ tool }: { tool: ToolDef }) {
  const isCustom = !tool.isBuiltin

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          isCustom ? "bg-ocean" : "bg-success"
        )} />
        <span className="text-xs font-mono font-medium truncate">{tool.name}</span>
        {tool.templateOnly && (
          <span className="text-[10px] text-content-tertiary ml-auto shrink-0">template only</span>
        )}
      </div>
      {tool.description && (
        <p className="text-[11px] text-content-secondary mt-0.5 ml-4">{tool.description}</p>
      )}
      <div className="ml-4">
        <ParameterList parameters={tool.parameters} />
        {tool.handlerCode && <CodeBlock code={tool.handlerCode} />}
      </div>
    </div>
  )
}

export function ToolsTab({ agentId }: ToolsTabProps) {
  const agent = useQuery(api.agents.getWithConfig, agentId ? { id: agentId } : "skip")

  const grouped = useMemo(() => {
    if (!agent?.developmentConfig?.tools) return null
    const tools = agent.developmentConfig.tools as ToolDef[]
    const groups = new Map<string, ToolDef[]>()
    for (const tool of tools) {
      const category = extractCategory(tool.name)
      const existing = groups.get(category)
      if (existing) {
        existing.push(tool)
      } else {
        groups.set(category, [tool])
      }
    }
    return groups
  }, [agent])

  if (!agentId) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Wrench className="h-8 w-8 text-content-tertiary mb-2" />
        <p className="text-sm text-content-secondary">No agent selected</p>
      </div>
    )
  }

  if (agent === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-content-tertiary">Loading...</p>
      </div>
    )
  }

  if (!grouped || grouped.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Wrench className="h-8 w-8 text-content-tertiary mb-2" />
        <p className="text-sm text-content-secondary">No tools configured</p>
      </div>
    )
  }

  const categories = Array.from(grouped.entries())

  return (
    <div>
      {categories.map(([category, tools]) => (
        <div key={category}>
          <div className="px-3 py-1.5 bg-background-secondary/50">
            <span className="text-[10px] font-medium uppercase tracking-wider text-content-tertiary">
              {category}
            </span>
          </div>
          <div className="divide-y">
            {tools.map((tool) => (
              <ToolItem key={tool.name} tool={tool} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
