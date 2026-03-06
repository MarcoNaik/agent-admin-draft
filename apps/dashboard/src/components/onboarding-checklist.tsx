"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ExternalLink } from "lucide-react"
import { useAgents, useThreads, useApiKeys, useExecutions } from "@/hooks/use-convex-data"
import { useStudio } from "@/contexts/studio-context"
import { useEnvironment } from "@/contexts/environment-context"
import { useCurrentRole } from "@/hooks/use-current-role"

const STORAGE_KEY = "struere:checklist-dismissed"

export function OnboardingChecklist() {
  const router = useRouter()
  const { openStudio } = useStudio()
  const { environment } = useEnvironment()
  const { isOrgAdmin } = useCurrentRole()
  const agents = useAgents()
  const threads = useThreads(undefined, environment)
  const apiKeys = useApiKeys()
  const executions = useExecutions(undefined, environment)

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(STORAGE_KEY) === "true"
  })

  if (dismissed) return null
  if (!isOrgAdmin) return null
  if (agents === undefined || threads === undefined || apiKeys === undefined || executions === undefined) return null

  const steps: Array<{ label: string; done: boolean; action: () => void; external?: boolean }> = [
    {
      label: "Create your first agent",
      done: agents.length > 0,
      action: () => openStudio(),
    },
    {
      label: "Test in Studio",
      done: (threads?.length ?? 0) > 0,
      action: () => openStudio(),
    },
    {
      label: "Create an API key",
      done: (apiKeys?.length ?? 0) > 0,
      action: () => router.push("/settings/api-keys"),
    },
    {
      label: "Make your first API call",
      done: (executions?.length ?? 0) > 0,
      action: () => window.open("https://docs.struere.dev/getting-started", "_blank"),
      external: true,
    },
  ]

  const completed = steps.filter((s) => s.done).length
  const allDone = completed === steps.length

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true")
    setDismissed(true)
  }

  return (
    <div className="rounded-lg border border-border/30 bg-background-secondary/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-content-primary">
            {allDone ? "You're all set!" : "Getting started"}
          </span>
          <span className="text-xs text-content-tertiary">{completed}/{steps.length}</span>
        </div>
        <button
          onClick={handleDismiss}
          className="text-xs text-content-tertiary hover:text-content-secondary transition-colors"
        >
          {allDone ? "Dismiss" : "Skip"}
        </button>
      </div>

      <div
        className="h-1.5 rounded-full bg-background-tertiary overflow-hidden"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-label="Getting started progress"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>

      <div className="space-y-1">
        {steps.map((step) => (
          <button
            key={step.label}
            onClick={step.done ? undefined : step.action}
            disabled={step.done}
            className="flex items-center gap-3 w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-background-tertiary disabled:hover:bg-transparent"
          >
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${step.done ? "border-success bg-success/10" : "border-border/50"}`}>
              {step.done && <Check className="h-3 w-3 text-success" />}
            </div>
            <span className={step.done ? "text-content-tertiary line-through" : "text-content-primary"}>
              {step.label}
            </span>
            {!step.done && step.external && (
              <ExternalLink className="h-3 w-3 text-content-tertiary ml-auto" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
