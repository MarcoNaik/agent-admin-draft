"use client"

import Link from "next/link"
import { ChevronRight, Loader2 } from "lucide-react"
import { useAgent } from "@/hooks/use-convex-data"
import { AgentSidebar } from "@/components/agent-sidebar"
import { EnvironmentSelector } from "@/components/environment-selector"
import { Id } from "@convex/_generated/dataModel"

interface AgentLayoutProps {
  children: React.ReactNode
  params: { agentId: string }
}

export default function AgentLayout({ children, params }: AgentLayoutProps) {
  const { agentId } = params
  const agent = useAgent(agentId as Id<"agents">)

  if (agent === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-content-secondary">Agent not found</p>
      </div>
    )
  }

  const environments = {
    development: agent.developmentConfigId ? {
      url: `https://${agent.slug}-dev.struere.dev`,
      version: "dev",
      deployedAt: new Date(agent.updatedAt).toISOString(),
    } : null,
    production: agent.productionConfigId ? {
      url: `https://${agent.slug}.struere.dev`,
      version: "prod",
      deployedAt: new Date(agent.updatedAt).toISOString(),
    } : null,
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b bg-background-secondary px-6 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/agents" className="text-content-secondary hover:text-content-primary">
            Agents
          </Link>
          <ChevronRight className="h-4 w-4 text-content-tertiary" />
          <span className="font-medium text-content-primary">{agent.name}</span>
        </div>
        <EnvironmentSelector agentId={agent._id} agentSlug={agent.slug} environments={environments} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <AgentSidebar agentId={agentId} />
        <main className="flex-1 overflow-auto bg-background-primary p-6">{children}</main>
      </div>
    </div>
  )
}
