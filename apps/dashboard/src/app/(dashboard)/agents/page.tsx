import { Plus } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AgentsList } from "@/components/agents-list"

export default async function AgentsPage() {
  const token = await getAuthToken()

  let agents: Awaited<ReturnType<typeof api.agents.list>>["agents"] = []
  let error: string | null = null

  try {
    const data = await api.agents.list(token!)
    agents = data.agents
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load agents"
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-muted-foreground">Manage your AI agents</p>
        </div>
        <Link href="/agents/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Agent
          </Button>
        </Link>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <AgentsList agents={agents} />
      )}
    </div>
  )
}
