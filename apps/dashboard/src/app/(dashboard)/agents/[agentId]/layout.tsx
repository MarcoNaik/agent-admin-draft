import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { api, Agent } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
import { AgentSidebar } from "@/components/agent-sidebar"
import { EnvironmentSelector } from "@/components/environment-selector"

interface AgentLayoutProps {
  children: React.ReactNode
  params: Promise<{ agentId: string }>
}

export default async function AgentLayout({ children, params }: AgentLayoutProps) {
  const { agentId } = await params
  const token = await getAuthToken()

  let agent: Agent | null = null

  try {
    const data = await api.agents.get(token!, agentId)
    agent = data.agent
  } catch {
    agent = null
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-content-secondary">Agent not found</p>
      </div>
    )
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
        <EnvironmentSelector agentId={agent.id} agentSlug={agent.slug} environments={agent.environments} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <AgentSidebar agentId={agentId} />
        <main className="flex-1 overflow-auto bg-background-primary p-6">{children}</main>
      </div>
    </div>
  )
}
