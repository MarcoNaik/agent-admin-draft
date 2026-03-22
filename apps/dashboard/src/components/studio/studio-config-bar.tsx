"use client"

import { Square, Loader2 } from "@/lib/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"

const STATUS_COLORS: Record<string, string> = {
  provisioning: "bg-warning",
  ready: "bg-success",
  active: "bg-success",
  idle: "bg-warning",
  stopped: "bg-muted-foreground",
  error: "bg-destructive",
}

interface StudioConfigBarProps {
  model: string
  onModelChange: (model: string) => void
  isSessionActive: boolean
  status?: string
  isStarting?: boolean
  isStopping?: boolean
  onStop?: () => void
}

const PROVIDER_LABELS: Record<string, string> = {
  xai: "xAI",
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
}

export function StudioConfigBar({
  model,
  onModelChange,
  isSessionActive,
  status,
  isStarting,
  isStopping,
  onStop,
}: StudioConfigBarProps) {
  const featuredModels = useQuery(api.modelPricing.listFeaturedModels)

  type FeaturedModel = { struereId: string; displayName: string; providerSlug: string }
  const models: FeaturedModel[] = featuredModels ?? []
  const groupedModels: Record<string, FeaturedModel[]> = {}
  for (const m of models) {
    if (!groupedModels[m.providerSlug]) groupedModels[m.providerSlug] = []
    groupedModels[m.providerSlug].push(m)
  }

  if (isSessionActive) {
    const activeModel = models.find((m) => m.struereId === model)

    return (
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-border/40">
        {isStarting ? (
          <Loader2 className="h-3 w-3 animate-spin text-content-tertiary shrink-0" />
        ) : status ? (
          <>
            <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[status] ?? "bg-muted-foreground"}`} />
            <span className="sr-only">Status: {{ provisioning: "Starting", ready: "Ready", active: "Active", idle: "Idle", stopped: "Stopped", error: "Error" }[status] ?? status}</span>
          </>
        ) : null}
        <Badge variant="outline" className="text-[10px] font-normal">
          {activeModel?.displayName ?? model}
        </Badge>
        <div className="flex-1" />
        {onStop && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onStop}
            disabled={isStopping}
            aria-label="Stop session"
            className="h-6 px-2 text-xs text-content-tertiary hover:text-destructive"
          >
            {isStopping ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Square className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 py-2 border-b border-border/40">
      <div className="flex items-center gap-2">
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="h-7 text-xs w-auto gap-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {featuredModels === undefined ? (
              <SelectItem value={model} className="text-xs">{model}</SelectItem>
            ) : (
              Object.entries(groupedModels).map(([provider, models]) => (
                <SelectGroup key={provider}>
                  <SelectLabel>{PROVIDER_LABELS[provider] ?? provider}</SelectLabel>
                  {models.map((m) => (
                    <SelectItem key={m.struereId} value={m.struereId} className="text-xs">
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))
            )}
          </SelectContent>
        </Select>

        <div className="flex-1" />
      </div>
    </div>
  )
}
