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
import { useAgents, useAllEvalSuites, useStartEvalRun, useEvalRuns } from "@/hooks/use-convex-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Id } from "@convex/_generated/dataModel"
import { EmptyState } from "@/components/empty-state"

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

function SuiteLastRun({ suiteId }: { suiteId: Id<"evalSuites"> }) {
  const runs = useEvalRuns(suiteId, 1)

  if (runs === undefined) {
    return <div className="h-4 w-16 animate-pulse rounded bg-background-tertiary" />
  }

  if (runs.length === 0) {
    return <span className="text-[11px] text-content-tertiary">No runs</span>
  }

  const lastRun = runs[0]
  const passed = lastRun.status === "completed" && lastRun.passRate !== undefined
  const isPassing = passed && (lastRun.passRate ?? 0) >= 0.8

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
          {lastRun.passRate !== undefined && (
            <span className={cn(
              "text-xs font-medium tabular-nums",
              isPassing ? "text-success" : "text-destructive"
            )}>
              {Math.round(lastRun.passRate * 100)}%
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
            href={`/system/agents/${suite.agentId}/evals/${suite._id}`}
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

      <Link href={`/system/agents/${suite.agentId}/evals/${suite._id}`}>
        <ChevronRight className="h-4 w-4 text-content-tertiary" />
      </Link>
    </div>
  )
}

export default function SystemEvalsPage() {
  const suites = useAllEvalSuites()
  const agents = useAgents()
  const startRun = useStartEvalRun()
  const [search, setSearch] = useState("")
  const [agentFilter, setAgentFilter] = useState<string>("all")
  const [runningId, setRunningId] = useState<string | null>(null)

  const agentMap = useMemo(() => {
    if (!agents) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const agent of agents) {
      map.set(agent._id, agent.name)
    }
    return map
  }, [agents])

  const agentOptions = useMemo(() => {
    if (!suites || !agents) return []
    const agentIds = new Set(suites.map((s: any) => s.agentId as string))
    return agents.filter((a: any) => agentIds.has(a._id))
  }, [suites, agents])

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

  if (suites === undefined || agents === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-display font-semibold text-content-primary">Evals</h1>
          <p className="text-sm text-content-secondary mt-1">
            Evaluation suites across all agents
          </p>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-content-tertiary" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-semibold text-content-primary">Evals</h1>
        <p className="text-sm text-content-secondary mt-1">
          Evaluation suites across all agents
        </p>
      </div>

      {suites.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No eval suites"
          description="Create eval suites for your agents using the CLI to test agent behavior."
          action={{
            label: "Read the docs",
            onClick: () => window.open("https://docs.struere.dev/evals", "_blank"),
          }}
        />
      ) : (
        <>
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
              <p className="text-sm text-content-tertiary">
                No suites matching your filters
              </p>
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
        </>
      )}
    </div>
  )
}
