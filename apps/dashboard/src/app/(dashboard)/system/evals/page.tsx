"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  FlaskConical,
  Loader2,
  Search,
  Bot,
  Play,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Filter,
} from "@/lib/icons"
import { useAgents, useAllEvalSuites, useAllEvalRuns, useStartEvalRun, useEvalRuns } from "@/hooks/use-convex-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RunStatusBadge } from "@/components/evals/eval-status"
import { cn } from "@/lib/utils"
import { formatDuration, formatTime } from "@/lib/format"
import { Id } from "@convex/_generated/dataModel"
import { EmptyState } from "@/components/empty-state"
import { EvalRunDetailSheet } from "../agents/[agentId]/_components/eval-run-detail-sheet"

type StatusFilter = "all" | "running" | "completed" | "failed"

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function AllRunsPanel({
  agentMap,
  suiteMap,
  agentOptions,
}: {
  agentMap: Map<string, string>
  suiteMap: Map<string, string>
  agentOptions: any[]
}) {
  const runs = useAllEvalRuns(100)
  const [agentFilter, setAgentFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [selectedRunId, setSelectedRunId] = useState<Id<"evalRuns"> | undefined>()

  const filteredRuns = useMemo(() => {
    if (!runs) return []
    return runs.filter((run: any) => {
      if (agentFilter !== "all" && run.agentId !== agentFilter) return false
      if (statusFilter !== "all" && run.status !== statusFilter) return false
      return true
    })
  }, [runs, agentFilter, statusFilter])

  if (runs === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-md border bg-card p-8 text-center">
        <p className="text-sm text-content-secondary">No eval runs yet</p>
        <p className="text-xs text-content-tertiary mt-1">Run a suite from any agent to see results here</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agentOptions.map((agent: any) => (
              <SelectItem key={agent._id} value={agent._id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          {(["all", "running", "completed", "failed"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ease-out-soft ${
                statusFilter === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-background-secondary text-content-secondary hover:bg-background-tertiary"
              }`}
            >
              {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <span className="text-xs text-content-tertiary ml-auto">
          {filteredRuns.length} run{filteredRuns.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-background-secondary border-b">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">Agent</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">Suite</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">Started</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">Pass Rate</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">Score</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">Duration</th>
            </tr>
          </thead>
          <tbody>
            {filteredRuns.map((run: any) => {
              const passRate = run.totalCases > 0 ? `${run.passedCases}/${run.totalCases}` : "\u2014"

              return (
                <tr
                  key={run._id}
                  onClick={() => setSelectedRunId(run._id)}
                  className="border-b hover:bg-background-secondary transition-colors ease-out-soft cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/system/agents/${run.agentId}?tab=evals`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-content-primary hover:underline"
                    >
                      {agentMap.get(run.agentId) || "Unknown"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-content-secondary">
                    {suiteMap.get(run.suiteId) || "Unknown"}
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <EvalRunDetailSheet
        open={!!selectedRunId}
        onOpenChange={(open) => { if (!open) setSelectedRunId(undefined) }}
        runId={selectedRunId}
        agentId=""
      />
    </div>
  )
}

function SuiteLastRun({ suiteId }: { suiteId: Id<"evalSuites"> }) {
  const runs = useEvalRuns(suiteId, 1)

  if (runs === undefined) {
    return <div className="h-4 w-16 animate-pulse rounded bg-background-tertiary" />
  }

  if (runs.length === 0) {
    return <span className="text-[11px] text-content-tertiary">No runs</span>
  }

  const lastRun = runs[0]
  const isPassing = lastRun.status === "completed" && lastRun.totalCases > 0 && lastRun.passedCases === lastRun.totalCases

  return (
    <div className="flex items-center gap-2">
      {lastRun.status === "running" ? (
        <Badge variant="default" className="text-[10px] px-1.5 py-0">
          <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
          running
        </Badge>
      ) : lastRun.status === "completed" ? (
        <>
          {isPassing ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          {lastRun.totalCases > 0 && (
            <span className={cn(
              "text-xs font-medium tabular-nums",
              isPassing ? "text-success" : "text-destructive"
            )}>
              {lastRun.passedCases}/{lastRun.totalCases}
            </span>
          )}
        </>
      ) : lastRun.status === "failed" ? (
        <XCircle className="h-4 w-4 text-destructive" />
      ) : null}
      <span className="text-[11px] text-content-tertiary">{timeAgo(lastRun._creationTime)}</span>
    </div>
  )
}

function SuiteRow({
  suite,
  agentName,
  onRun,
  isRunning,
}: {
  suite: any
  agentName: string
  onRun: () => void
  isRunning: boolean
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/30 bg-background-secondary/30 hover:border-border/50 hover:bg-background-secondary/50 transition-colors px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background-tertiary text-content-secondary">
        <FlaskConical className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/system/agents/${suite.agentId}?tab=evals`}
            className="text-sm font-medium text-content-primary hover:underline"
          >
            {suite.name}
          </Link>
          {suite.tags?.map((tag: string) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-1 text-xs text-content-tertiary">
            <Bot className="h-4 w-4" />
            <span>{agentName}</span>
          </div>
          {suite.description && (
            <>
              <span className="text-content-tertiary/30">|</span>
              <span className="text-xs text-content-tertiary line-clamp-1">{suite.description}</span>
            </>
          )}
        </div>
      </div>

      <div className="hidden sm:block shrink-0">
        <SuiteLastRun suiteId={suite._id} />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs shrink-0"
        onClick={onRun}
        disabled={isRunning}
      >
        {isRunning ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Play className="h-4 w-4 mr-1" />
        )}
        Run
      </Button>

      <Link href={`/system/agents/${suite.agentId}?tab=evals`}>
        <ChevronRight className="h-4 w-4 text-content-tertiary" />
      </Link>
    </div>
  )
}

function SuitesPanel({
  agentMap,
  agentOptions,
}: {
  agentMap: Map<string, string>
  agentOptions: any[]
}) {
  const suites = useAllEvalSuites()
  const startRun = useStartEvalRun()
  const [search, setSearch] = useState("")
  const [agentFilter, setAgentFilter] = useState<string>("all")
  const [runningId, setRunningId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!suites) return []
    return suites.filter((s: any) => {
      if (agentFilter !== "all" && s.agentId !== agentFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const name = s.name?.toLowerCase() ?? ""
        const desc = s.description?.toLowerCase() ?? ""
        const agent = agentMap.get(s.agentId)?.toLowerCase() ?? ""
        if (!name.includes(q) && !desc.includes(q) && !agent.includes(q)) return false
      }
      return true
    })
  }, [suites, agentFilter, search, agentMap])

  const handleRun = async (suiteId: Id<"evalSuites">) => {
    setRunningId(suiteId)
    try {
      await startRun({ suiteId, triggerSource: "dashboard" })
    } finally {
      setRunningId(null)
    }
  }

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
        <p className="text-sm text-content-secondary">No eval suites yet</p>
        <p className="text-xs text-content-tertiary mt-1">Create eval suites for your agents using the CLI</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter suites..."
            className="h-8 font-input bg-background-secondary/50 border-border/30 pl-9 text-xs placeholder:text-content-tertiary"
          />
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agentOptions.map((agent: any) => (
              <SelectItem key={agent._id} value={agent._id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-content-tertiary ml-auto">
          {filtered.length} suite{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-content-tertiary">No suites matching your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((suite: any) => (
            <SuiteRow
              key={suite._id}
              suite={suite}
              agentName={agentMap.get(suite.agentId) ?? "Unknown"}
              onRun={() => handleRun(suite._id)}
              isRunning={runningId === suite._id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function SystemEvalsPage() {
  const suites = useAllEvalSuites()
  const agents = useAgents()

  const agentMap = useMemo(() => {
    if (!agents) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const agent of agents) {
      map.set(agent._id, agent.name)
    }
    return map
  }, [agents])

  const suiteMap = useMemo(() => {
    if (!suites) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const suite of suites) {
      map.set(suite._id, suite.name)
    }
    return map
  }, [suites])

  const agentOptions = useMemo(() => {
    if (!suites || !agents) return []
    const agentIds = new Set(suites.map((s: any) => s.agentId as string))
    return agents.filter((a: any) => agentIds.has(a._id))
  }, [suites, agents])

  if (suites === undefined || agents === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-display font-semibold text-content-primary">Evals</h1>
          <p className="text-sm text-content-secondary mt-1">
            Evaluation runs and suites across all agents
          </p>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-content-tertiary" />
        </div>
      </div>
    )
  }

  if (suites.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-display font-semibold text-content-primary">Evals</h1>
          <p className="text-sm text-content-secondary mt-1">
            Evaluation runs and suites across all agents
          </p>
        </div>
        <EmptyState
          icon={FlaskConical}
          title="No eval suites"
          description="Create eval suites for your agents using the CLI to test agent behavior."
          action={{
            label: "Read the docs",
            onClick: () => window.open("https://docs.struere.dev/evals", "_blank"),
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-semibold text-content-primary">Evals</h1>
        <p className="text-sm text-content-secondary mt-1">
          Evaluation runs and suites across all agents
        </p>
      </div>

      <Tabs defaultValue="runs" className="w-full">
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="suites">Suites</TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <AllRunsPanel agentMap={agentMap} suiteMap={suiteMap} agentOptions={agentOptions} />
        </TabsContent>

        <TabsContent value="suites">
          <SuitesPanel agentMap={agentMap} agentOptions={agentOptions} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
