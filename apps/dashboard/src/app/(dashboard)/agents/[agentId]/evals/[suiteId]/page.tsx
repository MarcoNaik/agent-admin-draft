"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loader2,
  Plus,
  Play,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Trash2,
  X,
} from "lucide-react"
import {
  useEvalSuite,
  useEvalCases,
  useEvalRuns,
  useStartEvalRun,
  useDeleteEvalCase,
  useDeleteEvalSuite,
} from "@/hooks/use-convex-data"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { RunStatusBadge } from "@/components/evals/eval-status"
import { formatDuration, formatTime } from "@/lib/format"
import { Id } from "@convex/_generated/dataModel"

interface SuiteDetailPageProps {
  params: { agentId: string; suiteId: string }
}

export default function SuiteDetailPage({ params }: SuiteDetailPageProps) {
  const { agentId, suiteId } = params
  const router = useRouter()
  const suite = useEvalSuite(suiteId as Id<"evalSuites">)
  const cases = useEvalCases(suiteId as Id<"evalSuites">)
  const runs = useEvalRuns(suiteId as Id<"evalSuites">, 100)
  const startRun = useStartEvalRun()
  const deleteCase = useDeleteEvalCase()
  const deleteSuite = useDeleteEvalSuite()
  const [starting, setStarting] = useState(false)
  const [startingCaseId, setStartingCaseId] = useState<Id<"evalCases"> | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set())
  const [runPage, setRunPage] = useState(0)
  const runsPerPage = 10

  const allSelected = useMemo(
    () => cases !== undefined && cases.length > 0 && selectedCases.size === cases.length,
    [cases, selectedCases]
  )

  const toggleCase = (caseId: string) => {
    setSelectedCases((prev) => {
      const next = new Set(prev)
      if (next.has(caseId)) next.delete(caseId)
      else next.add(caseId)
      return next
    })
  }

  const toggleAll = () => {
    if (!cases) return
    if (allSelected) {
      setSelectedCases(new Set())
    } else {
      setSelectedCases(new Set(cases.map((c: any) => c._id)))
    }
  }

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

  const handleRunSelected = async () => {
    if (selectedCases.size === 0) return
    setStarting(true)
    setRunError(null)
    try {
      const caseIds = Array.from(selectedCases) as Id<"evalCases">[]
      const runId = await startRun({ suiteId: suite._id, triggerSource: "dashboard", caseIds })
      setSelectedCases(new Set())
      router.push(`/agents/${agentId}/evals/${suiteId}/runs/${runId}`)
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

  const judgeInfo = [
    suite.judgeModel ? `${suite.judgeModel.provider}/${suite.judgeModel.name}` : null,
    suite.judgeContext ? "Context configured" : null,
    suite.judgePrompt ? "Custom prompt configured" : null,
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/agents/${agentId}/evals`}
            className="rounded-md p-1.5 hover:bg-background-tertiary transition-colors ease-out-soft"
          >
            <ArrowLeft className="h-4 w-4 text-content-secondary" />
          </Link>
          <div>
            <h2 className="text-xl font-semibold font-display text-content-primary">{suite.name}</h2>
            {suite.description && (
              <p className="text-sm text-content-secondary mt-0.5">{suite.description}</p>
            )}
            {judgeInfo.length > 0 && (
              <p className="text-xs text-content-tertiary mt-1">
                Judge: {judgeInfo.join("  ·  ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedCases.size > 0 ? (
            <>
              <span className="text-sm text-content-secondary">{selectedCases.size} selected</span>
              <button
                onClick={toggleAll}
                className="text-xs text-primary hover:text-primary/80 transition-colors ease-out-soft"
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
              <button
                onClick={() => setSelectedCases(new Set())}
                className="rounded-md border p-1.5 text-content-tertiary hover:bg-background-tertiary transition-colors ease-out-soft"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={handleRunSelected}
                disabled={starting}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors ease-out-soft"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Selected ({selectedCases.size})
              </button>
            </>
          ) : (
            <button
              onClick={handleRun}
              disabled={starting || cases.length === 0}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors ease-out-soft"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Suite
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-md border px-2 py-2 text-content-secondary hover:bg-background-tertiary transition-colors ease-out-soft">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleDeleteSuite}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Suite
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {runError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {runError}
        </div>
      )}

      <Tabs defaultValue="cases">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="cases">Cases ({cases.length})</TabsTrigger>
            <TabsTrigger value="runs">Run History ({runs.length})</TabsTrigger>
          </TabsList>
          <Link
            href={`/agents/${agentId}/evals/${suiteId}/cases/new`}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-content-secondary hover:bg-background-tertiary transition-colors ease-out-soft"
          >
            <Plus className="h-3 w-3" />
            Add Case
          </Link>
        </div>

        <TabsContent value="cases" className="space-y-3 mt-4">
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
                  className={`flex items-center justify-between rounded-md border bg-card px-4 py-3 ${selectedCases.has(c._id) ? "border-primary/40 bg-primary/5" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedCases.has(c._id)}
                      onChange={() => toggleCase(c._id)}
                      className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer shrink-0"
                    />
                    <Link
                      href={`/agents/${agentId}/evals/${suiteId}/cases/${c._id}`}
                      className="flex items-center gap-3 min-w-0 flex-1"
                    >
                      <span className="text-xs text-content-tertiary font-input w-5">{idx + 1}</span>
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
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded p-1.5 text-content-tertiary hover:bg-background-tertiary transition-colors ease-out-soft">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleRunCase(c._id)}
                          disabled={startingCaseId === c._id}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Run
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteCase(c._id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Link href={`/agents/${agentId}/evals/${suiteId}/cases/${c._id}`}>
                      <ChevronRight className="h-4 w-4 text-content-tertiary" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs" className="mt-4 space-y-3">
          {runs.length === 0 ? (
            <div className="rounded-md border bg-card p-8 text-center">
              <p className="text-sm text-content-secondary">No runs yet</p>
              <p className="text-xs text-content-tertiary mt-1">Click &quot;Run Suite&quot; to execute all cases</p>
            </div>
          ) : (
            <>
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
                    {runs.slice(runPage * runsPerPage, (runPage + 1) * runsPerPage).map((run: any) => {
                      const passRate = run.totalCases > 0 ? `${run.passedCases}/${run.totalCases}` : "\u2014"

                      return (
                        <tr
                          key={run._id}
                          onClick={() => router.push(`/agents/${agentId}/evals/${suiteId}/runs/${run._id}`)}
                          className="border-b hover:bg-background-secondary transition-colors ease-out-soft cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <RunStatusBadge status={run.status} />
                          </td>
                          <td className="px-4 py-3 text-sm text-content-secondary">
                            {run.startedAt ? formatTime(run.startedAt) : formatTime(run.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-content-secondary text-right font-input">
                            {passRate}
                          </td>
                          <td className="px-4 py-3 text-sm text-content-secondary text-right font-input">
                            {run.overallScore !== undefined ? `${(run.overallScore / 5 * 100).toFixed(0)}%` : "\u2014"}
                          </td>
                          <td className="px-4 py-3 text-sm text-content-secondary text-right font-input">
                            {run.totalDurationMs ? formatDuration(run.totalDurationMs) : "\u2014"}
                          </td>
                          <td className="px-4 py-3">
                            <ChevronRight className="h-4 w-4 text-content-tertiary" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {runs.length > runsPerPage && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-content-tertiary">
                    {runPage * runsPerPage + 1}\u2013{Math.min((runPage + 1) * runsPerPage, runs.length)} of {runs.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setRunPage((p) => p - 1)}
                      disabled={runPage === 0}
                      className="rounded-md border p-1.5 text-content-secondary hover:bg-background-tertiary disabled:opacity-30 transition-colors ease-out-soft"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setRunPage((p) => p + 1)}
                      disabled={(runPage + 1) * runsPerPage >= runs.length}
                      className="rounded-md border p-1.5 text-content-secondary hover:bg-background-tertiary disabled:opacity-30 transition-colors ease-out-soft"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
