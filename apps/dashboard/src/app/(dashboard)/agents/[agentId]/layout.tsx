"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useAgentWithConfig } from "@/hooks/use-convex-data"
import { AgentSidebar } from "@/components/agent-sidebar"
import { ChatSidebar } from "@/components/chat-sidebar"
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
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    if (agent) {
      setAgent({
        id: agent._id,
        name: agent.name,
        slug: agent.slug,
        environments: {
          development: agent.developmentConfig ? {
            url: `/chat/${agent.slug}`,
            version: agent.developmentConfig.version,
            deployedAt: new Date(agent.developmentConfig.createdAt).toISOString(),
          } : null,
          production: agent.productionConfig ? {
            url: `/chat/${agent.slug}`,
            version: agent.productionConfig.version,
            deployedAt: new Date(agent.productionConfig.createdAt).toISOString(),
          } : null,
        },
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
    <div className="flex h-full flex-1 overflow-hidden">
      <AgentSidebar agentId={agentId} chatOpen={chatOpen} onChatToggle={() => setChatOpen(!chatOpen)} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
      <ChatSidebar
        agent={agent}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  )
}
