"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Filter, Plus, Layers, Loader2, ChevronLeft, ChevronRight, ClipboardCopy, Check, Shield } from "lucide-react"
import { useEntityTypeBySlug, useEntitiesPaginated, useSearchEntities } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
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
import { Badge } from "@/components/ui/badge"
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

const PAGE_SIZE = 25

export default function EntityListPage({ params }: EntityListPageProps) {
  const { type: typeSlug } = params
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [csvCopied, setCsvCopied] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const { environment } = useEnvironment()

  const entityType = useEntityTypeBySlug(typeSlug, environment)
  const { results: entities, status: paginationStatus, loadMore } = useEntitiesPaginated(
    typeSlug,
    environment,
    status !== "all" ? status : undefined
  )
  const searchResults = useSearchEntities(typeSlug, search.length >= 2 ? search : "", environment)

  const isLoadingMore = paginationStatus === "LoadingMore"
  const canLoadMore = paginationStatus === "CanLoadMore"

  useEffect(() => {
    if (canLoadMore) {
      loadMore(50)
    }
  }, [canLoadMore, loadMore])

  const sourceEntities = useMemo(() => {
    if (search.length >= 2 && searchResults) {
      if (status === "all") return searchResults as Doc<"entities">[]
      return (searchResults as Doc<"entities">[]).filter((e) => e.status === status)
    }
    return (entities ?? []) as Doc<"entities">[]
  }, [search, searchResults, entities, status])

  const sortedEntities = useMemo(() => {
    if (!sortField) return sourceEntities
    return [...sourceEntities].sort((a, b) => {
      let aVal: unknown
      let bVal: unknown

      if (sortField === "status") {
        aVal = a.status
        bVal = b.status
      } else if (sortField === "createdAt") {
        aVal = a.createdAt
        bVal = b.createdAt
      } else {
        aVal = a.data?.[sortField]
        bVal = b.data?.[sortField]
      }

      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      let cmp: number
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal
      } else {
        cmp = String(aVal).localeCompare(String(bVal))
      }

      return sortDirection === "asc" ? cmp : -cmp
    })
  }, [sourceEntities, sortField, sortDirection])

  const totalPages = Math.ceil(sortedEntities.length / PAGE_SIZE)

  const paginatedEntities = useMemo(() => {
    const start = currentPage * PAGE_SIZE
    return sortedEntities.slice(start, start + PAGE_SIZE)
  }, [sortedEntities, currentPage])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setCurrentPage(0)
  }, [])

  const handleStatusChange = useCallback((value: string) => {
    setStatus(value)
    setCurrentPage(0)
  }, [])

  const handleSort = useCallback((field: string) => {
    setCurrentPage(0)
    setSortField((prev) => {
      if (prev === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
        return field
      }
      setSortDirection("asc")
      return field
    })
  }, [])

  if (entityType === undefined) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold font-display">{typeSlug}</h1>
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
          <h1 className="text-xl font-semibold font-display">{typeSlug}</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Layers className="mb-4 h-10 w-10 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">Data type not found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            &quot;{typeSlug}&quot; does not exist in your organization
          </p>
        </div>
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

  const schemaProperties = (entityType.schema as { properties?: Record<string, unknown> })?.properties || {}
  const allSchemaFields = Object.keys(schemaProperties)

  const escapeCsvCell = (val: unknown): string => {
    if (val === null || val === undefined) return ""
    const str = typeof val === "object" ? JSON.stringify(val) : String(val)
    if (str.includes(",") || str.includes('"') || str.includes("\n"))
      return `"${str.replace(/"/g, '""')}"`
    return str
  }

  const handleCopyCsv = async () => {
    const columns = ["id", ...allSchemaFields, "status", "createdAt", "updatedAt"]
    const header = columns.join(",")
    const rows = sortedEntities.map((e: Doc<"entities">) => {
      const data = e.data || {}
      return columns
        .map((col) => {
          if (col === "id") return escapeCsvCell(e._id)
          if (col === "status") return escapeCsvCell(e.status || "active")
          if (col === "createdAt") return escapeCsvCell(e.createdAt ? new Date(e.createdAt).toISOString() : "")
          if (col === "updatedAt") return escapeCsvCell(e.updatedAt ? new Date(e.updatedAt).toISOString() : "")
          return escapeCsvCell(data[col])
        })
        .join(",")
    })
    const csv = [header, ...rows].join("\n")
    await navigator.clipboard.writeText(csv)
    setCsvCopied(true)
    setTimeout(() => setCsvCopied(false), 2000)
  }

  const mappedEntities = paginatedEntities.map((e: Doc<"entities">) => ({
    id: e._id,
    status: e.status || "active",
    data: e.data || {},
    createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: e.updatedAt ? new Date(e.updatedAt).toISOString() : new Date().toISOString(),
  }))

  const pageDisplay = totalPages === 0 ? "0 / 0" : `${currentPage + 1} / ${totalPages}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold font-display">{entityType.name}</h1>
          {entityType.boundToRole && (
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              {entityType.boundToRole} role
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 rounded-r-none border-r"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs text-muted-foreground tabular-nums">{pageDisplay}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 rounded-l-none"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={status} onValueChange={handleStatusChange}>
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
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleCopyCsv}
            disabled={sortedEntities.length === 0}
          >
            {csvCopied ? (
              <Check className="mr-1.5 h-3.5 w-3.5 text-success" />
            ) : (
              <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
            )}
            {csvCopied ? "Copied" : "CSV"}
          </Button>
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
              {sortedEntities.length} {sortedEntities.length === 1 ? "document" : "documents"}
              {(isLoadingMore || canLoadMore) && (
                <span className="ml-1 inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  loading...
                </span>
              )}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-7 pl-8 w-[180px] text-sm font-input"
            />
          </div>
        </div>
        <EntityTable
          entityType={mappedEntityType}
          entities={mappedEntities}
          onRowClick={(entity) => router.push(`/entities/${typeSlug}/${entity.id}`)}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      </div>
    </div>
  )
}
