"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { DataTab } from "@/components/dev-chat/data-tab"
import { TriggersTab } from "@/components/dev-chat/triggers-tab"
import { ToolsTab } from "@/components/dev-chat/tools-tab"
import { Id } from "@convex/_generated/dataModel"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { useTabUpdates } from "@/hooks/use-tab-updates"
import { useTriggerRuns } from "@/hooks/use-convex-data"
import { useEntityTypes } from "@/hooks/use-entities"

interface InspectorPanelProps {
  open: boolean
  onClose: () => void
  agentId: Id<"agents"> | undefined
}

export function InspectorPanel({ open, onClose, agentId }: InspectorPanelProps) {
  const entityTypes = useEntityTypes("development")
  const triggerRuns = useTriggerRuns("development")
  const agentData = useQuery(api.agents.getWithConfig, agentId ? { id: agentId } : "skip")
  const { unseen, setActiveTab } = useTabUpdates(
    entityTypes,
    triggerRuns,
    agentData?.developmentConfig?.tools
  )

  return (
    <div className={cn(
      "flex flex-col border-l bg-background-secondary h-full overflow-hidden transition-[width] ease-out-soft duration-300",
      open ? "w-[400px]" : "w-0 border-l-0"
    )}>
      <div className="flex flex-col h-full w-[400px] min-w-[400px]">
        <Tabs defaultValue="data" onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <div className="border-b flex items-center shrink-0">
            <TabsList className="flex-1 h-10 rounded-none bg-transparent p-0">
              <TabsTrigger value="data" className="flex-1 h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-ocean text-sm">
                Data
                {unseen.has("data") && (
                  <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-ocean animate-pulse-dot" />
                )}
              </TabsTrigger>
              <TabsTrigger value="triggers" className="flex-1 h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-ocean text-sm">
                Triggers
                {unseen.has("triggers") && (
                  <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-ocean animate-pulse-dot" />
                )}
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex-1 h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-ocean text-sm">
                Tools
                {unseen.has("tools") && (
                  <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-ocean animate-pulse-dot" />
                )}
              </TabsTrigger>
            </TabsList>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 mr-1 shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <TabsContent value="data" className="flex-1 overflow-y-auto mt-0 p-0">
            <DataTab />
          </TabsContent>
          <TabsContent value="triggers" className="flex-1 overflow-y-auto mt-0 p-0">
            <TriggersTab />
          </TabsContent>
          <TabsContent value="tools" className="flex-1 overflow-y-auto mt-0 p-0">
            <ToolsTab agentId={agentId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
