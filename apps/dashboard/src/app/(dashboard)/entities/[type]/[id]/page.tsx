import Link from "next/link"
import { ChevronLeft, Edit, Trash2, Link2, Clock } from "lucide-react"
import { api, Entity, EntityType, EntityRelation, EntityEvent } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { EntityDetail } from "@/components/entities/entity-detail"
import { EntityTimeline } from "@/components/entities/entity-timeline"

interface EntityDetailPageProps {
  params: Promise<{ type: string; id: string }>
}

export default async function EntityDetailPage({ params }: EntityDetailPageProps) {
  const { type, id } = await params
  const token = await getAuthToken()

  let entity: Entity | null = null
  let entityType: EntityType | null = null
  let outgoingRelations: EntityRelation[] = []
  let incomingRelations: EntityRelation[] = []
  let events: EntityEvent[] = []
  let error: string | null = null

  try {
    const [entityRes, relationsRes, eventsRes] = await Promise.all([
      api.entities.get(token!, id),
      api.entities.relations(token!, id).catch(() => ({ outgoing: [], incoming: [] })),
      api.entities.events(token!, id).catch(() => ({ events: [] })),
    ])

    entity = entityRes.entity
    entityType = entityRes.entityType
    outgoingRelations = relationsRes.outgoing
    incomingRelations = relationsRes.incoming
    events = eventsRes.events
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load entity"
  }

  if (error || !entity || !entityType) {
    return (
      <div className="space-y-6">
        <Link href={`/entities/${type}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to {type}
        </Link>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{error || "Entity not found"}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalRelations = outgoingRelations.length + incomingRelations.length

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
          <Button variant="destructive">
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
          <EntityDetail entityType={entityType} entity={entity} />
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
                {outgoingRelations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Outgoing</h4>
                    <div className="space-y-2">
                      {outgoingRelations.map((rel) => (
                        <Link
                          key={rel.id}
                          href={`/entities/${rel.toEntity?.entityTypeSlug || type}/${rel.toEntityId}`}
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
                  </div>
                )}
                {incomingRelations.length > 0 && (
                  <div>
                    {outgoingRelations.length > 0 && <Separator className="my-4" />}
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Incoming</h4>
                    <div className="space-y-2">
                      {incomingRelations.map((rel) => (
                        <Link
                          key={rel.id}
                          href={`/entities/${rel.fromEntity?.entityTypeSlug || type}/${rel.fromEntityId}`}
                          className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{rel.relationType}</Badge>
                            <span className="text-sm">{rel.fromEntityId}</span>
                          </div>
                          <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                        </Link>
                      ))}
                    </div>
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
            <EntityTimeline events={events} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
