"use client"

import { useAgents, useCreateAgent, useDeleteAgent } from "@/hooks/use-convex-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, Trash2, Bot, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Doc } from "@convex/_generated/dataModel"

export function AgentsListRealtime() {
  const agents = useAgents()
  const createAgent = useCreateAgent()
  const deleteAgent = useDeleteAgent()
  const [isCreating, setIsCreating] = useState(false)
  const [newAgentName, setNewAgentName] = useState("")

  const handleCreate = async () => {
    if (!newAgentName.trim()) return
    setIsCreating(true)
    try {
      await createAgent({ name: newAgentName.trim() })
      setNewAgentName("")
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return
    await deleteAgent({ id: id as any })
  }

  if (agents === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="New agent name..."
          value={newAgentName}
          onChange={(e) => setNewAgentName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="max-w-xs"
        />
        <Button onClick={handleCreate} disabled={isCreating || !newAgentName.trim()}>
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create Agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Bot className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No agents yet. Create your first agent above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent: Doc<"agents">) => (
            <Card key={agent._id} className="relative group">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{agent.name}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      agent.status === "active"
                        ? "bg-green-500/10 text-green-500"
                        : agent.status === "paused"
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-red-500/10 text-red-500"
                    }`}
                  >
                    {agent.status}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {agent.description || "No description"}
                </p>
                <div className="flex items-center justify-between">
                  <Link href={`/agents/${agent._id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(agent._id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Slug: {agent.slug}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
