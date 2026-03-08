"use client"

import { useState, useEffect, useCallback, type ReactNode, isValidElement, cloneElement } from "react"
import { PanelLeft, PanelRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ActivityPanel } from "@/components/dev-chat/activity-panel"
import { InspectorPanel } from "@/components/dev-chat/inspector-panel"
import { Id } from "@convex/_generated/dataModel"

const ACTIVITY_KEY = "struere:dev-chat-activity"
const INSPECTOR_KEY = "struere:dev-chat-inspector"

function getStored(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback
  const val = localStorage.getItem(key)
  return val !== null ? val === "true" : fallback
}

interface DevChatLayoutProps {
  threadId: Id<"threads"> | null
  agentId: Id<"agents"> | undefined
  children: ReactNode
}

export function DevChatLayout({ threadId, children }: DevChatLayoutProps) {
  const [activityOpen, setActivityOpen] = useState(() => getStored(ACTIVITY_KEY, true))
  const [inspectorOpen, setInspectorOpen] = useState(() => getStored(INSPECTOR_KEY, true))

  useEffect(() => {
    localStorage.setItem(ACTIVITY_KEY, String(activityOpen))
  }, [activityOpen])

  useEffect(() => {
    localStorage.setItem(INSPECTOR_KEY, String(inspectorOpen))
  }, [inspectorOpen])

  const toggleActivity = useCallback(() => setActivityOpen((p) => !p), [])
  const toggleInspector = useCallback(() => setInspectorOpen((p) => !p), [])

  const headerExtra = (
    <>
      <Button variant="ghost" size="icon" onClick={toggleActivity} className="h-8 w-8">
        <PanelLeft className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={toggleInspector} className="h-8 w-8">
        <PanelRight className="h-4 w-4" />
      </Button>
    </>
  )

  return (
    <div className="flex h-screen">
      <ActivityPanel open={activityOpen} threadId={threadId} onClose={toggleActivity} />
      <div className="flex-1 flex flex-col min-w-0">
        {isValidElement(children) ? cloneElement(children as React.ReactElement<any>, { headerExtra }) : children}
      </div>
      <InspectorPanel open={inspectorOpen} onClose={toggleInspector} />
    </div>
  )
}
