"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, Database, Bell, Code, ExternalLink } from "@/lib/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
  calendar: { icon: Database, color: "text-violet-400", bgColor: "bg-violet-400/10" },
  whatsapp: { icon: Database, color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  airtable: { icon: Database, color: "text-blue-400", bgColor: "bg-blue-400/10" },
  email: { icon: Database, color: "text-rose-400", bgColor: "bg-rose-400/10" },
  payment: { icon: Database, color: "text-amber", bgColor: "bg-amber/10" },
  agent: { icon: Database, color: "text-cyan-400", bgColor: "bg-cyan-400/10" },
  custom: { icon: Code, color: "text-success", bgColor: "bg-success/10" },
}

function getToolCategory(name: string): string {
  const prefix = name.split(".")[0]
  if (prefix in TOOL_CATEGORIES) return prefix
  return "custom"
}

function ToolItem({ tool }: { tool: Tool }) {
  const [expanded, setExpanded] = useState(false)
  const category = getToolCategory(tool.name)
  const { icon: Icon, color, bgColor } = TOOL_CATEGORIES[category] ?? TOOL_CATEGORIES.custom

  return (
    <div className="border-b last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-background-secondary transition-colors ease-out-soft cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-content-tertiary shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-content-tertiary shrink-0" />
        )}
        <div className={cn("p-1 rounded", bgColor)}>
          <Icon className={cn("h-3 w-3", color)} />
        </div>
        <span className="font-mono text-xs text-content-primary">{tool.name}</span>
        {tool.isBuiltin && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">builtin</Badge>
        )}
        {tool.templateOnly && (
          <Badge variant="amber" className="text-[10px] px-1.5 py-0">template-only</Badge>
        )}
        <span className="text-xs text-content-tertiary truncate ml-auto max-w-[40%]">
          {tool.description}
        </span>
      </button>
      {expanded && tool.parameters && (
        <div className="px-4 pb-3 pl-11">
          <pre className="rounded bg-background-tertiary p-3 text-xs font-mono overflow-x-auto">
            {JSON.stringify(tool.parameters, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

interface AgentToolsTabProps {
  config: any
}

export function AgentToolsTab({ config }: AgentToolsTabProps) {
  const tools: Tool[] = config?.tools ?? []
  const [expandAll, setExpandAll] = useState(false)

  if (tools.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
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
    )
  }

  const categories = tools.reduce((acc, tool) => {
    const cat = getToolCategory(tool.name)
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Object.entries(categories).map(([cat, count]) => {
            const { icon: Icon, color } = TOOL_CATEGORIES[cat] ?? TOOL_CATEGORIES.custom
            return (
              <span key={cat} className="flex items-center gap-1 text-xs text-content-tertiary">
                <Icon className={cn("h-3 w-3", color)} />
                {count} {cat}
              </span>
            )
          })}
        </div>
        <Link
          href="/system/tools"
          className="inline-flex items-center gap-1.5 text-xs text-content-secondary hover:text-content-primary transition-colors ease-out-soft"
        >
          View All
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div>
        {tools.map((tool: Tool, index: number) => (
          <ToolItem key={index} tool={tool} />
        ))}
      </div>
    </div>
  )
}
