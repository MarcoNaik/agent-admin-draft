"use client"

import { useState } from "react"
import { Loader2, ChevronDown, Database } from "@/lib/icons"
import { useFixtures, useFixtureEntities } from "@/hooks/use-convex-data"
import { Badge } from "@/components/ui/badge"
import { EntityTable } from "@/components/entities/entity-table"
import { formatRelativeTime } from "@/lib/format"

function FixtureTypeTable({ slug }: { slug: string }) {
  const result = useFixtureEntities(slug)

  if (result === undefined) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-content-tertiary" />
      </div>
    )
  }

  if (!result || result.entities.length === 0) {
    return (
      <div className="py-3 text-xs text-content-tertiary text-center">No entities</div>
    )
  }

  const { entityType, entities } = result
  const mappedType = {
    id: entityType._id,
    name: entityType.name,
    slug: entityType.slug,
    schema: entityType.schema,
    displayConfig: entityType.displayConfig,
  }
  const mappedEntities = entities.map((e: any) => ({
    id: e._id,
    status: e.status ?? "active",
    data: e.data ?? {},
    createdAt: new Date(e._creationTime).toISOString(),
    updatedAt: new Date(e.updatedAt ?? e._creationTime).toISOString(),
  }))

  return <EntityTable entityType={mappedType} entities={mappedEntities} onRowClick={() => {}} />
}

function FixtureCard({ fixture }: { fixture: any }) {
  const [expanded, setExpanded] = useState(false)
  const typeCounts = fixture.entityTypeCounts as Record<string, number> | undefined

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full p-3 text-left hover:bg-background-secondary transition-colors ease-out-soft"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Database className="h-4 w-4 text-content-tertiary shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-content-primary truncate">{fixture.name}</div>
            <div className="text-xs text-content-tertiary mt-0.5">
              {formatRelativeTime(fixture.syncedAt)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {typeCounts && Object.entries(typeCounts).map(([type, count]) => (
            <Badge key={type} variant="secondary" className="text-xs">
              {count} {type}
            </Badge>
          ))}
          {fixture.relationCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {fixture.relationCount} relation{fixture.relationCount !== 1 ? "s" : ""}
            </Badge>
          )}
          <ChevronDown className={`h-4 w-4 text-content-tertiary transition-transform ease-out-soft ${expanded ? "" : "-rotate-90"}`} />
        </div>
      </button>
      {expanded && typeCounts && (
        <div className="border-t divide-y">
          {Object.keys(typeCounts).map((slug) => (
            <div key={slug} className="px-3 py-2">
              <div className="text-xs font-medium text-content-secondary mb-1">{slug}</div>
              <FixtureTypeTable slug={slug} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function EvalsFixturesSection() {
  const fixtures = useFixtures()

  if (fixtures === undefined) return null
  if (fixtures.length === 0) return null

  return (
    <div className="space-y-2">
      {fixtures.map((fixture: any) => (
        <FixtureCard key={fixture._id} fixture={fixture} />
      ))}
    </div>
  )
}
