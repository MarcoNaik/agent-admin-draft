import { auth } from "@clerk/nextjs/server"
import { Plus, MoreHorizontal, ExternalLink } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"

export default async function AgentsPage() {
  const { getToken } = await auth()
  const token = await getToken()

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
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium">No agents yet</h3>
            <p className="mt-1 text-muted-foreground">
              Create your first agent to get started
            </p>
            <Link href="/agents/new">
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Link key={agent.id} href={`/agents/${agent.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {agent.slug}
                      </CardDescription>
                    </div>
                    <Badge variant={agent.status === "active" ? "success" : "secondary"}>
                      {agent.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.description || "No description"}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Updated {formatDate(agent.updatedAt)}</span>
                    {agent.currentVersionId && (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Deployed
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
