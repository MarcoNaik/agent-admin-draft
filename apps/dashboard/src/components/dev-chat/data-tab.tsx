"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, Database } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useEntityTypes, useEntities } from "@/hooks/use-convex-data"

function EntityTypeAccordion({ entityType }: { entityType: any }) {
  const [open, setOpen] = useState(false)
  const entities = useEntities(entityType.slug, "development")

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-background-secondary transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className="text-sm font-medium">{entityType.name}</span>
        <Badge variant="secondary" className="text-[10px] ml-auto">
          {entities?.length ?? 0}
        </Badge>
      </button>
      {open && (
        <div className="px-3 pb-2">
          {!entities || entities.length === 0 ? (
            <p className="text-xs text-content-tertiary py-2">No entities</p>
          ) : (
            <div className="space-y-1">
              {entities.map((entity: any) => (
                <EntityRow key={entity._id} entity={entity} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EntityRow({ entity }: { entity: any }) {
  const [expanded, setExpanded] = useState(false)
  const displayName = entity.data?.name ?? entity.data?.title ?? entity.data?.email ?? entity._id

  return (
    <div className="rounded border bg-background">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-2 py-1.5 flex items-center gap-2 text-left"
      >
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className="text-xs truncate">{String(displayName)}</span>
        {entity.status && (
          <Badge variant="outline" className="text-[10px] ml-auto px-1 py-0 h-4">
            {entity.status}
          </Badge>
        )}
      </button>
      {expanded && (
        <pre className="px-2 pb-2 text-[10px] overflow-x-auto max-h-48 overflow-y-auto">
          {JSON.stringify(entity.data, null, 2)}
        </pre>
      )}
    </div>
  )
}

export function DataTab() {
  const entityTypes = useEntityTypes("development")

  if (!entityTypes) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-content-tertiary">Loading...</p>
      </div>
    )
  }

  if (entityTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <Database className="h-8 w-8 text-content-tertiary mb-2" />
        <p className="text-sm text-content-secondary">No entity types defined</p>
      </div>
    )
  }

  return (
    <div>
      {entityTypes.map((et: any) => (
        <EntityTypeAccordion key={et._id} entityType={et} />
      ))}
    </div>
  )
}
