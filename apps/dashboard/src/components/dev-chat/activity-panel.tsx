"use client"

import { useMemo, useCallback } from "react"
import { useAnimateNew } from "@/hooks/use-animate-new"
import { X } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Id } from "@convex/_generated/dataModel"
import { useExecutionsByThread, useRecentEvents, useTriggerRuns } from "@/hooks/use-convex-data"
import { ActivityItem, type ActivityFeedItem } from "@/components/dev-chat/activity-item"

interface ActivityPanelProps {
  open: boolean
  threadId: Id<"threads"> | null
  onClose: () => void
}

export function ActivityPanel({ open, threadId, onClose }: ActivityPanelProps) {
  const executions = useExecutionsByThread(threadId)
  const threadStartTime = useMemo(() => {
    if (!executions || executions.length === 0) return undefined
    return Math.min(...executions.map((e: any) => e.createdAt))
  }, [executions])
  const events = useRecentEvents("development", threadStartTime, 200)
  const triggerRuns = useTriggerRuns("development")

  const feedItems: ActivityFeedItem[] = useMemo(() => {
    const items: ActivityFeedItem[] = []

    if (executions) {
      for (const exec of executions) {
        const hasToolCalls = exec.toolCalls && exec.toolCalls.length > 0

        if (hasToolCalls) {
          const baseTime = exec.createdAt
          const timeStep = (exec.durationMs ?? 1000) / (exec.toolCalls.length + 1)

          for (let i = 0; i < exec.toolCalls.length; i++) {
            const tc = exec.toolCalls[i]
            items.push({
              type: "tool_call",
              id: `${exec._id}-tc-${i}`,
              timestamp: baseTime + timeStep * (i + 1),
              data: {
                ...tc,
                timestamp: baseTime + timeStep * (i + 1),
                executionId: exec._id,
                model: exec.model,
              },
            })
          }
        }

        items.push({
          type: "thinking",
          id: exec._id,
          timestamp: exec.createdAt,
          data: exec,
        })
      }
    }

    if (events) {
      for (const event of events as any[]) {
        items.push({
          type: "event",
          id: event._id,
          timestamp: event.timestamp,
          data: event,
        })
      }
    }

    if (triggerRuns && threadStartTime) {
      for (const run of triggerRuns as any[]) {
        if (run.createdAt < threadStartTime) continue
        items.push({
          type: "trigger",
          id: run._id,
          timestamp: run.createdAt,
          data: run,
        })
      }
    }

    return items.sort((a, b) => b.timestamp - a.timestamp)
  }, [executions, events, triggerRuns, threadStartTime])

  const feedKeyFn = useCallback((item: ActivityFeedItem) => `${item.type}-${item.id}`, [])
  const newKeys = useAnimateNew(feedItems, feedKeyFn)

  return (
    <div className={cn(
      "flex flex-col border-r bg-background-secondary h-full overflow-hidden transition-[width] ease-out-soft duration-300",
      open ? "w-80" : "w-0 border-r-0"
    )}>
      <div className="flex flex-col h-full w-80 min-w-80">
        <div className="border-b flex items-center justify-between px-3 py-1.5 shrink-0">
          <span className="text-xs text-content-tertiary">Activity</span>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!threadId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <p className="text-xs text-content-tertiary">Start a conversation to see activity</p>
            </div>
          ) : feedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <p className="text-xs text-content-tertiary">No activity yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {feedItems.map((item) => {
                const key = `${item.type}-${item.id}`
                return (
                  <ActivityItem key={key} item={item} isNew={newKeys.has(key)} />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
