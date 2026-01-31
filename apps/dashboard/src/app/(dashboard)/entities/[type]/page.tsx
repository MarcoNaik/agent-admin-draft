"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Filter, Plus, Layers, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { useEntityTypeBySlug, useEntities } from "@/hooks/use-convex-data"
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{typeSlug}</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!entityType) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{typeSlug}</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Layers className="mb-4 h-10 w-10 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">Entity type not found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            &quot;{typeSlug}&quot; does not exist in your organization
          </p>
        </div>
      </div>
    )
  }

  const filteredEntities = search
    ? entities.filter((e: Doc<"entities">) => JSON.stringify(e.data).toLowerCase().includes(search.toLowerCase()))
    : entities

  const mappedEntityType = {
    id: entityType._id,
    name: entityType.name,
    slug: entityType.slug,
    schema: entityType.schema,
    displayConfig: entityType.displayConfig,
  }

  const mappedEntities = filteredEntities.map((e: Doc<"entities">) => ({
    id: e._id,
    status: e.status || "active",
    data: e.data || {},
    createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: e.updatedAt ? new Date(e.updatedAt).toISOString() : new Date().toISOString(),
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{entityType.name}</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button variant="ghost" size="sm" className="h-8 px-2 rounded-r-none border-r">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 rounded-l-none">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[130px] text-sm">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
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
          <Button
            size="sm"
            className="h-8"
            onClick={() => router.push(`/entities/${typeSlug}/new`)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/30 border-b px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {filteredEntities.length} {filteredEntities.length === 1 ? "document" : "documents"}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-8 w-[180px] text-sm"
            />
          </div>
        </div>
        <EntityTable
          entityType={mappedEntityType}
          entities={mappedEntities}
          onRowClick={(entity) => router.push(`/entities/${typeSlug}/${entity.id}`)}
        />
      </div>
    </div>
  )
}
