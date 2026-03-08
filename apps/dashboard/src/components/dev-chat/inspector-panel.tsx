"use client"

import { X, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { DataTab } from "@/components/dev-chat/data-tab"
import { TriggersTab } from "@/components/dev-chat/triggers-tab"

interface InspectorPanelProps {
  open: boolean
  onClose: () => void
}

export function InspectorPanel({ open, onClose }: InspectorPanelProps) {
  return (
    <div className={cn(
      "flex flex-col border-l bg-background-secondary h-full overflow-hidden transition-[width] ease-out-soft duration-300",
      open ? "w-[400px]" : "w-0 border-l-0"
    )}>
      <div className="flex flex-col h-full w-[400px] min-w-[400px]">
        <div className="px-3 py-2 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-content-secondary" />
            <span className="text-sm font-medium">Inspector</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Tabs defaultValue="data" className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-3 mt-2 shrink-0">
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
          </TabsList>
          <TabsContent value="data" className="flex-1 overflow-y-auto mt-0 p-0">
            <DataTab />
          </TabsContent>
          <TabsContent value="triggers" className="flex-1 overflow-y-auto mt-0 p-0">
            <TriggersTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
