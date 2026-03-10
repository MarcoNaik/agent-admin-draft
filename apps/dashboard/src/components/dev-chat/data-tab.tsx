"use client"

import { useState } from "react"
import {
  LayoutList,
  LayoutGrid,
  Database,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from "@/lib/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatDate } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import { useEntityTypes, useEntities } from "@/hooks/use-entities"
import { useRoleContext } from "@/contexts/role-context"
import { useAnimateNew, idKeyFn } from "@/hooks/use-animate-new"

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
      <Badge variant={value ? "success" : "secondary"} className="text-[10px] px-1.5 py-0 h-4">
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
          {expanded ? "Less" : "More"}
        </button>
      </div>
    )
  }

  if (Array.isArray(value)) {
    if (compact) {
      return (
        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
          {value.length}
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
          <Badge variant="secondary" className="text-[10px] cursor-pointer px-1 py-0 h-4">
            {value.length} items
          </Badge>
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-content-tertiary" />
          ) : (
            <ChevronRight className="h-3 w-3 text-content-tertiary" />
          )}
        </button>
        {expanded && (
          <div className="mt-1 space-y-0.5 pl-2 border-l border-border">
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
      <div className="space-y-0.5">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="flex gap-1.5 items-baseline">
            <span className="text-[10px] text-content-tertiary shrink-0">
              {formatFieldName(k)}:
            </span>
            <div className="min-w-0">
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
  const { isAdmin } = useRoleContext()
  const entities = useEntities(entityType.slug, "development")
  const newEntityKeys = useAnimateNew(entities, idKeyFn)
  const fields = getSchemaFields(entityType.schema)
  const fieldTypeMap = new Map(fields.map((f) => [f.name, f.type]))

  const listFields = isAdmin
    ? fields.map((f) => f.name)
    : (entityType.displayConfig?.listFields ?? fields.slice(0, 3).map((f) => f.name))

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
                  className="px-2 py-1.5 text-left text-[10px] font-medium text-content-tertiary uppercase tracking-wider sticky top-0 bg-background-secondary"
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
                className={cn(
                  "border-b last:border-b-0 hover:bg-background transition-colors ease-out-soft",
                  newEntityKeys.has(entity._id) && "animate-highlight-new"
                )}
              >
                {listFields.map((field) => (
                  <td key={field} className="px-2 py-1 max-w-[120px]">
                    <FieldRenderer
                      value={entity.data?.[field]}
                      schemaType={fieldTypeMap.get(field)}
                      compact
                    />
                  </td>
                ))}
                <td className="px-2 py-1">
                  {entity.status ? (
                    <Badge
                      variant={getStatusVariant(entity.status)}
                      className="text-[10px] px-1 py-0 h-4"
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
    <div className="divide-y">
      {entities.map((entity: any) => {
        const displayName =
          entity.data?.name ??
          entity.data?.title ??
          entity.data?.email ??
          entity._id
        return (
          <div key={entity._id} className={cn("px-3 py-2", newEntityKeys.has(entity._id) && "animate-highlight-new")}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-medium truncate">
                {String(displayName)}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {entity.status && (
                  <Badge
                    variant={getStatusVariant(entity.status)}
                    className="text-[10px] px-1 py-0 h-4"
                  >
                    {entity.status}
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {fields.map((field) => {
                const val = entity.data?.[field.name]
                if (val === null || val === undefined) return null
                return (
                  <div key={field.name} className="min-w-0">
                    <div className="text-[10px] text-content-tertiary truncate">
                      {formatFieldName(field.name)}
                    </div>
                    <div className="truncate">
                      <FieldRenderer
                        value={val}
                        schemaType={field.type}
                        compact
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DataTab() {
  const entityTypes = useEntityTypes("development")
  const [view, setView] = useState<"table" | "card">("table")
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

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

  const activeSlug = selectedSlug ?? entityTypes[0]?.slug
  const activeType = entityTypes.find((et: any) => et.slug === activeSlug)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b shrink-0">
        <Select value={activeSlug} onValueChange={setSelectedSlug}>
          <SelectTrigger className="h-9 text-xs flex-1 min-w-0 border-0 rounded-none shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {entityTypes.map((et: any) => (
              <SelectItem key={et._id} value={et.slug} className="text-xs">
                {et.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center shrink-0 border-l">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("table")}
            className={cn(
              "h-9 w-9 rounded-none",
              view === "table" && "bg-background text-content-primary",
              view !== "table" && "text-content-tertiary"
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("card")}
            className={cn(
              "h-9 w-9 rounded-none",
              view === "card" && "bg-background text-content-primary",
              view !== "card" && "text-content-tertiary"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeType && <EntityContent entityType={activeType} view={view} />}
      </div>
    </div>
  )
}
