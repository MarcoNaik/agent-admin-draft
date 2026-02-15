"use client"

import { Loader2 } from "lucide-react"
import { useEntityTypeBySlug, useCreateEntity } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { EntityForm } from "./entity-form"
import { Id } from "@convex/_generated/dataModel"

interface EntityCreateFormProps {
  entityTypeSlug: string
  onSuccess: (entityId: Id<"entities">) => void
}

export function EntityCreateForm({ entityTypeSlug, onSuccess }: EntityCreateFormProps) {
  const { environment } = useEnvironment()
  const entityType = useEntityTypeBySlug(entityTypeSlug, environment)
  const createEntity = useCreateEntity()

  if (entityType === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!entityType) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Entity type not found
      </div>
    )
  }

  const mappedEntityType = {
    id: entityType._id,
    name: entityType.name,
    slug: entityType.slug,
    schema: entityType.schema,
    displayConfig: entityType.displayConfig,
    boundToRole: entityType.boundToRole,
    userIdField: entityType.userIdField,
  }

  const handleSubmit = async (data: Record<string, unknown>) => {
    const entityId = await createEntity({
      entityTypeSlug,
      data,
    })
    onSuccess(entityId)
  }

  return (
    <EntityForm
      entityType={mappedEntityType}
      onSubmit={handleSubmit}
    />
  )
}
