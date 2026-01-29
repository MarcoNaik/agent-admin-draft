"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { Search, Filter, ChevronLeft, ChevronRight, Plus, Layers } from "lucide-react"
import { api, Entity, EntityType, EntityQueryParams } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EntityTable } from "@/components/entities/entity-table"

interface EntityListPageProps {
  params: Promise<{ type: string }>
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending", label: "Pending" },
  { value: "scheduled", label: "Scheduled" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "failed", label: "Failed" },
]

export default function EntityListPage({ params }: EntityListPageProps) {
  const router = useRouter()
  const { getToken } = useAuth()
  const [typeSlug, setTypeSlug] = useState<string | null>(null)
  const [entityType, setEntityType] = useState<EntityType | null>(null)
  const [entities, setEntities] = useState<Entity[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const pageSize = 25

  useEffect(() => {
    params.then((p) => setTypeSlug(p.type))
  }, [params])

  const fetchData = useCallback(async () => {
    if (!typeSlug) return

    setLoading(true)
    setError(null)

    try {
      const token = await getToken()

      if (!token) {
        throw new Error("Not authenticated")
      }

      const [entityTypeRes, entitiesRes] = await Promise.all([
        api.entityTypes.get(token, typeSlug),
        api.entities.list(token, typeSlug, {
          status: status !== "all" ? status : undefined,
          searchText: search || undefined,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        } as EntityQueryParams),
      ])

      setEntityType(entityTypeRes.entityType)
      setEntities(entitiesRes.entities)
      setTotal(entitiesRes.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [typeSlug, status, search, page, getToken])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalPages = Math.ceil(total / pageSize)

  if (!typeSlug) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6" />
            {entityType?.name || typeSlug}
          </h2>
          <p className="text-muted-foreground">
            Manage {entityType?.name?.toLowerCase() || typeSlug} entities
          </p>
        </div>
        <Button onClick={() => router.push(`/entities/${typeSlug}/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          Create {entityType?.name || "Entity"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">
              {total} {total === 1 ? "entity" : "entities"}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="pl-8 w-[200px]"
                />
              </div>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchData}>
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : entityType ? (
            <>
              <EntityTable
                entityType={entityType}
                entities={entities}
                onRowClick={(entity) => router.push(`/entities/${typeSlug}/${entity.id}`)}
              />
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
