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

function formatSimpleValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function FieldValue({ value }: { value: unknown }): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="break-all">{String(value)}</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground italic">empty</span>
    const allPrimitives = value.every((v) => typeof v !== "object" || v === null)
    if (allPrimitives) {
      return <span className="break-all">{value.map((v) => formatSimpleValue(v)).join(", ")}</span>
    }
    return (
      <div className="space-y-1 mt-0.5">
        {value.map((item, i) => (
          <div key={i} className="rounded bg-black/10 px-2 py-1 space-y-0.5">
            {typeof item === "object" && item !== null ? (
              Object.entries(item).map(([k, v]) => (
                <div key={k} className="flex gap-1.5">
                  <span className="font-mono text-muted-foreground shrink-0">{k}:</span>
                  <span className="break-all">{formatSimpleValue(v)}</span>
                </div>
              ))
            ) : (
              <span>{formatSimpleValue(item)}</span>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === "object") {
    return (
      <div className="space-y-0.5 mt-0.5">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="flex gap-1.5">
            <span className="font-mono text-muted-foreground shrink-0">{k}:</span>
            <span className="break-all">{formatSimpleValue(v)}</span>
          </div>
        ))}
      </div>
    )
  }

  return <span>{formatSimpleValue(value)}</span>
}

function ObjectCard({ data }: { data: Record<string, unknown> }): React.ReactNode {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined && v !== null)
  return (
    <div className="rounded border border-border/50 bg-black/10 p-2.5 space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="text-xs">
          <div className="flex gap-2">
            <span className="font-mono text-muted-foreground shrink-0">{key}:</span>
            {(typeof value !== "object" || value === null || (Array.isArray(value) && value.every((v) => typeof v !== "object" || v === null))) && (
              <FieldValue value={value} />
            )}
          </div>
          {typeof value === "object" && value !== null && !(Array.isArray(value) && value.every((v) => typeof v !== "object" || v === null)) && (
            <div className="ml-3 mt-0.5">
              <FieldValue value={value} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function formatFieldValue(value: unknown, field?: EntityTypeField): React.ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>

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
          <a href={`mailto:${value}`} className="text-ocean hover:underline">
            {String(value)}
          </a>
        )
      case "phone":
        return (
          <a href={`tel:${value}`} className="text-ocean hover:underline">
            {String(value)}
          </a>
        )
    }
  }

  if (typeof value !== "object") return <span className="break-all">{String(value)}</span>

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground italic text-xs">empty</span>
    const allObjects = value.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))
    if (allObjects) {
      return (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {value.map((item: Record<string, unknown>, i: number) => (
            <ObjectCard key={i} data={item} />
          ))}
        </div>
      )
    }
    return <FieldValue value={value} />
  }

  return <ObjectCard data={value as Record<string, unknown>} />
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
