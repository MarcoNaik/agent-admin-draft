"use client"

import { useState } from "react"
import {
  Wrench,
  Database,
  Bell,
  Code,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { AdminOnly } from "@/components/role-redirect"
import { cn } from "@/lib/utils"

const BUILTIN_TOOL_DEFINITIONS: Record<string, {
  category: "entity" | "event" | "agent"
  description: string
  parameters: {
    type: string
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}> = {
  "entity.create": {
    category: "entity",
    description: "Create a new entity of a specified type",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Entity type slug (e.g., 'contact', 'order')" },
        data: { type: "object", description: "Entity data matching the type schema" },
        status: { type: "string", description: "Initial status (default: 'active')" },
      },
      required: ["type", "data"],
    },
  },
  "entity.get": {
    category: "entity",
    description: "Retrieve a single entity by its ID",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Entity ID to retrieve" },
      },
      required: ["id"],
    },
  },
  "entity.query": {
    category: "entity",
    description: "Query entities by type with optional filters",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Entity type slug to query" },
        filters: { type: "object", description: "Optional field filters" },
        status: { type: "string", description: "Filter by status" },
        limit: { type: "number", description: "Max results (default: 50)" },
      },
      required: ["type"],
    },
  },
  "entity.update": {
    category: "entity",
    description: "Update an existing entity's data",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Entity ID to update" },
        data: { type: "object", description: "Fields to update (merged with existing)" },
        status: { type: "string", description: "New status (optional)" },
      },
      required: ["id", "data"],
    },
  },
  "entity.delete": {
    category: "entity",
    description: "Soft-delete an entity (sets deletedAt timestamp)",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Entity ID to delete" },
      },
      required: ["id"],
    },
  },
  "entity.link": {
    category: "entity",
    description: "Create a relation between two entities",
    parameters: {
      type: "object",
      properties: {
        fromEntityId: { type: "string", description: "Source entity ID" },
        toEntityId: { type: "string", description: "Target entity ID" },
        relationType: { type: "string", description: "Relation type (e.g., 'parent', 'assigned_to')" },
      },
      required: ["fromEntityId", "toEntityId", "relationType"],
    },
  },
  "entity.unlink": {
    category: "entity",
    description: "Remove a relation between two entities",
    parameters: {
      type: "object",
      properties: {
        fromEntityId: { type: "string", description: "Source entity ID" },
        toEntityId: { type: "string", description: "Target entity ID" },
        relationType: { type: "string", description: "Relation type to remove" },
      },
      required: ["fromEntityId", "toEntityId", "relationType"],
    },
  },
  "event.emit": {
    category: "event",
    description: "Emit a custom event for audit logging",
    parameters: {
      type: "object",
      properties: {
        eventType: { type: "string", description: "Event type name (e.g., 'user.action')" },
        entityId: { type: "string", description: "Related entity ID (optional)" },
        payload: { type: "object", description: "Event payload data" },
      },
      required: ["eventType"],
    },
  },
  "event.query": {
    category: "event",
    description: "Query historical events with filters",
    parameters: {
      type: "object",
      properties: {
        eventType: { type: "string", description: "Filter by event type" },
        entityId: { type: "string", description: "Filter by entity" },
        since: { type: "number", description: "Timestamp to query from" },
        limit: { type: "number", description: "Max results (default: 50)" },
      },
      required: [],
    },
  },
  "agent.chat": {
    category: "agent",
    description: "Send a message to another agent and get its response",
    parameters: {
      type: "object",
      properties: {
        agent: { type: "string", description: "Target agent slug" },
        message: { type: "string", description: "Message to send" },
        context: { type: "object", description: "Optional context data" },
      },
      required: ["agent", "message"],
    },
  },
}

const CATEGORY_INFO: Record<string, {
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}> = {
  entity: {
    label: "Entity Tools",
    description: "CRUD operations on business data",
    icon: Database,
  },
  event: {
    label: "Event Tools",
    description: "Audit logging and queries",
    icon: Bell,
  },
  agent: {
    label: "Agent Tools",
    description: "Multi-agent communication",
    icon: Code,
  },
}

