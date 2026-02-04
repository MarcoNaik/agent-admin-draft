"use client"

import { useEvents, useEventTypes } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Activity, Filter } from "lucide-react"
import { useState } from "react"
import { Doc } from "@convex/_generated/dataModel"

export function EventsTimelineRealtime() {
  const [selectedEventType, setSelectedEventType] = useState<string | undefined>(undefined)
  const { environment } = useEnvironment()
  const events = useEvents(environment, undefined, selectedEventType)
  const eventTypes = useEventTypes(environment)

  if (events === undefined || eventTypes === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={selectedEventType === undefined ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedEventType(undefined)}
        >
          All Events
        </Button>
        {eventTypes.map((type: string) => (
          <Button
            key={type}
            variant={selectedEventType === type ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedEventType(type)}
          >
            {type}
          </Button>
        ))}
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No events yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {events.map((event: Doc<"events">) => (
              <div key={event._id} className="relative flex gap-4">
                <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background border">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>

                <Card className="flex-1">
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-sm font-medium">{event.eventType}</span>
                        {event.entityTypeSlug && (
                          <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">
                            {event.entityTypeSlug}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(event.timestamp)}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-muted-foreground">
                      <span className="capitalize">{event.actorType}</span>
                      {event.actorId && <span className="ml-1 font-mono text-xs">({event.actorId})</span>}
                    </div>

                    {event.payload && Object.keys(event.payload).length > 0 && (
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-24">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(timestamp).toLocaleDateString()
}
