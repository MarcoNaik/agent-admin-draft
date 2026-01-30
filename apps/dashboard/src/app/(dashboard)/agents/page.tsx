"use client"

import { useAgents } from "@/hooks/use-convex-data"
import { Doc } from "@convex/_generated/dataModel"
import { Card, CardContent } from "@/components/ui/card"
import { AgentsList } from "@/components/agents-list"
import { Loader2 } from "lucide-react"

export default function AgentsPage() {
  const agents = useAgents()

  if (agents === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center p-6 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  const mappedAgents = agents.map((agent: Doc<"agents">) => ({
    id: agent._id,
    name: agent.name,
    slug: agent.slug,
    description: agent.description,
    createdAt: new Date(agent.createdAt).toISOString(),
  }))

  return (
    <div className="mx-auto w-full max-w-7xl">
      <AgentsList agents={mappedAgents} />
    </div>
  )
}
