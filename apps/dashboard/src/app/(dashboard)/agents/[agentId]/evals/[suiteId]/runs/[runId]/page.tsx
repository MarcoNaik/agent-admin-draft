"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  User,
  Bot,
  Wrench,
  Ban,
  Clock,
  ClipboardCopy,
  Check,
} from "lucide-react"
import {
  useEvalRun,
  useEvalRunResults,
  useEvalCases,
  useCancelEvalRun,
} from "@/hooks/use-convex-data"
import { Badge } from "@/components/ui/badge"
import { Id } from "@convex/_generated/dataModel"

interface RunResultsPageProps {
  params: { agentId: string; suiteId: string; runId: string }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function AssertionBadge({ result }: { result: { type: string; passed: boolean; score?: number; reason?: string; criteria?: string } }) {
  return (
    <div className={`flex items-start gap-2 rounded-md border p-2.5 text-xs ${
      result.passed
        ? "border-green-500/20 bg-green-500/5"
        : "border-red-500/20 bg-red-500/5"
    }`}>
      {result.passed
        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
        : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
      }
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-content-secondary">{result.type}</span>
          {result.score !== undefined && (
            <Badge variant={result.score >= 3 ? "success" : "destructive"} className="text-xs">
              {result.score}/5
            </Badge>
          )}
        </div>
        {result.criteria && (
          <div className="text-content-tertiary mt-0.5">{result.criteria}</div>
        )}
        {result.reason && (
          <div className="text-content-secondary mt-1">{result.reason}</div>
        )}
      </div>
    </div>
  )
}

function CaseResultRow({ result, caseName }: { result: any; caseName: string }) {
  const [expanded, setExpanded] = useState(false)

  const statusIcon = {
    passed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    error: <AlertCircle className="h-4 w-4 text-amber-500" />,
    running: <Loader2 className="h-4 w-4 text-primary animate-spin" />,
    pending: <Clock className="h-4 w-4 text-content-tertiary" />,
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-background-secondary transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-4 w-4 text-content-tertiary" /> : <ChevronRight className="h-4 w-4 text-content-tertiary" />}
          {statusIcon[result.status as keyof typeof statusIcon] || statusIcon.pending}
          <span className="text-sm font-medium text-content-primary">{caseName}</span>
        </div>
        <div className="flex items-center gap-3">
          {result.overallScore !== undefined && (
            <Badge
              variant={result.overallScore >= 3 ? "success" : "destructive"}
              className="text-xs font-mono"
            >
              {result.overallScore.toFixed(1)}/5
            </Badge>
          )}
          {result.totalDurationMs && (
            <span className="text-xs text-content-tertiary font-mono">{formatDuration(result.totalDurationMs)}</span>
          )}
          <Badge
            variant={result.overallPassed ? "success" : result.status === "error" ? "outline" : "destructive"}
            className="text-xs"
          >
            {result.status}
          </Badge>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-4">
          {result.errorMessage && (
            <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive font-mono">
              {result.errorMessage}
            </div>
          )}

          {result.turnResults && result.turnResults.map((turn: any) => (
            <div key={turn.turnIndex} className="space-y-2">
              <div className="text-xs font-medium text-content-tertiary">Turn {turn.turnIndex + 1}</div>

              <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 mt-0.5 text-content-tertiary shrink-0" />
                  <div className="text-sm text-content-primary whitespace-pre-wrap">{turn.userMessage}</div>
                </div>
              </div>

              {turn.toolCalls && turn.toolCalls.length > 0 && (
                <div className="pl-4 border-l-2 border-amber-500/30 space-y-1.5">
                  {turn.toolCalls.map((tc: any, i: number) => (
                    <div key={i} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs font-mono text-amber-600">{tc.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-md border border-border bg-background-tertiary p-3">
                <div className="flex items-start gap-2">
                  <Bot className="h-4 w-4 mt-0.5 text-content-tertiary shrink-0" />
                  <div className="text-sm text-content-primary whitespace-pre-wrap">{turn.assistantResponse}</div>
                </div>
              </div>

              {turn.agentTokens && (
                <div className="text-xs text-content-tertiary">
                  {formatDuration(turn.durationMs)} · {(turn.agentTokens.input + turn.agentTokens.output).toLocaleString()} tokens
                </div>
              )}

              {turn.assertionResults && turn.assertionResults.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {turn.assertionResults.map((ar: any, i: number) => (
                    <AssertionBadge key={i} result={ar} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {result.finalAssertionResults && result.finalAssertionResults.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <div className="text-xs font-medium text-content-tertiary">Final Assertions</div>
              {result.finalAssertionResults.map((ar: any, i: number) => (
                <AssertionBadge key={i} result={ar} />
              ))}
            </div>
          )}

          {result.judgeTokens && (
            <div className="text-xs text-content-tertiary pt-2 border-t">
              Judge tokens: {(result.judgeTokens.input + result.judgeTokens.output).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function generateRunMarkdown(run: any, results: any[], caseMap: Map<string, any>): string {
  const lines: string[] = []

  lines.push(`# Eval Run Results`)
  lines.push("")
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| **Status** | ${run.status} |`)
  lines.push(`| **Pass Rate** | ${run.totalCases > 0 ? `${run.passedCases}/${run.totalCases}` : "—"} |`)
  lines.push(`| **Score** | ${run.overallScore !== undefined ? `${(run.overallScore / 5 * 100).toFixed(0)}%` : "—"} |`)
  lines.push(`| **Duration** | ${run.totalDurationMs ? formatDuration(run.totalDurationMs) : "—"} |`)
  if (run.totalTokens) {
    lines.push(`| **Tokens** | ${(run.totalTokens.agent + run.totalTokens.judge).toLocaleString()} (Agent: ${run.totalTokens.agent.toLocaleString()}, Judge: ${run.totalTokens.judge.toLocaleString()}) |`)
  } else {
    lines.push(`| **Tokens** | — |`)
  }
  if (run.startedAt) {
    lines.push(`| **Started** | ${new Date(run.startedAt).toLocaleString()} |`)
  }
  if (run.completedAt) {
    lines.push(`| **Completed** | ${new Date(run.completedAt).toLocaleString()} |`)
  }
  lines.push("")

  lines.push(`## Case Results`)
  lines.push("")

  for (const result of results) {
    const evalCase = caseMap.get(result.caseId)
    const caseName = evalCase?.name || "Unknown Case"
    const statusEmoji = result.status === "passed" ? "✅" : result.status === "failed" ? "❌" : result.status === "error" ? "⚠️" : "⏱️"

    lines.push(`### ${statusEmoji} ${caseName}`)
    lines.push("")
    lines.push(`- **Status:** ${result.status}`)
    lines.push(`- **Passed:** ${result.overallPassed ? "Yes" : "No"}`)
    if (result.overallScore !== undefined) {
      lines.push(`- **Score:** ${result.overallScore.toFixed(1)}/5`)
    }
    if (result.totalDurationMs) {
      lines.push(`- **Duration:** ${formatDuration(result.totalDurationMs)}`)
    }
    if (result.judgeTokens) {
      lines.push(`- **Judge Tokens:** ${(result.judgeTokens.input + result.judgeTokens.output).toLocaleString()}`)
    }
    lines.push("")

    if (result.errorMessage) {
      lines.push(`> **Error:** ${result.errorMessage}`)
      lines.push("")
    }

    if (result.turnResults) {
      for (const turn of result.turnResults) {
        lines.push(`#### Turn ${turn.turnIndex + 1}`)
        lines.push("")
        lines.push(`**User:**`)
        lines.push("```")
        lines.push(turn.userMessage)
        lines.push("```")
        lines.push("")

        if (turn.toolCalls && turn.toolCalls.length > 0) {
          lines.push(`**Tool Calls:**`)
          for (const tc of turn.toolCalls) {
            lines.push(`- \`${tc.name}\``)
            if (tc.arguments) {
              lines.push(`  - Args: \`${JSON.stringify(tc.arguments)}\``)
            }
            if (tc.result !== undefined) {
              lines.push(`  - Result: \`${JSON.stringify(tc.result)}\``)
            }
          }
          lines.push("")
        }

        lines.push(`**Assistant:**`)
        lines.push("```")
        lines.push(turn.assistantResponse)
        lines.push("```")
        lines.push("")

        if (turn.agentTokens) {
          lines.push(`*${formatDuration(turn.durationMs)} · ${(turn.agentTokens.input + turn.agentTokens.output).toLocaleString()} tokens*`)
          lines.push("")
        }

        if (turn.assertionResults && turn.assertionResults.length > 0) {
          lines.push(`**Assertions:**`)
          lines.push("")
          lines.push(`| Type | Passed | Score | Criteria | Reason |`)
          lines.push(`|------|--------|-------|----------|--------|`)
          for (const ar of turn.assertionResults) {
            lines.push(`| ${ar.type} | ${ar.passed ? "✅" : "❌"} | ${ar.score !== undefined ? `${ar.score}/5` : "—"} | ${ar.criteria || "—"} | ${ar.reason || "—"} |`)
          }
          lines.push("")
        }
      }
    }

    if (result.finalAssertionResults && result.finalAssertionResults.length > 0) {
      lines.push(`#### Final Assertions`)
      lines.push("")
      lines.push(`| Type | Passed | Score | Criteria | Reason |`)
      lines.push(`|------|--------|-------|----------|--------|`)
      for (const ar of result.finalAssertionResults) {
        lines.push(`| ${ar.type} | ${ar.passed ? "✅" : "❌"} | ${ar.score !== undefined ? `${ar.score}/5` : "—"} | ${ar.criteria || "—"} | ${ar.reason || "—"} |`)
      }
      lines.push("")
    }

    lines.push("---")
    lines.push("")
  }

  return lines.join("\n")
}

export default function RunResultsPage({ params }: RunResultsPageProps) {
  const { agentId, suiteId, runId } = params
  const run = useEvalRun(runId as Id<"evalRuns">)
  const results = useEvalRunResults(runId as Id<"evalRuns">)
  const cases = useEvalCases(suiteId as Id<"evalSuites">)
  const cancelRun = useCancelEvalRun()
  const [copied, setCopied] = useState(false)

  const caseMap = new Map<string, any>((cases || []).map((c: any) => [c._id, c]))

  const handleCopyMarkdown = useCallback(async () => {
    if (!run || !results) return
    const markdown = generateRunMarkdown(run, results, caseMap)
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [run, results, caseMap])

  if (run === undefined || results === undefined || cases === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (!run) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-content-secondary">Run not found</p>
      </div>
    )
  }

  const isRunning = run.status === "pending" || run.status === "running"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/agents/${agentId}/evals/${suiteId}`}
            className="rounded-md p-1.5 hover:bg-background-tertiary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-content-secondary" />
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-content-primary">Run Results</h2>
            <p className="text-sm text-content-secondary mt-0.5">
              {run.status === "running" && (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running... {run.completedCases}/{run.totalCases} cases complete
                </span>
              )}
              {run.status === "completed" && `Completed · ${run.passedCases}/${run.totalCases} passed`}
              {run.status === "failed" && "Run failed"}
              {run.status === "cancelled" && "Run cancelled"}
              {run.status === "pending" && "Pending..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isRunning && (
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-content-secondary hover:bg-background-tertiary transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <ClipboardCopy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy to Markdown"}
            </button>
          )}
          {isRunning && (
            <button
              onClick={() => cancelRun({ id: run._id })}
              className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Ban className="h-4 w-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-md border bg-card p-3">
          <div className="text-xs text-content-tertiary">Status</div>
          <div className="text-lg font-semibold text-content-primary capitalize mt-0.5">{run.status}</div>
        </div>
        <div className="rounded-md border bg-card p-3">
          <div className="text-xs text-content-tertiary">Pass Rate</div>
          <div className="text-lg font-semibold text-content-primary mt-0.5">
            {run.totalCases > 0 ? `${run.passedCases}/${run.totalCases}` : "—"}
          </div>
        </div>
        <div className="rounded-md border bg-card p-3">
          <div className="text-xs text-content-tertiary">Score</div>
          <div className="text-lg font-semibold text-content-primary mt-0.5">
            {run.overallScore !== undefined ? `${(run.overallScore / 5 * 100).toFixed(0)}%` : "—"}
          </div>
        </div>
        <div className="rounded-md border bg-card p-3">
          <div className="text-xs text-content-tertiary">Duration</div>
          <div className="text-lg font-semibold text-content-primary mt-0.5">
            {run.totalDurationMs ? formatDuration(run.totalDurationMs) : "—"}
          </div>
        </div>
        <div className="rounded-md border bg-card p-3">
          <div className="text-xs text-content-tertiary">Tokens</div>
          <div className="text-lg font-semibold text-content-primary mt-0.5">
            {run.totalTokens
              ? (run.totalTokens.agent + run.totalTokens.judge).toLocaleString()
              : "—"
            }
          </div>
          {run.totalTokens && (
            <div className="text-xs text-content-tertiary">
              Agent: {run.totalTokens.agent.toLocaleString()} · Judge: {run.totalTokens.judge.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {results.map((result: any) => {
          const evalCase = caseMap.get(result.caseId)
          return (
            <CaseResultRow
              key={result._id}
              result={result}
              caseName={evalCase?.name || "Unknown Case"}
            />
          )
        })}
      </div>
    </div>
  )
}
