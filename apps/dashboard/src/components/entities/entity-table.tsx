"use client"

import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"

interface EntityTypeField {
  name: string
  type: string
  required?: boolean
}

interface EntityType {
  id: string
  name: string
  slug: string
  schema: unknown
  displayConfig?: {
    listFields?: string[]
    detailFields?: string[]
  }
}

interface Entity {
  id: string
  status: string
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

function getSchemaFields(schema: unknown): EntityTypeField[] {
  if (!schema || typeof schema !== "object") return []
  const schemaObj = schema as { properties?: Record<string, { type?: string }> }
  if (!schemaObj.properties) return []
  return Object.entries(schemaObj.properties).map(([name, prop]) => ({
    name,
    type: prop?.type || "string",
  }))
}

interface EntityTableProps {
  entityType: EntityType
  entities: Entity[]
  onRowClick?: (entity: Entity) => void
}

function formatSimpleValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function CellValue({ value, field }: { value: unknown; field?: EntityTypeField }): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>
  }

  if (field) {
    switch (field.type) {
      case "date":
      case "datetime":
        return formatDate(typeof value === "string" || value instanceof Date ? value : String(value))
      case "currency":
        return typeof value === "number"
          ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
          : String(value)
      case "boolean":
        return value ? "Yes" : "No"
      case "email":
      case "phone":
        return String(value)
      case "json":
        if (typeof value !== "object") return String(value)
    }
  }

  if (typeof value !== "object") return <span className="break-all">{String(value)}</span>

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground italic text-xs">empty</span>
    if (value.every((v) => typeof v !== "object" || v === null)) {
      return <span className="break-all">{value.map((v) => formatSimpleValue(v)).join(", ")}</span>
    }
    return <span className="text-muted-foreground text-xs">{value.length} items</span>
  }

  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return <span className="text-muted-foreground italic text-xs">empty</span>

  return (
    <div className="space-y-0.5">
      {entries.slice(0, 3).map(([k, v]) => (
        <div key={k} className="flex gap-1.5 text-xs">
          <span className="font-mono text-muted-foreground shrink-0">{k}:</span>
          <span className="break-all">{formatSimpleValue(v)}</span>
        </div>
      ))}
      {entries.length > 3 && (
        <span className="text-xs text-muted-foreground">+{entries.length - 3} more</span>
      )}
    </div>
  )
}

function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "success" | "warning" {
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

export function EntityTable({ entityType, entities, onRowClick }: EntityTableProps) {
  const router = useRouter()

  const schemaFields = getSchemaFields(entityType.schema)
  const columns =
    entityType.displayConfig?.listFields ||
    schemaFields.slice(0, 5).map((f) => f.name)

  const handleRowClick = (entity: Entity) => {
    if (onRowClick) {
      onRowClick(entity)
    } else {
      router.push(`/entities/${entityType.slug}/${entity.id}`)
    }
  }

  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No entities found</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                {formatFieldName(col)}
              </th>
            ))}
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Created</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((entity) => (
            <tr
              key={entity.id}
              onClick={() => handleRowClick(entity)}
              className="border-b cursor-pointer hover:bg-muted/50 transition-colors"
            >
              {columns.map((col) => {
                const field = schemaFields.find((f) => f.name === col)
                return (
                  <td key={col} className="px-4 py-3 text-sm">
                    <CellValue value={entity.data?.[col]} field={field} />
                  </td>
                )
              })}
              <td className="px-4 py-3">
                <Badge variant={getStatusVariant(entity.status)}>
                  {entity.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {formatDate(entity.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
