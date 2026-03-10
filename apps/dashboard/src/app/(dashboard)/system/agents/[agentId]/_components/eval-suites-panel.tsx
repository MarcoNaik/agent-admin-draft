"use client"

import { useState } from "react"
import {
  Loader2,
  Plus,
  Play,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Trash2,
  Pencil,
  FlaskConical,
} from "@/lib/icons"
import {
  useEvalSuites,
  useEvalCases,
  useStartEvalRun,
  useDeleteEvalCase,
  useDeleteEvalSuite,
} from "@/hooks/use-convex-data"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Id } from "@convex/_generated/dataModel"
import { EvalSuiteDialog } from "./eval-suite-dialog"
import { EvalCaseSheet } from "./eval-case-sheet"

interface EvalSuitesPanelProps {
  agentId: Id<"agents">
  environment: string
}

function SuiteCard({ suite, agentId, environment }: { suite: any; agentId: Id<"agents">; environment: string }) {
  const cases = useEvalCases(suite._id)
  const startRun = useStartEvalRun()
  const deleteCase = useDeleteEvalCase()
  const deleteSuite = useDeleteEvalSuite()
  const [expanded, setExpanded] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editSuiteOpen, setEditSuiteOpen] = useState(false)
  const [caseSheetOpen, setCaseSheetOpen] = useState(false)
  const [editCaseId, setEditCaseId] = useState<Id<"evalCases"> | undefined>()

  const handleRun = async () => {
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

  const handleDeleteSuite = async () => {
    try {
      await deleteSuite({ id: suite._id })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete suite")
    }
  }

  const handleDeleteCase = async (caseId: Id<"evalCases">) => {
    try {
      await deleteCase({ id: caseId })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete case")
    }
  }

  const handleEditCase = (caseId: Id<"evalCases">) => {
    setEditCaseId(caseId)
    setCaseSheetOpen(true)
  }

  const handleNewCase = () => {
    setEditCaseId(undefined)
    setCaseSheetOpen(true)
  }

  const judgeInfo = [
    suite.judgeModel ? `${suite.judgeModel.provider}/${suite.judgeModel.name}` : null,
  ].filter(Boolean)

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
        >
          {expanded ? <ChevronDown className="h-4 w-4 text-content-tertiary shrink-0" /> : <ChevronRight className="h-4 w-4 text-content-tertiary shrink-0" />}
          <FlaskConical className="h-4 w-4 text-content-tertiary shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-content-primary truncate">{suite.name}</div>
            {suite.description && (
              <div className="text-xs text-content-tertiary mt-0.5 truncate">{suite.description}</div>
            )}
            {judgeInfo.length > 0 && (
              <div className="text-xs text-content-tertiary mt-0.5">Judge: {judgeInfo.join(" · ")}</div>
            )}
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {suite.tags && suite.tags.length > 0 && (
            <div className="flex gap-1">
              {suite.tags.slice(0, 2).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
          <button
            onClick={handleRun}
            disabled={starting || !cases || cases.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors ease-out-soft"
          >
            {starting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Run
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-md border px-2 py-1.5 text-content-secondary hover:bg-background-tertiary transition-colors ease-out-soft">
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditSuiteOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Suite
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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

      {error && (
        <div className="border-t bg-destructive/10 px-4 py-1.5 text-xs text-destructive">
          {error}
        </div>
      )}

      {expanded && (
        <div className="border-t">
          <div className="flex items-center justify-between px-4 py-2 bg-background-secondary">
            <span className="text-xs font-medium text-content-secondary">
              Cases ({cases?.length ?? 0})
            </span>
            <button
              onClick={handleNewCase}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors ease-out-soft"
            >
              <Plus className="h-3 w-3" /> Add Case
            </button>
          </div>

          {cases === undefined ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-content-tertiary" />
            </div>
          ) : cases.length === 0 ? (
            <div className="px-4 py-4 text-center">
              <p className="text-xs text-content-tertiary">No test cases yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {cases.map((c: any, idx: number) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-background-secondary/50 transition-colors ease-out-soft"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
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
                    {c.channel && (
                      <Badge variant="outline" className="text-xs ml-2">{c.channel}</Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded p-1.5 text-content-tertiary hover:bg-background-tertiary transition-colors ease-out-soft">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditCase(c._id)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
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
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <EvalSuiteDialog
        open={editSuiteOpen}
        onOpenChange={setEditSuiteOpen}
        agentId={agentId}
        environment={environment}
        suite={suite}
      />

      <EvalCaseSheet
        open={caseSheetOpen}
        onOpenChange={(open) => { setCaseSheetOpen(open); if (!open) setEditCaseId(undefined) }}
        suiteId={suite._id}
        agentId={agentId}
        caseId={editCaseId}
      />
    </div>
  )
}

export function EvalSuitesPanel({ agentId, environment }: EvalSuitesPanelProps) {
  const suites = useEvalSuites(agentId)

  if (suites === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (suites.length === 0) {
    return (
      <div className="rounded-md border bg-card p-8 text-center">
        <FlaskConical className="h-8 w-8 text-content-tertiary mx-auto mb-3" />
        <p className="text-sm text-content-secondary">No eval suites yet</p>
        <p className="text-xs text-content-tertiary mt-1">Create a suite to start testing your agent</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {suites.map((suite: any) => (
        <SuiteCard key={suite._id} suite={suite} agentId={agentId} environment={environment} />
      ))}
    </div>
  )
}
