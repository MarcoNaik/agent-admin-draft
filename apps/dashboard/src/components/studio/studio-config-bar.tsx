"use client"

import { Key, Cpu, Square, Loader2 } from "@/lib/icons"
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
import {
  STUDIO_PROVIDERS,
  type StudioProvider,
} from "@/lib/studio/models"
import Link from "next/link"

const STATUS_COLORS: Record<string, string> = {
  provisioning: "bg-warning",
  ready: "bg-success",
  active: "bg-success",
  idle: "bg-warning",
  stopped: "bg-muted-foreground",
  error: "bg-destructive",
}

interface StudioConfigBarProps {
  provider: StudioProvider
  model: string
  keySource: "platform" | "custom"
  onProviderChange: (provider: StudioProvider) => void
  onModelChange: (model: string) => void
  onKeySourceChange: (keySource: "platform" | "custom") => void
  isSessionActive: boolean
  hasCustomKey: boolean
  status?: string
  isStarting?: boolean
  isStopping?: boolean
  onStop?: () => void
}

export function StudioConfigBar({
  provider,
  model,
  keySource,
  onProviderChange,
  onModelChange,
  onKeySourceChange,
  isSessionActive,
  hasCustomKey,
  status,
  isStarting,
  isStopping,
  onStop,
}: StudioConfigBarProps) {
  if (isSessionActive) {
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
          {STUDIO_PROVIDERS[provider]?.name ?? provider}
        </Badge>
        <Badge variant="outline" className="text-[10px] font-normal">
          {model}
        </Badge>
        <Badge variant="outline" className="text-[10px] font-normal">
          {keySource === "custom" ? (
            <><Key className="h-2.5 w-2.5 mr-0.5" />Custom Key</>
          ) : (
            <><Cpu className="h-2.5 w-2.5 mr-0.5" />Platform</>
          )}
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

  const providerConfig = STUDIO_PROVIDERS[provider]
  const models = providerConfig?.models ?? []
  const showKeyError = keySource === "custom" && !hasCustomKey

  return (
    <div className="px-4 py-2 border-b border-border/40">
      <div className="flex items-center gap-2">
        <Select value={provider} onValueChange={(v) => onProviderChange(v as StudioProvider)}>
          <SelectTrigger className="h-7 text-xs w-auto gap-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(STUDIO_PROVIDERS) as [StudioProvider, typeof STUDIO_PROVIDERS[StudioProvider]][]).map(
              ([key, config]) => (
                <SelectItem key={key} value={key} className="text-xs">{config.name}</SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="h-7 text-xs w-auto gap-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                <span className="flex items-center gap-1.5">
                  {m.name}
                  {m.tier === "recommended" && (
                    <span className="text-[9px] font-medium opacity-60 border border-current px-1 py-px rounded">Recommended</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <button
          onClick={() => onKeySourceChange(keySource === "platform" ? "custom" : "platform")}
          className="flex items-center gap-1 text-xs text-content-tertiary hover:text-content-secondary transition-colors"
        >
          {keySource === "custom" ? <Key className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
          {keySource === "custom" ? "My Key" : "Platform"}
        </button>
      </div>

      {showKeyError && (
        <span className="text-[11px] text-destructive mt-1 block">
          No key configured.{" "}
          <Link href="/system/settings/providers" className="underline hover:text-destructive/80">
            Add one
          </Link>
        </span>
      )}
    </div>
  )
}
