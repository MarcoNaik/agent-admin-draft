"use client"

import { useState } from "react"
import {
  LayoutList,
  LayoutGrid,
  Database,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn, formatDate } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import { useEntityTypes, useEntities } from "@/hooks/use-entities"

function getSchemaFields(
  schema: unknown
): { name: string; type: string }[] {
  if (!schema || typeof schema !== "object") return []
  const schemaObj = schema as {
    properties?: Record<string, { type?: string }>
  }
  if (!schemaObj.properties) return []
  return Object.entries(schemaObj.properties).map(([name, prop]) => ({
    name,
    type: prop?.type || "string",
  }))
}

function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
}

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "success" | "warning" {
  switch (status.toLowerCase()) {
    case "active":
    case "completed":
    case "confirmed":
      return "success"
    case "pending":
    case "scheduled":
      return "warning"
    case "inactive":
    case "cancelled":
    case "failed":
    case "dead":
      return "destructive"
    default:
      return "secondary"
  }
}

function formatCurrency(value: unknown): string {
  const num = typeof value === "number" ? value : Number(value)
  if (isNaN(num)) return String(value)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num)
}

function FieldRenderer({
  value,
  schemaType,
  compact = false,
}: {
  value: unknown
  schemaType?: string
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  if (value === null || value === undefined) {
    return <span className="text-content-tertiary">&mdash;</span>
  }

  if (typeof value === "boolean") {
    return (
      <Badge variant={value ? "success" : "secondary"}>
        {value ? "Yes" : "No"}
      </Badge>
    )
  }

  if (schemaType === "date" || schemaType === "datetime") {
    return <span className="text-xs">{formatDate(String(value))}</span>
  }

  if (schemaType === "currency") {
    return <span className="text-xs font-medium">{formatCurrency(value)}</span>
  }

  if (schemaType === "email" && typeof value === "string") {
    return (
      <a
        href={`mailto:${value}`}
        className="text-xs text-ocean hover:underline"
      >
        {value}
      </a>
    )
  }

  if (schemaType === "phone" && typeof value === "string") {
    return (
      <a href={`tel:${value}`} className="text-xs text-ocean hover:underline">
        {value}
      </a>
    )
  }

  if (
    typeof value === "string" &&
    (value.startsWith("http://") || value.startsWith("https://"))
  ) {
    const display =
      value.length > 35 ? value.slice(0, 35) + "..." : value
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-ocean hover:underline"
      >
        {display}
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    )
  }

  if (typeof value === "string" && value.length > 100) {
    return (
      <div>
        <span className="text-xs">
          {expanded ? value : value.slice(0, 100) + "..."}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="ml-1 text-[11px] text-ocean hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      </div>
    )
  }

  if (Array.isArray(value)) {
    if (compact) {
      return (
        <Badge variant="secondary" className="text-[10px]">
          {value.length} items
        </Badge>
      )
    }
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1"
        >
          <Badge variant="secondary" className="text-[10px] cursor-pointer">
            {value.length} items
          </Badge>
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-content-tertiary" />
          ) : (
            <ChevronRight className="h-3 w-3 text-content-tertiary" />
          )}
        </button>
        {expanded && (
          <div className="mt-1 space-y-1 pl-2 border-l border-border">
            {value.map((item, i) => (
              <div key={i} className="text-xs">
                <FieldRenderer value={item} compact />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (typeof value === "object" && value !== null) {
    if (compact) {
      const keys = Object.keys(value)
      return (
        <span className="text-xs text-content-secondary">
          {"{"}
          {keys.slice(0, 2).join(", ")}
          {keys.length > 2 ? `, +${keys.length - 2}` : ""}
          {"}"}
        </span>
      )
    }
    return (
      <div className="space-y-1">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k}>
            <span className="text-[11px] text-content-tertiary">
              {formatFieldName(k)}
            </span>
            <div className="ml-2">
              <FieldRenderer value={v} compact />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return <span className="text-xs">{String(value)}</span>
}

function EntityContent({
  entityType,
  view,
}: {
  entityType: {
    _id: string
    name: string
    slug: string
    schema: unknown
    displayConfig?: { listFields?: string[] }
  }
  view: "table" | "card"
}) {
  const entities = useEntities(entityType.slug, "development")
  const fields = getSchemaFields(entityType.schema)
  const fieldTypeMap = new Map(fields.map((f) => [f.name, f.type]))

  const listFields =
    entityType.displayConfig?.listFields ??
    fields.slice(0, 3).map((f) => f.name)

  if (!entities) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-xs text-content-tertiary">Loading...</p>
      </div>
    )
  }

  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <p className="text-xs text-content-secondary">No entities yet</p>
      </div>
    )
  }

  if (view === "table") {
    const columns = [...listFields, "status"]
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-2 py-1.5 text-left text-[11px] font-medium text-content-tertiary uppercase tracking-wider sticky top-0 bg-background"
                >
                  {formatFieldName(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entities.map((entity: any) => (
              <tr
                key={entity._id}
                className="border-b last:border-b-0 hover:bg-background-secondary transition-colors ease-out-soft"
              >
                {listFields.map((field) => (
                  <td key={field} className="px-2 py-1.5 max-w-[140px]">
                    <FieldRenderer
                      value={entity.data?.[field]}
                      schemaType={fieldTypeMap.get(field)}
                      compact
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  {entity.status ? (
                    <Badge
                      variant={getStatusVariant(entity.status)}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {entity.status}
                    </Badge>
                  ) : (
                    <span className="text-content-tertiary">&mdash;</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-2">
      {entities.map((entity: any) => {
        const displayName =
          entity.data?.name ??
          entity.data?.title ??
          entity.data?.email ??
          entity._id
        return (
          <div key={entity._id} className="border rounded p-3 bg-background">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium truncate max-w-[240px]">
                {String(displayName)}
              </span>
              {entity.status && (
                <Badge
                  variant={getStatusVariant(entity.status)}
                  className="text-[10px] px-1.5 py-0 shrink-0"
                >
                  {entity.status}
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              {fields.map((field) => (
                <div key={field.name}>
                  <div className="text-content-tertiary text-[11px] uppercase tracking-wider mb-0.5">
                    {formatFieldName(field.name)}
                  </div>
                  <FieldRenderer
                    value={entity.data?.[field.name]}
                    schemaType={field.type}
                  />
                </div>
              ))}
            </div>
            {entity._creationTime && (
              <div className="mt-2 pt-2 border-t text-[11px] text-content-tertiary">
                Created {formatRelativeTime(entity._creationTime)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function DataTab() {
  const entityTypes = useEntityTypes("development")
  const [view, setView] = useState<"table" | "card">("table")

  if (!entityTypes) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-content-tertiary">Loading...</p>
      </div>
    )
  }

  if (entityTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <Database className="h-8 w-8 text-content-tertiary mb-2" />
        <p className="text-sm text-content-secondary">
          No entity types defined
        </p>
      </div>
    )
  }

  return (
    <Tabs defaultValue={entityTypes[0]?.slug} className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b shrink-0">
        <TabsList className="flex-1 h-8 overflow-x-auto justify-start bg-transparent p-0 gap-1">
          {entityTypes.map((et: any) => (
            <TabsTrigger
              key={et._id}
              value={et.slug}
              className="h-7 px-2.5 text-xs rounded-full data-[state=active]:bg-ocean/10 data-[state=active]:text-ocean data-[state=active]:shadow-none shrink-0"
            >
              {et.name}
              <EntityCountBadge slug={et.slug} />
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex items-center shrink-0 border rounded-md">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("table")}
            className={cn(
              "h-7 w-7 rounded-r-none",
              view === "table" && "bg-background-secondary"
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("card")}
            className={cn(
              "h-7 w-7 rounded-l-none",
              view === "card" && "bg-background-secondary"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {entityTypes.map((et: any) => (
          <TabsContent key={et._id} value={et.slug} className="mt-0">
            <EntityContent entityType={et} view={view} />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}

function EntityCountBadge({ slug }: { slug: string }) {
  const entities = useEntities(slug, "development")
  if (!entities) return null
  return (
    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 min-w-[20px] justify-center">
      {entities.length}
    </Badge>
  )
}
