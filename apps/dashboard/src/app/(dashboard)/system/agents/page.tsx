"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Bot,
  MessageSquare,
  Calendar,
  Zap,
  Sparkles,
  Loader2,
  ChevronRight,
} from "@/lib/icons"
import { useAgents } from "@/hooks/use-convex-data"
import { useStudio } from "@/contexts/studio-context"
import { AGENT_TEMPLATES } from "@/lib/agent-templates"
import { Doc } from "@convex/_generated/dataModel"
import { CliPromptToggle } from "@/components/cli-prompt-toggle"

function AgentRow({ agent }: { agent: Doc<"agents"> }) {
  return (
    <Link
      href={`/system/agents/${agent._id}`}
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
      <ChevronRight className="h-4 w-4 text-content-tertiary shrink-0" />
    </Link>
  )
}

export default function SystemAgentsPage() {
  const router = useRouter()
  const { openStudio, openStudioWithPrefill } = useStudio()
  const agents = useAgents()

  if (agents === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-content-tertiary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-semibold text-content-primary">Agents</h1>
        <p className="text-sm text-content-secondary mt-1">AI agents in your organization</p>
      </div>

      <div className="space-y-1.5">
        {agents.length === 0 ? (
          <div className="space-y-4">
            <CliPromptToggle />
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
                        openStudioWithPrefill(template.prompt)
                      } else {
                        openStudio()
                      }
                    }}
                    className="flex flex-col items-start gap-2 rounded-lg border border-border/30 bg-background-secondary/50 p-4 text-left hover:bg-background-secondary/80 hover:border-border/50 transition-colors ease-out-soft"
                  >
                    <Icon className="h-4 w-4 text-content-tertiary" />
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
    </div>
  )
}
