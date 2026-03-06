"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Bot,
  MessageSquare,
  Database,
  Shield,
  Zap,
  Loader2,
  ChevronRight,
  Calendar,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { useAgents, useEntityTypes, useRoles, useThreads, useTriggers } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { useStudio } from "@/contexts/studio-context"
import { AGENT_TEMPLATES } from "@/lib/agent-templates"
import { Doc } from "@convex/_generated/dataModel"
import { OnboardingChecklist } from "@/components/onboarding-checklist"

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
  const { openStudio } = useStudio()
  const searchParams = useSearchParams()
  const router = useRouter()
  const agents = useAgents()
  const entityTypes = useEntityTypes(environment)
  const roles = useRoles(environment)
  const threads = useThreads(undefined, environment)
  const triggers = useTriggers(environment)

  useEffect(() => {
    if (searchParams.get("onboarding") === "true") {
      localStorage.removeItem("struere:checklist-dismissed")
      toast.success("Welcome! Free credits added to get you started — try building an agent with Studio")
      const url = new URL(window.location.href)
      url.searchParams.delete("onboarding")
      router.replace(url.pathname + url.search, { scroll: false })
    }
  }, [searchParams, router])

  if (agents === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-content-tertiary" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6 space-y-8">
      <OnboardingChecklist />
      <section className="space-y-2">
        <h2 className="text-xs font-display font-medium text-content-tertiary uppercase tracking-wider">Agents</h2>
        <div className="space-y-1.5">
          {agents.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-medium text-content-primary">Build your first agent</h3>
                <p className="text-sm text-content-secondary">Choose a template to get started, or describe what you want to build.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AGENT_TEMPLATES.map((template) => {
                  const IconMap: Record<string, React.ComponentType<{ className?: string }>> = {
                    MessageSquare,
                    Calendar,
                    Zap,
                    Sparkles,
                  }
                  const Icon = IconMap[template.icon] || Bot
                  return (
                    <button
                      key={template.id}
                      onClick={() => {
                        if (template.prompt) {
                          router.push(`/?studio=${encodeURIComponent(template.prompt)}`)
                        } else {
                          openStudio()
                        }
                      }}
                      className="flex flex-col items-start gap-2 rounded-lg border border-border/30 bg-background-secondary/50 p-4 text-left hover:bg-background-secondary/80 hover:border-border/50 transition-colors ease-out-soft"
                    >
                      <Icon className="h-5 w-5 text-content-tertiary" />
                      <div>
                        <p className="text-sm font-medium text-content-primary">{template.title}</p>
                        <p className="text-xs text-content-tertiary mt-0.5">{template.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
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
          <StatCard label="Data Types" value={entityTypes?.length} icon={Database} href="/entities" />
          <StatCard label="Roles" value={roles?.length} icon={Shield} href="/roles" />
          <StatCard label="Automations" value={triggers?.length} icon={Zap} href="/triggers" />
        </div>
      </section>
    </div>
  )
}

export default function DashboardHomePage() {
  return <HomeContent />
}
