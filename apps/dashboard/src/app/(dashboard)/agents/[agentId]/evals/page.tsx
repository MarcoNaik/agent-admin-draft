"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, Plus, Play, FlaskConical, ChevronRight } from "lucide-react"
import { useEvalSuites, useEvalRuns, useStartEvalRun } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Badge } from "@/components/ui/badge"
import { Id } from "@convex/_generated/dataModel"

interface EvalsPageProps {
  params: { agentId: string }
}

function SuiteRow({ suite, agentId }: { suite: any; agentId: string }) {
  const runs = useEvalRuns(suite._id, 1)
  const startRun = useStartEvalRun()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastRun = runs && runs.length > 0 ? runs[0] : null
  const scoreDisplay = lastRun?.overallScore !== undefined
    ? `${(lastRun.overallScore / 5 * 100).toFixed(0)}%`
    : null

  const handleRun = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setStarting(true)
    setError(null)
    try {
      await startRun({ suiteId: suite._id, triggerSource: "dashboard" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run")
    } finally {
      setStarting(false)
    }
  }

  return (
    <div>
      <Link
        href={`/agents/${agentId}/evals/${suite._id}`}
        className="flex items-center justify-between rounded-md border bg-card p-4 hover:bg-background-secondary transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <FlaskConical className="h-4 w-4 text-content-tertiary shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-content-primary truncate">{suite.name}</div>
            {suite.description && (
              <div className="text-xs text-content-tertiary mt-0.5 truncate">{suite.description}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {suite.tags && suite.tags.length > 0 && (
            <div className="flex gap-1">
              {suite.tags.slice(0, 2).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
          {scoreDisplay && (
            <Badge
              variant={lastRun.passedCases === lastRun.totalCases ? "success" : "destructive"}
              className="text-xs font-mono"
            >
              {scoreDisplay}
            </Badge>
          )}
          {lastRun && (
            <Badge variant="outline" className="text-xs">
              {lastRun.passedCases}/{lastRun.totalCases} passed
            </Badge>
          )}
          <button
            onClick={handleRun}
            disabled={starting}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {starting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Run
          </button>
          <ChevronRight className="h-4 w-4 text-content-tertiary" />
        </div>
      </Link>
      {error && (
        <div className="rounded-b-md border border-t-0 bg-destructive/10 px-4 py-1.5 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}

export default function EvalsPage({ params }: EvalsPageProps) {
  const { agentId } = params
  const { environment } = useEnvironment()
  const suites = useEvalSuites(agentId as Id<"agents">, environment)

  if (suites === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-content-primary">Evals</h2>
          <p className="text-sm text-content-secondary mt-0.5">Evaluate agent behavior with test suites</p>
        </div>
        <Link
          href={`/agents/${agentId}/evals/new`}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Suite
        </Link>
      </div>

      {suites.length === 0 ? (
        <div className="rounded-md border bg-card p-12 text-center">
          <FlaskConical className="h-8 w-8 text-content-tertiary mx-auto mb-3" />
          <p className="text-sm text-content-secondary">No eval suites yet</p>
          <p className="text-xs text-content-tertiary mt-1">Create a suite to start testing your agent</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suites.map((suite) => (
            <SuiteRow key={suite._id} suite={suite} agentId={agentId} />
          ))}
        </div>
      )}
    </div>
  )
}
