"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Square, Loader2 } from "lucide-react"

interface StudioSessionControlsProps {
  status: string | undefined
  isStarting: boolean
  isStopping: boolean
  isConnected: boolean
  onStop: () => void
  model?: string
}

const STATUS_COLORS: Record<string, string> = {
  provisioning: "bg-warning",
  ready: "bg-success",
  active: "bg-success",
  idle: "bg-warning",
  stopped: "bg-muted-foreground",
  error: "bg-destructive",
}

const STATUS_LABELS: Record<string, string> = {
  provisioning: "Starting...",
  ready: "Ready",
  active: "Active",
  idle: "Idle",
  stopped: "Stopped",
  error: "Error",
}

export function StudioSessionControls({
  status,
  isStarting,
  isStopping,
  isConnected,
  onStop,
  model,
}: StudioSessionControlsProps) {
  const isActive = status === "provisioning" || status === "ready" || status === "active" || status === "idle"

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-background-secondary">
      <span className="text-sm font-medium text-content-primary">Studio</span>

      {isStarting && (
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin text-content-tertiary" />
          <span className="text-xs text-content-tertiary">Starting...</span>
        </div>
      )}

      {!isStarting && status && (
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status] ?? "bg-muted-foreground"}`} />
          <span className="text-xs text-content-secondary">
            {STATUS_LABELS[status] ?? status}
          </span>
        </div>
      )}

      {isActive && model && (
        <Badge variant="outline" className="text-[10px] font-normal text-content-tertiary">
          {model}
        </Badge>
      )}

      {isConnected && (
        <Badge variant="outline" className="text-xs">
          SSE Connected
        </Badge>
      )}

      <div className="flex-1" />

      {isActive && (
        <Button
          size="sm"
          variant="destructive"
          onClick={onStop}
          disabled={isStopping}
        >
          {isStopping ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Stopping...
            </>
          ) : (
            <>
              <Square className="h-3 w-3 mr-1" />
              Stop
            </>
          )}
        </Button>
      )}
    </div>
  )
}