function ToolName({ name }: { name: string }) {
  const dotIndex = name.indexOf(".")
  if (dotIndex === -1) {
    return <code className="text-sm font-mono text-content-primary">{name}</code>
  }
  const prefix = name.slice(0, dotIndex + 1)
  const suffix = name.slice(dotIndex + 1)
  return (
    <code className="text-sm font-mono">
      <span className="text-content-primary/30 group-hover/row:text-content-primary transition-colors">{prefix}</span>
      <span className="text-content-primary">{suffix}</span>
    </code>
  )
}

function ToolRow({
  name,
  description,
  parameters,
}: {
  name: string
  description: string
  parameters?: {
    type: string
    properties?: Record<string, { type: string; description?: string }>
    required?: string[]
  }
}) {
  const [expanded, setExpanded] = useState(false)
  const hasParams = parameters?.properties && Object.keys(parameters.properties).length > 0

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => hasParams && setExpanded(!expanded)}
        className={cn(
          "group/row w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
          hasParams && "hover:bg-background-secondary cursor-pointer"
        )}
      >
        <div className="w-36 shrink-0">
          <ToolName name={name} />
        </div>
        <p className="flex-1 text-sm text-content-tertiary truncate">{description}</p>
        {hasParams && (
          <div className="shrink-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-content-tertiary" />
            ) : (
              <ChevronRight className="h-4 w-4 text-content-tertiary" />
            )}
          </div>
        )}
      </button>
      {expanded && hasParams && (
        <div className="px-4 pb-3">
          <div className="text-xs text-content-tertiary mb-2">Parameters</div>
          <div className="space-y-1.5">
            {Object.entries(parameters?.properties || {}).map(([paramName, prop]) => (
              <div key={paramName} className="flex items-baseline gap-2 text-sm">
                <code className="font-mono text-content-primary text-xs bg-background-tertiary px-1.5 py-0.5 rounded">
                  {paramName}
                </code>
                <span className="text-xs text-content-tertiary">{prop.type}</span>
                {parameters?.required?.includes(paramName) && (
                  <span className="text-xs text-warning">required</span>
                )}
                {prop.description && (
                  <span className="text-xs text-content-secondary">{"\u2014"} {prop.description}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CategorySection({
  categoryKey,
  tools,
  defaultExpanded = true,
}: {
  categoryKey: string
  tools: Array<{ name: string; description: string; parameters?: any }>
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const info = CATEGORY_INFO[categoryKey]
  const Icon = info.icon

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-background-secondary/50 hover:bg-background-secondary transition-colors cursor-pointer"
      >
        <Icon className="h-4 w-4 text-content-secondary" />
        <div className="flex-1 text-left">
          <span className="text-sm font-medium text-content-primary">{info.label}</span>
          <span className="text-xs text-content-tertiary ml-2">{info.description}</span>
        </div>
        <span className="text-xs text-content-tertiary">{tools.length} tools</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-content-tertiary" />
        ) : (
          <ChevronRight className="h-4 w-4 text-content-tertiary" />
        )}
      </button>
      {expanded && (
        <div className="border-t">
          {tools.map((item) => (
            <ToolRow
              key={item.name}
              name={item.name}
              description={item.description}
              parameters={item.parameters}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ToolsPageContent() {
  const categories = new Map<string, Array<{ name: string; description: string; parameters?: any }>>()

  for (const [name, def] of Object.entries(BUILTIN_TOOL_DEFINITIONS)) {
    const cat = def.category
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push({ name, description: def.description, parameters: def.parameters })
  }

  const totalTools = Object.keys(BUILTIN_TOOL_DEFINITIONS).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">Tools</h1>
        <p className="text-sm text-content-secondary mt-1">
          {totalTools} built-in tools available for agents
        </p>
      </div>

      <div className="space-y-4">
        {Array.from(categories.entries()).map(([categoryKey, tools]) => (
          <CategorySection
            key={categoryKey}
            categoryKey={categoryKey}
            tools={tools}
          />
        ))}
      </div>
    </div>
  )
}

export default function ToolsPage() {
  return (
    <AdminOnly>
      <div className="p-6 max-w-4xl">
        <ToolsPageContent />
      </div>
    </AdminOnly>
  )
}
