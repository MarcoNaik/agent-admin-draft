"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Loader2 } from "lucide-react"
import { useEntityWithType, useUpdateEntity } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EntityForm } from "@/components/entities/entity-form"
import { Id } from "@convex/_generated/dataModel"

interface EntityEditPageProps {
  params: { type: string; id: string }
}

export default function EntityEditPage({ params }: EntityEditPageProps) {
  const { type, id } = params
  const router = useRouter()
  const { environment } = useEnvironment()

  const entityData = useEntityWithType(id as Id<"entities">, environment)
  const updateEntity = useUpdateEntity()

  if (entityData === undefined) {
    return (
      <div className="space-y-6">
        <Link href={`/entities/${type}/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to details
        </Link>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  if (!entityData) {
    return (
      <div className="space-y-6">
        <Link href={`/entities/${type}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to {type}
        </Link>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Entity not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { entity, entityType } = entityData

  if (!entity || !entityType) {
    return (
      <div className="space-y-6">
        <Link href={`/entities/${type}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to {type}
        </Link>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Entity or entity type not found</p>
          </CardContent>
        </Card>
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

  const mappedEntity = {
    id: entity._id,
    status: entity.status || "active",
    data: entity.data || {},
    createdAt: entity.createdAt ? new Date(entity.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: entity.updatedAt ? new Date(entity.updatedAt).toISOString() : new Date().toISOString(),
  }

  const handleSubmit = async (data: Record<string, unknown>) => {
    await updateEntity({ id: entity._id, data })
    router.push(`/entities/${type}/${id}`)
  }

  return (
    <div className="space-y-6">
      <Link href={`/entities/${type}/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back to {entityType.name}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Edit {entityType.name}</CardTitle>
          <CardDescription>Update the {entityType.name.toLowerCase()} details</CardDescription>
        </CardHeader>
        <CardContent>
          <EntityForm
            entityType={mappedEntityType}
            entity={mappedEntity}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/entities/${type}/${id}`)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
