"use client"

import { useState } from "react"
import { Square, Loader2 } from "@/lib/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
  meta: "Meta",
  mistralai: "Mistral",
  deepseek: "DeepSeek",
  cohere: "Cohere",
  microsoft: "Microsoft",
  amazon: "Amazon",
  perplexity: "Perplexity",
  qwen: "Qwen",
}

const TOP_MODELS = [
  "anthropic/claude-opus-4",
  "xai/grok-4",
  "google/gemini-2.5-pro",
  "openai/gpt-5-mini",
  "anthropic/claude-sonnet-4",
]

type ModelEntry = { struereId: string; displayName: string; providerSlug: string }

function groupByProvider(models: ModelEntry[]): Record<string, ModelEntry[]> {
  const grouped: Record<string, ModelEntry[]> = {}
  for (const m of models) {
    if (!grouped[m.providerSlug]) grouped[m.providerSlug] = []
    grouped[m.providerSlug].push(m)
  }
  return grouped
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
  const allModels = useQuery(api.modelPricing.listAllModels)
  const [showAll, setShowAll] = useState(false)

  const featured: ModelEntry[] = featuredModels ?? []
  const all: ModelEntry[] = allModels ?? []

  if (isSessionActive) {
    const activeModel = featured.find((m) => m.struereId === model)
      ?? all.find((m) => m.struereId === model)

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

  const topModels = featured.filter((m) => TOP_MODELS.includes(m.struereId))
  const displayModels = showAll ? all : topModels
  const groupedModels = groupByProvider(displayModels)
  const selectedInDisplay = displayModels.some((m) => m.struereId === model)
  const selectedModel = !selectedInDisplay
    ? (all.find((m) => m.struereId === model) ?? featured.find((m) => m.struereId === model))
    : null

  return (
    <div className="px-4 py-2 border-b border-border/40">
      <div className="flex items-center gap-2">
        <Select value={model} onValueChange={onModelChange} onOpenChange={(open) => { if (!open) setShowAll(false) }}>
          <SelectTrigger className="h-7 text-xs w-auto gap-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {featuredModels === undefined ? (
              <SelectItem value={model} className="text-xs">{model}</SelectItem>
            ) : (
              <>
                {selectedModel && (
                  <SelectItem value={selectedModel.struereId} className="hidden">
                    {selectedModel.displayName}
                  </SelectItem>
                )}
                {showAll && (
                  <button
                    className="w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground text-left cursor-pointer"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowAll(false)
                    }}
                  >
                    Show less
                  </button>
                )}
                {Object.entries(groupedModels).map(([provider, models]) => (
                  <SelectGroup key={provider}>
                    <SelectLabel>{PROVIDER_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1)}</SelectLabel>
                    {models.map((m) => (
                      <SelectItem key={m.struereId} value={m.struereId} className="text-xs">
                        {m.displayName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                {!showAll && (
                  <>
                    <SelectSeparator />
                    <button
                      className="w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground text-left cursor-pointer"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setShowAll(true)
                      }}
                    >
                      See more models...
                    </button>
                  </>
                )}
              </>
            )}
          </SelectContent>
        </Select>

        <div className="flex-1" />
      </div>
    </div>
  )
}
