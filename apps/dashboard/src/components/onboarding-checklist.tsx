"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, CheckCircle2, Lock, Copy, ChevronRight } from "@/lib/icons"
import { useAgents, useThreads } from "@/hooks/use-convex-data"
import { useStudio } from "@/contexts/studio-context"
import { useEnvironment } from "@/contexts/environment-context"
import { useCurrentRole } from "@/hooks/use-current-role"
import { useEvalSuites, useEvalRuns } from "@/hooks/use-evals"
import { CreateEvalModal } from "@/components/create-eval-modal"
import { CliPromptToggle } from "@/components/cli-prompt-toggle"
import { Button } from "@/components/ui/button"
import { Doc } from "@convex/_generated/dataModel"

const STORAGE_KEY = "struere:checklist-dismissed"

const PROMPTS = {
  setup: `I want to set up a Struere project (https://struere.dev) — an AI agent platform where I define agents, data types, roles, and automations as TypeScript code.

Step 1: Install the Struere CLI globally
  bun install -g struere

Step 2: Initialize and pull my project
  struere pull
  (This will open a browser to log in, let me select my organization, create the project structure, and download any existing agent configurations)

Step 3: Install the Struere developer skill for coding agents
  npx skills add MarcoNaik/struere-skill --all --yes

After completing these steps, show me the project structure and summarize what was set up. If any step fails, show me the error and suggest a fix.

Documentation: https://docs.struere.dev/llms.txt`,

  build: `Create a customer support agent for an online store that sells electronics.

The agent should:
1. Greet customers and ask how it can help
2. Look up order status by email or order number
3. Answer questions about return policy (30-day returns, must be unused)
4. Escalate to a human if the customer is upset or the issue is complex

Create:
- The agent definition with a system prompt
- An "order" data type with fields: orderNumber, customerEmail, customerName, status (pending, shipped, delivered, returned), items, total
- A "customer" data type with fields: name, email, phone

Use these tools: entity.query, entity.get, entity.update

Then sync with: struere sync`,

  chat: (slug: string) => `Test my Struere agent by running:
  struere chat ${slug}

Have a real conversation with the agent. Try the main use case it was built for. After testing, tell me what worked well and what needs improvement.`,

  eval: (slug: string) => `Create an eval suite for my "${slug}" agent based on the conversation we just had. Run:
  struere add eval ${slug}-tests

Write test cases that cover:
- The main happy path (what the agent is supposed to do)
- Edge cases (unexpected inputs, missing data)
- Guardrails (things the agent should NOT do)

Then sync with: struere sync`,

  runEval: (slug: string) => `Run my eval suite and iterate on the agent until all tests pass:
  struere eval run ${slug}-tests

For each failing test:
1. Read the failure reason
2. Update the agent's system prompt, tools, or data types to fix it
3. Sync with struere sync
4. Re-run the eval

Keep iterating until all cases pass.`,
}

function CopyablePrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative mt-1.5">
      <pre className="text-left text-[10px] text-content-tertiary font-mono whitespace-pre-wrap bg-background-tertiary/50 border border-border/20 rounded-md p-2 pr-8 max-h-32 overflow-y-auto">
        {prompt}
      </pre>
      <button
        onClick={(e) => { e.stopPropagation(); handleCopy() }}
        className="absolute top-1.5 right-1.5 p-1 rounded bg-background-secondary/80 hover:bg-background-secondary text-content-tertiary hover:text-content-secondary transition-colors"
      >
        {copied ? (
          <Check className="h-3 w-3 text-success" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  )
}

export function OnboardingChecklist() {
  const router = useRouter()
  const { openStudio } = useStudio()
  const { environment } = useEnvironment()
  const { isOrgAdmin } = useCurrentRole()
  const agents = useAgents()
  const threads = useThreads(undefined, environment)

  const hasAgent = (agents?.length ?? 0) > 0
  const hasThread = (threads?.length ?? 0) > 0

  const firstAgent = agents?.[0]
  const firstAgentId = firstAgent?._id
  const firstAgentSlug = firstAgent?.slug ?? "my-agent"
  const evalSuites = useEvalSuites(firstAgentId)
  const hasEval = (evalSuites?.length ?? 0) > 0

  const firstSuiteId = evalSuites?.[0]?._id
  const evalRuns = useEvalRuns(hasEval ? firstSuiteId : undefined)
  const hasCompletedRun = evalRuns?.some((r: Doc<"evalRuns">) => r.completedCases > 0) ?? false

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(STORAGE_KEY) === "true"
  })

  const [expandedStep, setExpandedStep] = useState<number | null>(null)
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
    prompt?: string
  }> = [
    {
      label: "Build your first agent",
      done: hasAgent,
      action: () => setExpandedStep(expandedStep === 0 ? null : 0),
      unlocked: true,
      prompt: PROMPTS.build,
    },
    {
      label: "Chat with your agent",
      done: hasThread,
      action: () => setExpandedStep(expandedStep === 1 ? null : 1),
      unlocked: hasAgent,
      prompt: PROMPTS.chat(firstAgentSlug),
    },
    {
      label: "Create an eval",
      done: hasEval,
      action: () => setExpandedStep(expandedStep === 2 ? null : 2),
      unlocked: hasThread,
      prompt: PROMPTS.eval(firstAgentSlug),
    },
    {
      label: "Run your eval",
      done: hasCompletedRun,
      action: () => setExpandedStep(expandedStep === 3 ? null : 3),
      unlocked: hasEval,
      prompt: PROMPTS.runEval(firstAgentSlug),
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

            {!hasAgent && <CliPromptToggle initialOpen />}

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
                const isExpanded = expandedStep === i

                return (
                  <div key={step.label}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={step.done || isLocked ? undefined : step.action}
                        disabled={step.done || isLocked}
                        className={`flex items-center gap-3 flex-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
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
                          ) : step.prompt ? (
                            <ChevronRight className={`h-2.5 w-2.5 text-content-tertiary transition-transform ${isExpanded ? "rotate-90" : ""}`} />
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
                    </div>
                    {isExpanded && step.prompt && !step.done && (
                      <div className="mt-1">
                        <CopyablePrompt prompt={step.prompt} />
                      </div>
                    )}
                  </div>
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
