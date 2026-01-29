import Link from "next/link"
import { Database, Layers, ChevronRight } from "lucide-react"
import { api, EntityType } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function EntityTypesPage() {
  const token = await getAuthToken()

  let entityTypes: EntityType[] = []
  let error: string | null = null

  try {
    const data = await api.entityTypes.list(token!)
    entityTypes = data.entityTypes
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load entity types"
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Entity Types</h2>
        <p className="text-muted-foreground">Browse and manage your organization&apos;s entity types</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : entityTypes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">No entity types yet</h3>
            <p className="mt-1 text-muted-foreground">
              Entity types will appear here once they are created
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entityTypes.map((entityType) => (
            <Link key={entityType.id} href={`/entities/${entityType.slug}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Layers className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{entityType.name}</CardTitle>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Slug:</span>
                      <Badge variant="outline" className="font-mono">
                        {entityType.slug}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{entityType.schema.fields.length} fields</span>
                    {entityType.entityCount !== undefined && (
                      <span>{entityType.entityCount} entities</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
