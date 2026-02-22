"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Bot,
  MessageSquare,
  Database,
  Shield,
  Zap,
  Loader2,
  ChevronRight,
} from "lucide-react"
import { useAgents, useEntityTypes, useRoles, useThreads, useTriggers } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { useCurrentRole } from "@/hooks/use-current-role"
import { Doc } from "@convex/_generated/dataModel"

const roleDefaultRoutes: Record<string, string> = {
  teacher: "/teacher/sessions",
  guardian: "/guardian/sessions",
  member: "/conversations",
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string
  value: number | undefined
  icon: React.ComponentType<{ className?: string }>
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-border/30 bg-background-secondary/50 px-4 py-3 hover:bg-background-secondary/80 hover:border-border/50 transition-colors ease-out-soft backdrop-blur-sm"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-content-tertiary" />
        <span className="text-sm text-content-secondary">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-content-primary tabular-nums">
          {value === undefined ? "\u2014" : value}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-content-tertiary" />
      </div>
    </Link>
  )
}

function AgentRow({ agent }: { agent: Doc<"agents"> }) {
  return (
    <Link
      href={`/agents/${agent._id}`}
      className="flex items-center gap-3 rounded-lg border border-border/30 bg-background-secondary/50 px-4 py-3 hover:bg-background-secondary/80 hover:border-border/50 transition-colors ease-out-soft"
    >
      <Bot className="h-4 w-4 text-content-tertiary shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-content-primary">{agent.name}</span>
        {agent.description && (
          <p className="text-xs text-content-tertiary mt-0.5 line-clamp-1">{agent.description}</p>
        )}
      </div>
      {agent.status === "active" && (
        <span className="h-2 w-2 rounded-full bg-success shrink-0" />
      )}
      <ChevronRight className="h-3.5 w-3.5 text-content-tertiary shrink-0" />
    </Link>
  )
}

function HomeContent() {
  const { environment } = useEnvironment()
  const agents = useAgents()
  const entityTypes = useEntityTypes(environment)
  const roles = useRoles(environment)
  const threads = useThreads(undefined, environment)
  const triggers = useTriggers(environment)

  if (agents === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-content-tertiary" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6 space-y-8">
      <section className="space-y-2">
        <h2 className="text-xs font-display font-medium text-content-tertiary uppercase tracking-wider">Agents</h2>
        <div className="space-y-1.5">
          {agents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/30 py-8 text-center">
              <Bot className="h-5 w-5 mx-auto text-content-tertiary mb-2" />
              <p className="text-sm text-content-tertiary">No agents yet</p>
            </div>
          ) : (
            agents.map((agent: Doc<"agents">) => (
              <AgentRow key={agent._id} agent={agent} />
            ))
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-display font-medium text-content-tertiary uppercase tracking-wider">Overview</h2>
        <div className="space-y-1.5">
          <StatCard label="Conversations" value={threads?.length} icon={MessageSquare} href="/conversations" />
          <StatCard label="Entity Types" value={entityTypes?.length} icon={Database} href="/entities" />
          <StatCard label="Roles" value={roles?.length} icon={Shield} href="/roles" />
          <StatCard label="Triggers" value={triggers?.length} icon={Zap} href="/triggers" />
        </div>
      </section>
    </div>
  )
}

export default function DashboardHomePage() {
  const router = useRouter()
  const { role, isLoading } = useCurrentRole()

  useEffect(() => {
    if (isLoading) return
    const redirect = roleDefaultRoutes[role]
    if (redirect) {
      router.replace(redirect)
    }
  }, [role, isLoading, router])

  if (isLoading || roleDefaultRoutes[role]) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-content-tertiary" />
      </div>
    )
  }

  return <HomeContent />
}
