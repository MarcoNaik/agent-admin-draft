"use client"

import { Database, ArrowRight } from "lucide-react"
import { useEntityTypes } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Doc } from "@convex/_generated/dataModel"

export default function EntitiesPage() {
  const { environment } = useEnvironment()
  const entityTypes = useEntityTypes(environment)
  const totalTypes = entityTypes?.length ?? 0

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <Database className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold font-display text-content-primary mb-2">
        Data Browser
      </h2>
      <p className="text-content-secondary max-w-md mb-6">
        {totalTypes > 0
          ? `Select a data type from the sidebar to view and manage its instances. You have ${totalTypes} data type${totalTypes !== 1 ? "s" : ""} configured.`
          : "No data types configured yet. Install a pack or create custom data types to get started."}
      </p>
      {totalTypes > 0 && (
        <div className="flex items-center gap-1 text-sm text-primary">
          <ArrowRight className="h-4 w-4" />
          <span>Select a data type from the sidebar</span>
        </div>
      )}
    </div>
  )
}
