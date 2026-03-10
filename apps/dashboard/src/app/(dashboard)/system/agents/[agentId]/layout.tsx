"use client"

import { useEffect } from "react"
import { Loader2 } from "@/lib/icons"
import { useAgentWithConfig } from "@/hooks/use-convex-data"
import { useAgentContext } from "@/contexts/agent-context"
import { Id } from "@convex/_generated/dataModel"

interface AgentLayoutProps {
  children: React.ReactNode
  params: { agentId: string }
}

export default function AgentLayout({ children, params }: AgentLayoutProps) {
  const { agentId } = params
  const agent = useAgentWithConfig(agentId as Id<"agents">)
  const { setAgent } = useAgentContext()

  useEffect(() => {
    if (agent) {
      setAgent({
        id: agent._id,
        name: agent.name,
        slug: agent.slug,
      })
    }
    return () => setAgent(null)
  }, [agent, setAgent])

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

  return (
    <main className="overflow-auto h-full p-6">
      {children}
    </main>
  )
}
