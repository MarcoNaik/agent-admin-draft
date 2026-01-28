import { api } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
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
    <div className="flex w-full flex-col gap-2">
      <div className="w-full">
        <div className="flex flex-col items-center">
          {error ? (
            <Card className="w-full">
              <CardContent className="py-8 text-center">
                <p className="text-content-secondary">{error}</p>
              </CardContent>
            </Card>
          ) : (
            <AgentsList agents={agents} />
          )}
        </div>
      </div>
    </div>
  )
}
