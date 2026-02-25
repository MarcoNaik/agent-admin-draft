"use client"

import { Key, Cpu } from "lucide-react"
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

interface StudioConfigBarProps {
  provider: StudioProvider
  model: string
  keySource: "platform" | "custom"
  onProviderChange: (provider: StudioProvider) => void
  onModelChange: (model: string) => void
  onKeySourceChange: (keySource: "platform" | "custom") => void
  isSessionActive: boolean
  hasCustomKey: boolean
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
}: StudioConfigBarProps) {
  if (isSessionActive) {
    return (
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b bg-background-secondary">
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
      </div>
    )
  }

  const providerConfig = STUDIO_PROVIDERS[provider]
  const models = providerConfig?.models ?? []
  const showKeyError = keySource === "custom" && !hasCustomKey

  return (
    <div className="px-4 py-2.5 border-b bg-background-secondary space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-md bg-background-tertiary p-0.5">
          {(Object.entries(STUDIO_PROVIDERS) as [StudioProvider, typeof STUDIO_PROVIDERS[StudioProvider]][]).map(
            ([key, config]) => (
              <button
                key={key}
                onClick={() => onProviderChange(key)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  provider === key
                    ? "bg-background text-content-primary shadow-sm"
                    : "text-content-tertiary hover:text-content-secondary"
                }`}
              >
                {config.name}
              </button>
            )
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1 rounded-md bg-background-tertiary p-0.5">
          <button
            onClick={() => onKeySourceChange("platform")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              keySource === "platform"
                ? "bg-background text-content-primary shadow-sm"
                : "text-content-tertiary hover:text-content-secondary"
            }`}
          >
            <Cpu className="h-3 w-3" />
            Platform
          </button>
          <button
            onClick={() => onKeySourceChange("custom")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              keySource === "custom"
                ? "bg-background text-content-primary shadow-sm"
                : "text-content-tertiary hover:text-content-secondary"
            }`}
          >
            <Key className="h-3 w-3" />
            My Key
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="h-7 text-xs w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel className="text-[10px] text-content-tertiary">Fast</SelectLabel>
              {models.filter((m) => m.tier === "fast").map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-[10px] text-content-tertiary">Standard</SelectLabel>
              {models.filter((m) => m.tier === "standard").map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
              ))}
            </SelectGroup>
            {models.some((m) => m.tier === "premium") && (
              <SelectGroup>
                <SelectLabel className="text-[10px] text-content-tertiary">Premium</SelectLabel>
                {models.filter((m) => m.tier === "premium").map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>

        {showKeyError && (
          <span className="text-[11px] text-destructive">
            No key configured.{" "}
            <Link href="/settings/providers" className="underline hover:text-destructive/80">
              Add one
            </Link>
          </span>
        )}
      </div>
    </div>
  )
}
