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
  Clock,
  Code,
  Shield,
  Check,
  Minus,
  Link2,
  Unlink,
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react"
import { useAgentWithConfig, useEntityTypes } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  category: "entity" | "event" | "job"
  description: string
  icon: typeof Database
  parameters: {
    type: string
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}> = {
  "entity.create": {
    category: "entity",
    description: "Create a new entity of a specified type",
    icon: Plus,
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
    icon: Eye,
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
    icon: Search,
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
    icon: Pencil,
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
    icon: Trash2,
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
    icon: Link2,
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
    icon: Unlink,
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
    icon: Bell,
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
    icon: Search,
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
  "job.enqueue": {
    category: "job",
    description: "Schedule a background job for async processing",
    icon: Clock,
    parameters: {
      type: "object",
      properties: {
        jobType: { type: "string", description: "Job type to execute" },
        payload: { type: "object", description: "Job input data" },
        runAt: { type: "number", description: "Scheduled execution time (optional)" },
      },
      required: ["jobType"],
    },
  },
  "job.status": {
    category: "job",
    description: "Check the status of a scheduled job",
    icon: Eye,
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Job ID to check" },
      },
      required: ["jobId"],
    },
  },
}

const CATEGORY_INFO = {
  entity: {
    label: "Entity Tools",
    description: "CRUD operations on your business data with RBAC enforcement",
    icon: Database,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  event: {
    label: "Event Tools",
    description: "Audit logging and event history queries",
    icon: Bell,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  job: {
    label: "Job Tools",
    description: "Background job scheduling and status checks",
    icon: Clock,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  custom: {
    label: "Custom Tools",
    description: "User-defined tools executed in sandboxed environment",
    icon: Code,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
}

function ToolCard({
  tool,
  isEnabled,
  builtinDef,
  category,
}: {
  tool?: Tool
  isEnabled: boolean
  builtinDef?: typeof BUILTIN_TOOL_DEFINITIONS[string]
  category?: "entity" | "event" | "job" | "custom"
}) {
  const [expanded, setExpanded] = useState(false)
  const name = tool?.name || ""
  const description = tool?.description || builtinDef?.description || ""
  const parameters = tool?.parameters || builtinDef?.parameters
  const hasParams = parameters?.properties && Object.keys(parameters.properties).length > 0
  const Icon = builtinDef?.icon || Code
  const categoryInfo = category ? CATEGORY_INFO[category] : CATEGORY_INFO.custom

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        isEnabled ? "bg-card border-border" : "bg-background-secondary/50 border-border/50"
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-background-secondary/50 transition-colors cursor-pointer"
      >
        <div
          className={cn(
            "mt-0.5 p-1.5 rounded-md",
            isEnabled ? categoryInfo.bgColor : "bg-background-tertiary"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              isEnabled ? categoryInfo.color : "text-content-tertiary"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "font-mono text-sm font-medium",
                isEnabled ? "text-content-primary" : "text-content-tertiary"
              )}
            >
              {name}
            </span>
            {isEnabled ? (
              <Badge variant="success" className="text-xs gap-1">
                <Check className="h-3 w-3" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-content-tertiary gap-1">
                <Minus className="h-3 w-3" />
                Available
              </Badge>
            )}
          </div>
          <p
            className={cn(
              "mt-1 text-sm",
              isEnabled ? "text-content-secondary" : "text-content-tertiary"
            )}
          >
            {description}
          </p>
        </div>
        <div className="mt-1">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-content-tertiary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-content-tertiary" />
          )}
        </div>
      </button>
      {expanded && hasParams && (
        <div className="px-4 pb-4 pl-14 border-t border-border/50">
          <div className="pt-4 space-y-3">
            <div className="text-xs font-medium text-content-tertiary uppercase tracking-wider">
              Parameters
            </div>
            <div className="space-y-2">
              {Object.entries(parameters?.properties || {}).map(([paramName, prop]) => (
                <div key={paramName} className="flex items-start gap-2 text-sm">
                  <code className="font-mono text-content-primary bg-background-tertiary px-1.5 py-0.5 rounded text-xs shrink-0">
                    {paramName}
                  </code>
                  <span className="text-content-tertiary text-xs shrink-0">{prop.type}</span>
                  {parameters?.required?.includes(paramName) && (
                    <span className="text-xs text-destructive shrink-0">required</span>
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

function CategorySection({
  category,
  tools,
  enabledToolNames,
}: {
  category: "entity" | "event" | "job" | "custom"
  tools: Array<{ name: string; def?: typeof BUILTIN_TOOL_DEFINITIONS[string]; tool?: Tool }>
  enabledToolNames: Set<string>
}) {
  const info = CATEGORY_INFO[category]
  const Icon = info.icon
  const enabledCount = tools.filter((t) => enabledToolNames.has(t.name)).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", info.bgColor)}>
          <Icon className={cn("h-5 w-5", info.color)} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-content-primary">{info.label}</h3>
            <span className="text-xs text-content-tertiary">
              {enabledCount}/{tools.length} enabled
            </span>
          </div>
          <p className="text-xs text-content-secondary">{info.description}</p>
        </div>
      </div>
      <div className="space-y-2 pl-12">
        {tools.map((item) => (
          <ToolCard
            key={item.name}
            tool={item.tool || { name: item.name, description: item.def?.description || "", isBuiltin: true, parameters: item.def?.parameters }}
            isEnabled={enabledToolNames.has(item.name)}
            builtinDef={item.def}
            category={category}
          />
        ))}
      </div>
    </div>
  )
}

function EntityTypesPanel({ entityTypes }: { entityTypes: Array<{ _id: string; name: string; slug: string }> }) {
  if (entityTypes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Database className="h-8 w-8 mx-auto text-content-tertiary mb-2" />
        <p className="text-sm text-content-secondary mb-2">No entity types defined</p>
        <p className="text-xs text-content-tertiary">
          Entity types define the data structures your agent can interact with.
        </p>
        <Link
          href="/entities"
          className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:underline"
        >
          Create Entity Type
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-content-secondary">
          Your agent can perform CRUD operations on these entity types:
        </p>
        <Link
          href="/entities"
          className="inline-flex items-center gap-1.5 text-xs text-content-secondary hover:text-content-primary transition-colors"
        >
          Manage Types
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {entityTypes.map((type) => (
          <Link
            key={type._id}
            href={`/entities/${type.slug}`}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-background-secondary transition-colors cursor-pointer group"
          >
            <div className="p-2 rounded-md bg-blue-500/10">
              <Database className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-content-primary truncate group-hover:text-primary transition-colors">
                {type.name}
              </div>
              <div className="font-mono text-xs text-content-tertiary truncate">{type.slug}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-content-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  )
}

function PermissionsInfo() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <Shield className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-content-primary">Permission-Aware Execution</h4>
          <p className="mt-1 text-xs text-content-secondary">
            All tool executions respect your RBAC configuration. Agents execute with their assigned
            role, and scope rules + field masks are automatically applied.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs cursor-help">
                    Scope Rules
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Row-level security that filters which records the agent can access
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs cursor-help">
                    Field Masks
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Column-level security that hides sensitive fields from agent responses
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs cursor-help">
                    Audit Trail
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    All entity operations emit events with actor context for compliance
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:underline"
          >
            Configure Roles & Permissions
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AgentFunctionsPage({ params }: AgentFunctionsPageProps) {
  const { agentId } = params
  const agent = useAgentWithConfig(agentId as Id<"agents">)
  const entityTypes = useEntityTypes()
  const { environment } = useEnvironment()

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

  const jobTools = Object.entries(BUILTIN_TOOL_DEFINITIONS)
    .filter(([_, def]) => def.category === "job")
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
  const totalBuiltinEnabled = configuredTools.filter((t: Tool) => t.isBuiltin).length

  if (!config) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-content-primary">Tools</h2>
          <p className="text-sm text-content-secondary mt-0.5">
            Functions available to your agent
          </p>
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
            {totalEnabled} enabled ({totalBuiltinEnabled} built-in, {customTools.length} custom)
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

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Tools</TabsTrigger>
          <TabsTrigger value="entities">Entity Types</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-8">
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
          <CategorySection
            category="job"
            tools={jobTools}
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
          <PermissionsInfo />
        </TabsContent>
      </Tabs>
    </div>
  )
}
