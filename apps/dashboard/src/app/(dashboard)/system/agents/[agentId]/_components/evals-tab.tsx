"use client"

import { useState } from "react"
import { Plus } from "@/lib/icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Id } from "@convex/_generated/dataModel"
import { EvalRunsPanel } from "./eval-runs-panel"
import { EvalSuitesPanel } from "./eval-suites-panel"
import { EvalsFixturesSection } from "./eval-fixtures-section"
import { EvalSuiteDialog } from "./eval-suite-dialog"

interface EvalsTabProps {
  agentId: Id<"agents">
  environment: string
}

export function EvalsTab({ agentId, environment }: EvalsTabProps) {
  const [newSuiteOpen, setNewSuiteOpen] = useState(false)

  return (
    <div className="space-y-4">
      <Tabs defaultValue="runs" className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="suites">Suites</TabsTrigger>
            <TabsTrigger value="data">Test Data</TabsTrigger>
          </TabsList>
          <button
            onClick={() => setNewSuiteOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors ease-out-soft"
          >
            <Plus className="h-4 w-4" />
            New Suite
          </button>
        </div>

        <TabsContent value="runs">
          <EvalRunsPanel agentId={agentId} />
        </TabsContent>

        <TabsContent value="suites">
          <EvalSuitesPanel agentId={agentId} environment={environment} />
        </TabsContent>

        <TabsContent value="data">
          <EvalsFixturesSection />
        </TabsContent>
      </Tabs>

      <EvalSuiteDialog
        open={newSuiteOpen}
        onOpenChange={setNewSuiteOpen}
        agentId={agentId}
        environment={environment}
      />
    </div>
  )
}
