"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loader2,
  Plus,
  Play,
  ArrowLeft,
  Trash2,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Pencil,
  Check,
  X,
} from "lucide-react"
import {
  useEvalSuite,
  useEvalCases,
  useEvalRuns,
  useStartEvalRun,
  useDeleteEvalCase,
  useDeleteEvalSuite,
  useUpdateEvalSuite,
} from "@/hooks/use-convex-data"
import { Badge } from "@/components/ui/badge"
import { Id } from "@convex/_generated/dataModel"

interface SuiteDetailPageProps {
  params: { agentId: string; suiteId: string }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const statusConfig = {
  pending: { icon: Clock, color: "text-content-tertiary", badge: "outline" as const },
  running: { icon: Loader2, color: "text-primary", badge: "default" as const },
  completed: { icon: CheckCircle2, color: "text-green-500", badge: "success" as const },
  failed: { icon: XCircle, color: "text-red-500", badge: "destructive" as const },
  cancelled: { icon: Ban, color: "text-content-tertiary", badge: "secondary" as const },
}

export default function SuiteDetailPage({ params }: SuiteDetailPageProps) {
  const { agentId, suiteId } = params
  const router = useRouter()
  const suite = useEvalSuite(suiteId as Id<"evalSuites">)
  const cases = useEvalCases(suiteId as Id<"evalSuites">)
  const runs = useEvalRuns(suiteId as Id<"evalSuites">, 10)
  const startRun = useStartEvalRun()
  const deleteCase = useDeleteEvalCase()
  const deleteSuite = useDeleteEvalSuite()
  const updateSuite = useUpdateEvalSuite()
  const [starting, setStarting] = useState(false)
  const [startingCaseId, setStartingCaseId] = useState<Id<"evalCases"> | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [editingContext, setEditingContext] = useState(false)
  const [judgeContextDraft, setJudgeContextDraft] = useState("")

  if (suite === undefined || cases === undefined || runs === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (!suite) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-content-secondary">Suite not found</p>
      </div>
    )
  }

  const handleRun = async () => {
    setStarting(true)
    setRunError(null)
    try {
      await startRun({ suiteId: suite._id, triggerSource: "dashboard" })
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to start run")
    } finally {
      setStarting(false)
    }
  }

  const handleDeleteSuite = async () => {
    try {
      await deleteSuite({ id: suite._id })
      router.push(`/agents/${agentId}/evals`)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to delete suite")
    }
  }

  const handleDeleteCase = async (caseId: Id<"evalCases">) => {
    try {
      await deleteCase({ id: caseId })
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to delete case")
    }
  }

  const handleRunCase = async (caseId: Id<"evalCases">) => {
    setStartingCaseId(caseId)
    setRunError(null)
    try {
      const runId = await startRun({ suiteId: suite._id, triggerSource: "dashboard", caseIds: [caseId] })
      router.push(`/agents/${agentId}/evals/${suiteId}/runs/${runId}`)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to start run")
    } finally {
      setStartingCaseId(null)
    }
  }

