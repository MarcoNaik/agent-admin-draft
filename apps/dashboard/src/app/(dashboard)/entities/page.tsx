"use client"

import { Database, ArrowRight } from "@/lib/icons"
import { useEntityTypes } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { EmptyState } from "@/components/empty-state"

export default function EntitiesPage() {
  const { environment } = useEnvironment()
  const entityTypes = useEntityTypes(environment)

  if (entityTypes === undefined) return null

  if (entityTypes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <EmptyState
          icon={Database}
          title="No data types yet"
          description="Define data types in your project to store and manage structured data."
          action={{
            label: "Read the docs",
            onClick: () => window.open("https://docs.struere.dev/data-types", "_blank"),
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <Database className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold font-display text-content-primary mb-2">
        Data Browser
      </h2>
      <p className="text-content-secondary max-w-md mb-6">
        {`Select a data type from the sidebar to view and manage its instances. You have ${entityTypes.length} data type${entityTypes.length !== 1 ? "s" : ""} configured.`}
      </p>
      <div className="flex items-center gap-1 text-sm text-primary">
        <ArrowRight className="h-4 w-4" />
        <span>Select a data type from the sidebar</span>
      </div>
    </div>
  )
}
