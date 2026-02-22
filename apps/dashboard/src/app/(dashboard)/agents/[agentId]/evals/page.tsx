"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, Plus, Play, FlaskConical, ChevronRight, Database, ChevronDown } from "lucide-react"
import { useEvalSuites, useEvalRuns, useStartEvalRun, useFixtures, useFixtureEntities } from "@/hooks/use-convex-data"
import { Badge } from "@/components/ui/badge"
import { EntityTable } from "@/components/entities/entity-table"
import { formatRelativeTime } from "@/lib/format"
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
        className="flex items-center justify-between rounded-md border bg-card p-4 hover:bg-background-secondary transition-colors ease-out-soft"
      >
        <div className="flex items-center gap-3 min-w-0">
          <FlaskConical className="h-4 w-4 text-content-tertiary shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-content-primary truncate">{suite.name}</div>
            {suite.description && (
              <div className="text-xs text-content-tertiary mt-0.5 truncate">{suite.description}</div>
            )}
            {lastRun && lastRun.startedAt && (
              <div className="text-xs text-content-tertiary mt-0.5">{formatRelativeTime(lastRun.startedAt)}</div>
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
              variant={
                lastRun.status === "completed"
                  ? lastRun.passedCases === lastRun.totalCases ? "success" : "destructive"
                  : "outline"
              }
              className="text-xs font-input"
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
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors ease-out-soft"
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

function FixtureTypeTable({ slug }: { slug: string }) {
  const result = useFixtureEntities(slug)

  if (result === undefined) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-content-tertiary" />
      </div>
    )
  }

  if (!result || result.entities.length === 0) {
    return (
      <div className="py-3 text-xs text-content-tertiary text-center">No entities</div>
    )
  }

  const { entityType, entities } = result
  const mappedType = {
    id: entityType._id,
    name: entityType.name,
    slug: entityType.slug,
    schema: entityType.schema,
    displayConfig: entityType.displayConfig,
  }
  const mappedEntities = entities.map((e: any) => ({
    id: e._id,
    status: e.status ?? "active",
    data: e.data ?? {},
    createdAt: new Date(e._creationTime).toISOString(),
    updatedAt: new Date(e.updatedAt ?? e._creationTime).toISOString(),
  }))

  return <EntityTable entityType={mappedType} entities={mappedEntities} onRowClick={() => {}} />
}

function FixtureCard({ fixture }: { fixture: any }) {
  const [expanded, setExpanded] = useState(false)
  const typeCounts = fixture.entityTypeCounts as Record<string, number> | undefined

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full p-3 text-left hover:bg-background-secondary transition-colors ease-out-soft"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Database className="h-4 w-4 text-content-tertiary shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-content-primary truncate">{fixture.name}</div>
            <div className="text-xs text-content-tertiary mt-0.5">
              {formatRelativeTime(fixture.syncedAt)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {typeCounts && Object.entries(typeCounts).map(([type, count]) => (
            <Badge key={type} variant="secondary" className="text-xs">
              {count} {type}
            </Badge>
          ))}
          {fixture.relationCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {fixture.relationCount} relation{fixture.relationCount !== 1 ? "s" : ""}
            </Badge>
          )}
          <ChevronDown className={`h-4 w-4 text-content-tertiary transition-transform ease-out-soft ${expanded ? "" : "-rotate-90"}`} />
        </div>
      </button>
      {expanded && typeCounts && (
        <div className="border-t divide-y">
          {Object.keys(typeCounts).map((slug) => (
            <div key={slug} className="px-3 py-2">
              <div className="text-xs font-medium text-content-secondary mb-1">{slug}</div>
              <FixtureTypeTable slug={slug} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FixturesSection() {
  const fixtures = useFixtures()
  const [expanded, setExpanded] = useState(true)

  if (fixtures === undefined) return null
  if (fixtures.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left mb-2"
      >
        <ChevronDown className={`h-4 w-4 text-content-tertiary transition-transform ease-out-soft ${expanded ? "" : "-rotate-90"}`} />
        <Database className="h-4 w-4 text-content-tertiary" />
        <span className="text-sm font-medium text-content-secondary">Test Data</span>
        <Badge variant="secondary" className="text-xs">{fixtures.length}</Badge>
      </button>
      {expanded && (
        <div className="space-y-2 ml-6">
          {fixtures.map((fixture: any) => (
            <FixtureCard key={fixture._id} fixture={fixture} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function EvalsPage({ params }: EvalsPageProps) {
  const { agentId } = params
  const suites = useEvalSuites(agentId as Id<"agents">)

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
          <h2 className="text-xl font-semibold font-display text-content-primary">Evals</h2>
          <p className="text-sm text-content-secondary mt-0.5">Evaluate agent behavior with test suites</p>
        </div>
        <Link
          href={`/agents/${agentId}/evals/new`}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors ease-out-soft"
        >
          <Plus className="h-4 w-4" />
          New Suite
        </Link>
      </div>

      <FixturesSection />

      {suites.length === 0 ? (
        <div className="rounded-md border bg-card p-12 text-center">
          <FlaskConical className="h-8 w-8 text-content-tertiary mx-auto mb-3" />
          <p className="text-sm text-content-secondary">No eval suites yet</p>
          <p className="text-xs text-content-tertiary mt-1">Create a suite to start testing your agent</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suites.map((suite: any) => (
            <SuiteRow key={suite._id} suite={suite} agentId={agentId} />
          ))}
        </div>
      )}
    </div>
  )
}