  const handleSaveJudgeContext = async () => {
    try {
      await updateSuite({ id: suite._id, judgeContext: judgeContextDraft.trim() })
      setEditingContext(false)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to update judge context")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/agents/${agentId}/evals`}
            className="rounded-md p-1.5 hover:bg-background-tertiary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-content-secondary" />
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-content-primary">{suite.name}</h2>
            {suite.description && (
              <p className="text-sm text-content-secondary mt-0.5">{suite.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={starting || cases.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Suite
          </button>
          <button
            onClick={handleDeleteSuite}
            className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {runError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {runError}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-content-primary">Judge Context</h3>
          {!editingContext ? (
            <button
              onClick={() => { setJudgeContextDraft(suite.judgeContext ?? ""); setEditingContext(true) }}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-content-secondary hover:bg-background-tertiary transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSaveJudgeContext}
                className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Check className="h-3 w-3" />
                Save
              </button>
              <button
                onClick={() => setEditingContext(false)}
                className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-content-secondary hover:bg-background-tertiary transition-colors"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          )}
        </div>
        {editingContext ? (
          <div className="space-y-1.5">
            <textarea
              value={judgeContextDraft}
              onChange={(e) => setJudgeContextDraft(e.target.value)}
              placeholder={"{{format_teacher_schedule({})}}\n{{entity.query({\"type\": \"student\"})}}"}
              rows={5}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
            <p className="text-xs text-content-tertiary">
              Reference data passed to the judge as {"<reference_data>"}. Supports templates: {"{{entity.query(...)}}"}, {"{{format_teacher_schedule({})}}"}, {"{{entityTypes}}"}, etc.
            </p>
          </div>
        ) : suite.judgeContext ? (
          <pre className="rounded-md border bg-background-secondary px-3 py-2 text-xs font-mono text-content-secondary whitespace-pre-wrap overflow-x-auto">
            {suite.judgeContext}
          </pre>
        ) : (
          <p className="text-xs text-content-tertiary">No judge context configured. Click Edit to add reference data for the judge.</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-content-primary">Cases ({cases.length})</h3>
          <Link
            href={`/agents/${agentId}/evals/${suiteId}/cases/new`}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-content-secondary hover:bg-background-tertiary transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Case
          </Link>
        </div>

        {cases.length === 0 ? (
          <div className="rounded-md border bg-card p-8 text-center">
            <p className="text-sm text-content-secondary">No test cases yet</p>
            <p className="text-xs text-content-tertiary mt-1">Add cases to define what to test</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {cases.map((c: any, idx: number) => (
              <div
                key={c._id}
                className="flex items-center justify-between rounded-md border bg-card px-4 py-3"
              >
                <Link
                  href={`/agents/${agentId}/evals/${suiteId}/cases/${c._id}`}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <span className="text-xs text-content-tertiary font-mono w-5">{idx + 1}</span>
                  <div className="min-w-0">
                    <span className="text-sm text-content-primary">{c.name}</span>
                    <span className="text-xs text-content-tertiary ml-2">{c.turns.length} turn{c.turns.length !== 1 ? "s" : ""}</span>
                  </div>
                  {c.tags && c.tags.length > 0 && (
                    <div className="flex gap-1 ml-2">
                      {c.tags.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRunCase(c._id)}
                    disabled={startingCaseId === c._id}
                    className="rounded p-1 text-content-tertiary hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    {startingCaseId === c._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDeleteCase(c._id)}
                    className="rounded p-1 text-content-tertiary hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Link href={`/agents/${agentId}/evals/${suiteId}/cases/${c._id}`}>
                    <ChevronRight className="h-4 w-4 text-content-tertiary" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-content-primary">Run History</h3>

        {runs.length === 0 ? (
          <div className="rounded-md border bg-card p-8 text-center">
            <p className="text-sm text-content-secondary">No runs yet</p>
            <p className="text-xs text-content-tertiary mt-1">Click &quot;Run Suite&quot; to execute all cases</p>
          </div>
        ) : (
          <div className="rounded-md border bg-card overflow-hidden">
            <table className="w-full">
              <thead className="bg-background-secondary border-b">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">Started</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">Pass Rate</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">Score</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">Duration</th>
                  <th className="px-4 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {runs.map((run: any) => {
                  const config = statusConfig[run.status as keyof typeof statusConfig] || statusConfig.pending
                  const StatusIcon = config.icon
                  const passRate = run.totalCases > 0 ? `${run.passedCases}/${run.totalCases}` : "—"

                  return (
                    <tr key={run._id} className="border-b hover:bg-background-secondary transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${config.color} ${run.status === "running" ? "animate-spin" : ""}`} />
                          <Badge variant={config.badge} className="text-xs capitalize">
                            {run.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-content-secondary">
                        {run.startedAt ? formatTime(run.startedAt) : formatTime(run.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-content-secondary text-right font-mono">
                        {passRate}
                      </td>
                      <td className="px-4 py-3 text-sm text-content-secondary text-right font-mono">
                        {run.overallScore !== undefined ? `${(run.overallScore / 5 * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-content-secondary text-right font-mono">
                        {run.totalDurationMs ? formatDuration(run.totalDurationMs) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/agents/${agentId}/evals/${suiteId}/runs/${run._id}`}>
                          <ChevronRight className="h-4 w-4 text-content-tertiary" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
