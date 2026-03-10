"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, CheckCircle2, Lock } from "lucide-react"
import { useAgents, useThreads } from "@/hooks/use-convex-data"
import { useStudio } from "@/contexts/studio-context"
import { useEnvironment } from "@/contexts/environment-context"
import { useCurrentRole } from "@/hooks/use-current-role"
import { useEvalSuites, useEvalRuns } from "@/hooks/use-evals"
import { CreateEvalModal } from "@/components/create-eval-modal"
import { Button } from "@/components/ui/button"
import { Doc } from "@convex/_generated/dataModel"

const STORAGE_KEY = "struere:checklist-dismissed"

export function OnboardingChecklist() {
  const router = useRouter()
  const { openStudio } = useStudio()
  const { environment } = useEnvironment()
  const { isOrgAdmin } = useCurrentRole()
  const agents = useAgents()
  const threads = useThreads(undefined, environment)

  const hasAgent = (agents?.length ?? 0) > 0
  const hasThread = (threads?.length ?? 0) > 0

  const firstAgentId = agents?.[0]?._id
  const evalSuites = useEvalSuites(firstAgentId)
  const hasEval = (evalSuites?.length ?? 0) > 0

  const firstSuiteId = evalSuites?.[0]?._id
  const evalRuns = useEvalRuns(hasEval ? firstSuiteId : undefined)
  const hasCompletedRun = evalRuns?.some((r: Doc<"evalRuns">) => r.completedCases > 0) ?? false

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(STORAGE_KEY) === "true"
  })

  const [evalModalOpen, setEvalModalOpen] = useState(false)

  if (dismissed) return null
  if (!isOrgAdmin) return null
  if (agents === undefined || threads === undefined) return null

  const firstThreadId = threads?.[0]?._id ?? null

  const steps: Array<{
    label: string
    done: boolean
    action: () => void
    unlocked: boolean
  }> = [
    {
      label: "Build your first agent",
      done: hasAgent,
      action: () => openStudio(),
      unlocked: true,
    },
    {
      label: "Chat with your agent",
      done: hasThread,
      action: () => firstAgentId && router.push(`/system/agents/${firstAgentId}`),
      unlocked: hasAgent,
    },
    {
      label: "Create an eval",
      done: hasEval,
      action: () => setEvalModalOpen(true),
      unlocked: hasThread,
    },
    {
      label: "Run your eval",
      done: hasCompletedRun,
      action: () => firstAgentId && router.push(`/system/agents/${firstAgentId}/evals`),
      unlocked: hasEval,
    },
  ]

  const completed = steps.filter((s) => s.done).length
  const allDone = completed === steps.length

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true")
    setDismissed(true)
  }

  const currentStepIndex = steps.findIndex((s) => !s.done && s.unlocked)

  return (
    <>
      <div className="rounded-lg border border-border/30 bg-background-secondary/50 p-4 space-y-3">
        {allDone ? (
          <div className="flex flex-col items-center py-4 space-y-3">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="text-sm font-medium text-content-primary">You&apos;re all set!</p>
            <Button variant="outline" size="sm" onClick={handleDismiss}>
              Got it
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-content-primary">Getting started</span>
                <span className="text-xs text-content-tertiary">
                  {completed}/{steps.length}
                </span>
              </div>
              <button
                onClick={handleDismiss}
                className="text-xs text-content-tertiary hover:text-content-secondary transition-colors"
              >
                Skip
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
              {steps.map((step, i) => {
                const isLocked = !step.unlocked && !step.done
                const isCurrent = i === currentStepIndex

                return (
                  <button
                    key={step.label}
                    onClick={step.done || isLocked ? undefined : step.action}
                    disabled={step.done || isLocked}
                    className={`flex items-center gap-3 w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      isLocked
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-background-tertiary disabled:hover:bg-transparent"
                    } ${isCurrent ? "bg-primary/5" : ""}`}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        step.done
                          ? "border-success bg-success/10"
                          : isLocked
                            ? "border-border/30"
                            : "border-border/50"
                      }`}
                    >
                      {step.done ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : isLocked ? (
                        <Lock className="h-2.5 w-2.5 text-content-tertiary" />
                      ) : null}
                    </div>
                    <span
                      className={
                        step.done
                          ? "text-content-tertiary line-through"
                          : isLocked
                            ? "text-content-tertiary"
                            : "text-content-primary"
                      }
                    >
                      {step.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {firstAgentId && (
        <CreateEvalModal
          open={evalModalOpen}
          onOpenChange={setEvalModalOpen}
          agentName={agents[0]?.name ?? "Agent"}
          threadId={firstThreadId}
        />
      )}
    </>
  )
}
