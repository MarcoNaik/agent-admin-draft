"use client"

import { useAgents } from "@/hooks/use-convex-data"
import { Card, CardContent } from "@/components/ui/card"
import { AgentsList } from "@/components/agents-list"
import { Loader2 } from "lucide-react"

export default function AgentsPage() {
  const agents = useAgents()

  if (agents === undefined) {
    return (
      <div className="flex w-full flex-col gap-2">
        <div className="w-full">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
          </div>
        </div>
      </div>
    )
  }

  const mappedAgents = agents.map((agent) => ({
    id: agent._id,
    name: agent.name,
    slug: agent.slug,
    description: agent.description,
    createdAt: new Date(agent.createdAt).toISOString(),
  }))

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="w-full">
        <div className="flex flex-col items-center">
          <AgentsList agents={mappedAgents} />
        </div>
      </div>
    </div>
  )
}
