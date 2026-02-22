"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronsUpDown, Square, Loader2 } from "lucide-react"

type AgentType = "opencode" | "claude"

interface StudioSessionControlsProps {
  status: string | undefined
  isStarting: boolean
  isStopping: boolean
  isConnected: boolean
  onStart: (agentType: AgentType) => void
  onStop: () => void
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
  onStart,
  onStop,
}: StudioSessionControlsProps) {
  const [agentType, setAgentType] = useState<AgentType>("opencode")

  const isActive = status === "provisioning" || status === "ready" || status === "active" || status === "idle"

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-background-secondary">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isActive} className="gap-2">
            {agentType === "opencode" ? "OpenCode" : "Claude Code"}
            <ChevronsUpDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setAgentType("opencode")}>
            OpenCode
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAgentType("claude")}>
            Claude Code
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {status && (
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status] ?? "bg-muted-foreground"}`} />
          <span className="text-xs text-content-secondary">
            {STATUS_LABELS[status] ?? status}
          </span>
        </div>
      )}

      {isConnected && (
        <Badge variant="outline" className="text-xs">
          SSE Connected
        </Badge>
      )}

      <div className="flex-1" />

      {!isActive ? (
        <Button
          size="sm"
          onClick={() => onStart(agentType)}
          disabled={isStarting}
        >
          {isStarting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Starting...
            </>
          ) : (
            "Start Session"
          )}
        </Button>
      ) : (
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
