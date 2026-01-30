"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Filter, ChevronLeft, ChevronRight, Plus, Layers, Loader2 } from "lucide-react"
import { useEntityTypeBySlug, useEntities } from "@/hooks/use-convex-data"
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
import { Doc } from "@convex/_generated/dataModel"

interface EntityListPageProps {
  params: { type: string }
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
  const { type: typeSlug } = params
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")

  const entityType = useEntityTypeBySlug(typeSlug)
  const entities = useEntities(typeSlug, status !== "all" ? status : undefined)

  if (entityType === undefined || entities === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6" />
              {typeSlug}
            </h2>
            <p className="text-muted-foreground">
              Loading...
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  if (!entityType) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6" />
              {typeSlug}
            </h2>
            <p className="text-muted-foreground">
              Entity type not found
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">Entity type &quot;{typeSlug}&quot; not found</h3>
            <p className="mt-1 text-muted-foreground">
              This entity type does not exist in your organization
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const filteredEntities = search
    ? entities.filter((e: Doc<"entities">) => JSON.stringify(e.data).toLowerCase().includes(search.toLowerCase()))
    : entities

  const mappedEntityType = entityType ? {
    id: entityType._id,
    name: entityType.name,
    slug: entityType.slug,
    schema: entityType.schema,
    displayConfig: entityType.displayConfig,
  } : null

  const mappedEntities = filteredEntities.map((e: Doc<"entities">) => ({
    id: e._id,
    status: e.status,
    data: e.data,
    createdAt: new Date(e.createdAt).toISOString(),
    updatedAt: new Date(e.updatedAt).toISOString(),
  }))

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
              {filteredEntities.length} {filteredEntities.length === 1 ? "entity" : "entities"}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-[200px]"
                />
              </div>
              <Select
                value={status}
                onValueChange={setStatus}
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
          {mappedEntityType ? (
            <EntityTable
              entityType={mappedEntityType}
              entities={mappedEntities}
              onRowClick={(entity) => router.push(`/entities/${typeSlug}/${entity.id}`)}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
