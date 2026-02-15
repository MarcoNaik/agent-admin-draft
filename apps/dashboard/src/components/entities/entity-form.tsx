"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUsers } from "@/hooks/use-convex-data"

interface EntityTypeField {
  name: string
  type: string
  required?: boolean
  description?: string
  enum?: string[]
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
  boundToRole?: string
  userIdField?: string
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
  const schemaObj = schema as {
    properties?: Record<string, {
      type?: string
      description?: string
      enum?: string[]
    }>
    required?: string[]
  }
  if (!schemaObj.properties) return []
  const required = schemaObj.required || []
  return Object.entries(schemaObj.properties).map(([name, prop]) => ({
    name,
    type: prop?.type || "string",
    description: prop?.description,
    enum: prop?.enum,
    required: required.includes(name),
  }))
}

interface EntityFormProps {
  entityType: EntityType
  entity?: Entity
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  onCancel?: () => void
}

function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
}

function UserPickerField({
  value,
  onChange,
  fieldName,
}: {
  value: unknown
  onChange: (value: unknown) => void
  fieldName: string
}) {
  const users = useUsers()

  if (users === undefined) {
    return <Input type="text" value="" disabled placeholder="Loading users..." />
  }

  return (
    <Select
      value={value as string || ""}
      onValueChange={(v) => onChange(v)}
    >
      <SelectTrigger>
        <SelectValue placeholder={`Select user for ${formatFieldName(fieldName)}`} />
      </SelectTrigger>
      <SelectContent>
        {users.map((user: { _id: string; name?: string; email: string }) => (
          <SelectItem key={user._id} value={user._id}>
            {user.name || user.email} ({user.email})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function FieldInput({
  field,
  value,
  onChange,
  entityType,
}: {
  field: EntityTypeField
  value: unknown
  onChange: (value: unknown) => void
  entityType?: EntityType
}) {
  if (entityType?.boundToRole && field.name === (entityType.userIdField || "userId")) {
    return <UserPickerField value={value} onChange={onChange} fieldName={field.name} />
  }

  switch (field.type) {
    case "enum":
      return (
        <Select
          value={value as string || ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${formatFieldName(field.name)}`} />
          </SelectTrigger>
          <SelectContent>
            {field.enum?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case "boolean":
      return (
        <Select
          value={value === true ? "true" : value === false ? "false" : ""}
          onValueChange={(v) => onChange(v === "true")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      )

    case "number":
    case "currency":
      return (
        <Input
          type="number"
          step={field.type === "currency" ? "0.01" : "1"}
          value={value as number ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder={field.description || `Enter ${formatFieldName(field.name)}`}
        />
      )

    case "date":
      return (
        <Input
          type="date"
          value={value ? String(value).split("T")[0] : ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )

    case "datetime":
      return (
        <Input
          type="datetime-local"
          value={value ? String(value).slice(0, 16) : ""}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      )

    case "email":
      return (
        <Input
          type="email"
          value={value as string ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={field.description || "email@example.com"}
        />
      )

    case "phone":
      return (
        <Input
          type="tel"
          value={value as string ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={field.description || "+1 (555) 123-4567"}
        />
      )

    case "json":
      return (
        <Textarea
          value={typeof value === "object" ? JSON.stringify(value, null, 2) : value as string ?? ""}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value))
            } catch {
              onChange(e.target.value)
            }
          }}
          placeholder="{}"
          className="font-mono text-sm"
          rows={4}
        />
      )

    case "text":
    default:
      return (
        <Input
          type="text"
          value={value as string ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={field.description || `Enter ${formatFieldName(field.name)}`}
        />
      )
  }
}

export function EntityForm({ entityType, entity, onSubmit, onCancel }: EntityFormProps) {
  const schemaFields = getSchemaFields(entityType.schema)
  const [formData, setFormData] = useState<Record<string, unknown>>(
    entity?.data || {}
  )
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleFieldChange = (fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
    if (errors[fieldName]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[fieldName]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    for (const field of schemaFields) {
      if (field.required) {
        const value = formData[field.name]
        if (value === null || value === undefined || value === "") {
          newErrors[field.name] = `${formatFieldName(field.name)} is required`
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)
    try {
      await onSubmit(formData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {schemaFields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {formatFieldName(field.name)}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <FieldInput
              field={field}
              value={formData[field.name]}
              onChange={(value) => handleFieldChange(field.name, value)}
              entityType={entityType}
            />
            {errors[field.name] && (
              <p className="text-sm text-destructive">{errors[field.name]}</p>
            )}
            {field.description && !errors[field.name] && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : entity ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  )
}
