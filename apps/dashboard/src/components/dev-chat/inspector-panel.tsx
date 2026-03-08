"use client"

import { X } from "lucide-react"
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
        <Tabs defaultValue="data" className="flex flex-col flex-1 min-h-0">
          <div className="border-b flex items-center shrink-0">
            <TabsList className="flex-1 h-10 rounded-none bg-transparent p-0">
              <TabsTrigger value="data" className="flex-1 h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-ocean text-sm">Data</TabsTrigger>
              <TabsTrigger value="triggers" className="flex-1 h-full rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-ocean text-sm">Triggers</TabsTrigger>
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
        </Tabs>
      </div>
    </div>
  )
}
