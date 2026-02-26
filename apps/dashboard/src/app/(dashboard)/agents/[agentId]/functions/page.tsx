"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Database,
  Bell,
  Code,
  Shield,
  Check,
} from "lucide-react"
import { useAgentWithConfig, useEntityTypes } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Id } from "@convex/_generated/dataModel"
import { cn } from "@/lib/utils"

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

const BUILTIN_TOOL_DEFINITIONS: Record<string, {
  category: "entity" | "event"
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
}

const CATEGORY_INFO = {
  entity: {
    label: "Data Tools",
    description: "CRUD operations on business data",
    icon: Database,
  },
  event: {
    label: "Event Tools",
    description: "Audit logging and queries",
    icon: Bell,
  },
  custom: {
    label: "Custom Tools",
    description: "User-defined tools",
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
      <span className="text-content-primary/30 group-hover/row:text-content-primary transition-colors ease-out-soft">{prefix}</span>
      <span className="text-content-primary">{suffix}</span>
    </code>
  )
}

function ToolRow({
  name,
  description,
  isEnabled,
  parameters,
}: {
  name: string
  description: string
  isEnabled: boolean
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
          "group/row w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ease-out-soft",
          hasParams && "hover:bg-background-secondary cursor-pointer"
        )}
      >
        <div className="w-36 shrink-0">
          <ToolName name={name} />
        </div>
        <p className="flex-1 text-sm text-content-tertiary truncate">{description}</p>
        {isEnabled && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-success/10 text-success shrink-0">
            <Check className="h-3 w-3" />
            enabled
          </span>
        )}
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
                  <span className="text-xs text-content-secondary">— {prop.description}</span>
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
  category,
  tools,
  enabledToolNames,
  defaultExpanded = true,
}: {
  category: "entity" | "event" | "custom"
  tools: Array<{ name: string; def?: typeof BUILTIN_TOOL_DEFINITIONS[string]; tool?: Tool }>
  enabledToolNames: Set<string>
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const info = CATEGORY_INFO[category]
  const Icon = info.icon
  const enabledCount = tools.filter((t) => enabledToolNames.has(t.name)).length

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-background-secondary/50 hover:bg-background-secondary transition-colors ease-out-soft cursor-pointer"
      >
        <Icon className="h-4 w-4 text-content-secondary" />
        <div className="flex-1 text-left">
          <span className="text-sm font-medium text-content-primary">{info.label}</span>
          <span className="text-xs text-content-tertiary ml-2">
            {enabledCount}/{tools.length} enabled
          </span>
        </div>
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
              description={item.def?.description || item.tool?.description || ""}
              isEnabled={enabledToolNames.has(item.name)}
              parameters={item.def?.parameters || item.tool?.parameters}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EntityTypesPanel({ entityTypes }: { entityTypes: Array<{ _id: string; name: string; slug: string }> }) {
  if (entityTypes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Database className="h-6 w-6 mx-auto text-content-tertiary mb-2" />
        <p className="text-sm text-content-secondary mb-1">No data types defined</p>
        <p className="text-xs text-content-tertiary mb-3">
          Data types define the structures your agent can interact with.
        </p>
        <Link
          href="/entities"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline cursor-pointer"
        >
          Create Data Type
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-content-secondary">
          Your agent can perform CRUD operations on these data types:
        </p>
        <Link
          href="/entities"
          className="text-xs text-content-secondary hover:text-content-primary transition-colors ease-out-soft cursor-pointer"
        >
          Manage Types
        </Link>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        {entityTypes.map((type, i) => (
          <Link
            key={type._id}
            href={`/entities/${type.slug}`}
            className={cn(
              "flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors ease-out-soft cursor-pointer",
              i !== entityTypes.length - 1 && "border-b"
            )}
          >
            <Database className="h-4 w-4 text-content-tertiary" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-content-primary">{type.name}</div>
              <div className="text-xs text-content-tertiary font-mono">{type.slug}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-content-tertiary" />
          </Link>
        ))}
      </div>
    </div>
  )
}

function PermissionsPanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-content-secondary mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-content-primary">Permission-Aware Execution</h4>
            <p className="mt-1 text-sm text-content-secondary">
              All tool executions respect your RBAC configuration. Scope rules filter rows,
              field masks hide sensitive columns, and all operations are logged.
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary hover:underline cursor-pointer"
            >
              Configure Roles & Permissions
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-sm font-medium text-content-primary">Scope Rules</div>
          <p className="text-xs text-content-secondary mt-1">
            Row-level security filtering
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-sm font-medium text-content-primary">Field Masks</div>
          <p className="text-xs text-content-secondary mt-1">
            Column-level data hiding
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-sm font-medium text-content-primary">Audit Trail</div>
          <p className="text-xs text-content-secondary mt-1">
            Actor context logging
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AgentFunctionsPage({ params }: AgentFunctionsPageProps) {
  const { agentId } = params
  const agent = useAgentWithConfig(agentId as Id<"agents">)
  const { environment } = useEnvironment()
  const entityTypes = useEntityTypes(environment)

  if (agent === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  const config =
    environment === "production" ? agent?.productionConfig : agent?.developmentConfig

  const configuredTools: Tool[] = config?.tools || []
  const enabledToolNames = new Set<string>(configuredTools.map((t) => t.name))
  const customTools = configuredTools.filter((t: Tool) => !t.isBuiltin)

  const entityTools = Object.entries(BUILTIN_TOOL_DEFINITIONS)
    .filter(([_, def]) => def.category === "entity")
    .map(([name, def]) => ({
      name,
      def,
      tool: configuredTools.find((t: Tool) => t.name === name),
    }))

  const eventTools = Object.entries(BUILTIN_TOOL_DEFINITIONS)
    .filter(([_, def]) => def.category === "event")
    .map(([name, def]) => ({
      name,
      def,
      tool: configuredTools.find((t: Tool) => t.name === name),
    }))

  const customToolItems = customTools.map((t: Tool) => ({
    name: t.name,
    tool: t,
  }))

  const totalEnabled = enabledToolNames.size
  const totalBuiltin = Object.keys(BUILTIN_TOOL_DEFINITIONS).length

  if (!config) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold font-display text-content-primary">Tools</h2>
          <p className="text-sm text-content-secondary mt-0.5">
            Functions available to your agent
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Code className="h-6 w-6 mx-auto text-content-tertiary mb-2" />
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold font-display text-content-primary">Tools</h2>
          <p className="text-sm text-content-secondary mt-0.5">
            {totalEnabled} of {totalBuiltin + customTools.length} tools enabled
          </p>
        </div>
        <a
          href="https://docs.struere.dev/tools"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-content-secondary hover:text-content-primary transition-colors ease-out-soft cursor-pointer"
        >
          Docs
        </a>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Tools</TabsTrigger>
          <TabsTrigger value="entities">Data Types</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <CategorySection
            category="entity"
            tools={entityTools}
            enabledToolNames={enabledToolNames}
          />
          <CategorySection
            category="event"
            tools={eventTools}
            enabledToolNames={enabledToolNames}
          />
          {customToolItems.length > 0 && (
            <CategorySection
              category="custom"
              tools={customToolItems}
              enabledToolNames={enabledToolNames}
            />
          )}
        </TabsContent>

        <TabsContent value="entities">
          <EntityTypesPanel entityTypes={entityTypes || []} />
        </TabsContent>

        <TabsContent value="permissions">
          <PermissionsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
