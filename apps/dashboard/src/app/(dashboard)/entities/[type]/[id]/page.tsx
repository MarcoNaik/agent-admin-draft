"use client"

import Link from "next/link"
import { ChevronLeft, Edit, Trash2, Link2, Clock, Loader2 } from "lucide-react"
import { useEntityWithType, useRelatedEntities, useEntityEvents, useDeleteEntity } from "@/hooks/use-convex-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { EntityDetail } from "@/components/entities/entity-detail"
import { EntityTimeline } from "@/components/entities/entity-timeline"
import { Id } from "@convex/_generated/dataModel"
import { useRouter } from "next/navigation"

interface EntityDetailPageProps {
  params: { type: string; id: string }
}

export default function EntityDetailPage({ params }: EntityDetailPageProps) {
  const { type, id } = params
  const router = useRouter()

  const entityData = useEntityWithType(id as Id<"entities">)
  const relatedEntities = useRelatedEntities(id as Id<"entities">)
  const events = useEntityEvents(id as Id<"entities">)
  const deleteEntity = useDeleteEntity()

  if (entityData === undefined || events === undefined) {
    return (
      <div className="space-y-6">
        <Link href={`/entities/${type}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to {type}
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
  }

  const mappedEntity = {
    id: entity._id,
    status: entity.status,
    data: entity.data,
    createdAt: new Date(entity.createdAt).toISOString(),
    updatedAt: new Date(entity.updatedAt).toISOString(),
  }

  const mappedEvents = events.map((e) => ({
    id: e._id,
    eventType: e.eventType,
    actorType: e.actorType,
    actorId: e.actorId,
    payload: e.payload,
    timestamp: new Date(e.timestamp).toISOString(),
  }))

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this entity? This action cannot be undone.")) {
      return
    }
    await deleteEntity({ id: entity._id })
    router.push(`/entities/${type}`)
  }

  const totalRelations = relatedEntities?.length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/entities/${type}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to {entityType.name}
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/entities/${type}/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{entityType.name} Details</CardTitle>
          <CardDescription>View and manage this {entityType.name.toLowerCase()}</CardDescription>
        </CardHeader>
        <CardContent>
          <EntityDetail entityType={mappedEntityType} entity={mappedEntity} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Relations ({totalRelations})
            </CardTitle>
            <CardDescription>Connected entities</CardDescription>
          </CardHeader>
          <CardContent>
            {totalRelations === 0 ? (
              <div className="py-8 text-center">
                <Link2 className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No relations</p>
              </div>
            ) : (
              <div className="space-y-4">
                {relatedEntities && relatedEntities.length > 0 && (
                  <div className="space-y-2">
                    {relatedEntities.map((rel) => (
                      <Link
                        key={rel._id}
                        href={`/entities/${type}/${rel.toEntityId}`}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{rel.relationType}</Badge>
                          <span className="text-sm">{rel.toEntityId}</span>
                        </div>
                        <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timeline ({events.length})
            </CardTitle>
            <CardDescription>Recent events</CardDescription>
          </CardHeader>
          <CardContent>
            <EntityTimeline events={mappedEvents} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
