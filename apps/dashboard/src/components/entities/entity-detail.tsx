"use client"

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
  deletedAt?: string
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

interface EntityDetailProps {
  entityType: EntityType
  entity: Entity
}

function formatFieldValue(value: unknown, field?: EntityTypeField): React.ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">-</span>

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
        return (
          <Badge variant={value ? "success" : "secondary"}>
            {value ? "Yes" : "No"}
          </Badge>
        )
      case "email":
        return (
          <a href={`mailto:${value}`} className="text-blue-500 hover:underline">
            {String(value)}
          </a>
        )
      case "phone":
        return (
          <a href={`tel:${value}`} className="text-blue-500 hover:underline">
            {String(value)}
          </a>
        )
      case "json":
        return (
          <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
            {JSON.stringify(value, null, 2)}
          </pre>
        )
      default:
        return String(value)
    }
  }

  if (typeof value === "object") {
    return (
      <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
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

export function EntityDetail({ entityType, entity }: EntityDetailProps) {
  const schemaFields = getSchemaFields(entityType.schema)
  const displayFields =
    entityType.displayConfig?.detailFields ||
    schemaFields.map((f) => f.name)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Badge variant={getStatusVariant(entity.status)} className="text-sm">
          {entity.status}
        </Badge>
        <span className="text-sm text-muted-foreground">ID: {entity.id}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {displayFields.map((fieldName) => {
          const field = schemaFields.find((f) => f.name === fieldName)
          const value = entity.data[fieldName]

          return (
            <div key={fieldName} className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">
                {formatFieldName(fieldName)}
                {field?.required && <span className="text-destructive ml-1">*</span>}
              </label>
              <div className="text-sm">{formatFieldValue(value, field)}</div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-8 text-sm text-muted-foreground border-t pt-4">
        <div>
          <span className="font-medium">Created:</span> {formatDate(entity.createdAt)}
        </div>
        <div>
          <span className="font-medium">Updated:</span> {formatDate(entity.updatedAt)}
        </div>
        {entity.deletedAt && (
          <div>
            <span className="font-medium">Deleted:</span> {formatDate(entity.deletedAt)}
          </div>
        )}
      </div>
    </div>
  )
}
