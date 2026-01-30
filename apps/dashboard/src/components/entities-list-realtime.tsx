"use client"

import { useEntities, useEntityTypeBySlug, useCreateEntity, useDeleteEntity, useSearchEntities } from "@/hooks/use-convex-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, Trash2, Search, FileText } from "lucide-react"
import Link from "next/link"
import { useState, useMemo } from "react"

interface EntitiesListRealtimeProps {
  entityTypeSlug: string
}

export function EntitiesListRealtime({ entityTypeSlug }: EntitiesListRealtimeProps) {
  const entityType = useEntityTypeBySlug(entityTypeSlug)
  const entities = useEntities(entityTypeSlug)
  const createEntity = useCreateEntity()
  const deleteEntity = useDeleteEntity()

  const [searchQuery, setSearchQuery] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const searchResults = useSearchEntities(
    entityTypeSlug,
    searchQuery.length >= 2 ? searchQuery : ""
  )

  const displayedEntities = useMemo(() => {
    if (searchQuery.length >= 2 && searchResults !== undefined) {
      return searchResults
    }
    return entities ?? []
  }, [searchQuery, searchResults, entities])

  const handleCreate = async () => {
    if (!entityType) return
    setIsCreating(true)
    try {
      await createEntity({
        entityTypeSlug,
        data: {},
        status: "active"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entity?")) return
    await deleteEntity({ id: id as any })
  }

  const getDisplayTitle = (entity: any) => {
    if (!entityType?.displayConfig?.titleField) {
      return entity._id
    }

    const titleField = entityType.displayConfig.titleField
    if (Array.isArray(titleField)) {
      return titleField.map(f => entity.data[f]).filter(Boolean).join(" ")
    }
    return entity.data[titleField] || entity._id
  }

  const getDisplaySubtitle = (entity: any) => {
    if (!entityType?.displayConfig?.subtitleField) {
      return null
    }
    return entity.data[entityType.displayConfig.subtitleField]
  }

  if (entities === undefined || entityType === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (entityType === null) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Entity type "{entityTypeSlug}" not found.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${entityType.name}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate} disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create {entityType.name}
        </Button>
      </div>

      {displayedEntities.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? `No ${entityType.name} found matching "${searchQuery}"` : `No ${entityType.name} yet.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium">Title</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Created</th>
                <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayedEntities.map((entity) => (
                <tr key={entity._id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <Link
                        href={`/entities/${entityTypeSlug}/${entity._id}`}
                        className="font-medium hover:underline"
                      >
                        {getDisplayTitle(entity)}
                      </Link>
                      {getDisplaySubtitle(entity) && (
                        <p className="text-sm text-muted-foreground">{getDisplaySubtitle(entity)}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        entity.status === "active"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-gray-500/10 text-gray-500"
                      }`}
                    >
                      {entity.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(entity.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(entity._id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
