"use client"

import { useRouter } from "next/navigation"
import { Entity, EntityType, EntityTypeField, getSchemaFields } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"

interface EntityTableProps {
  entityType: EntityType
  entities: Entity[]
  onRowClick?: (entity: Entity) => void
}

function formatFieldValue(value: unknown, field?: EntityTypeField): string {
  if (value === null || value === undefined) return "-"

  if (field) {
    switch (field.type) {
      case "date":
      case "datetime":
        return formatDate(String(value))
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
        return typeof value === "object" ? JSON.stringify(value) : String(value)
      default:
        return String(value)
    }
  }

  if (typeof value === "object") {
    return JSON.stringify(value)
  }

  return String(value)
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
                    {formatFieldValue(entity.data[col], field)}
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
