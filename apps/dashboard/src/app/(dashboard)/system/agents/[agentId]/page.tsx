"use client"

import { Loader2 } from "@/lib/icons"
import { useAgentWithConfig, useExecutionStats, useCurrentOrganization } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Id } from "@convex/_generated/dataModel"
import { AgentHeader } from "./_components/agent-header"
import { AgentConfigTab } from "./_components/agent-config-tab"
import { AgentToolsTab } from "./_components/agent-tools-tab"
import { AgentLogsTab } from "./_components/agent-logs-tab"
import { EvalsTab } from "./_components/evals-tab"

export default function AgentDetailPage({ params }: { params: { agentId: string } }) {
  const { agentId } = params
  const { environment } = useEnvironment()
  const org = useCurrentOrganization()
  const agent = useAgentWithConfig(agentId as Id<"agents">)
  const stats = useExecutionStats(agentId as Id<"agents">, environment)

  const config = environment === "production"
    ? agent?.productionConfig
    : agent?.developmentConfig

  if (agent === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
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

  const isDeployed = !!config
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const chatUrl = environment === "production"
    ? `${origin}/chat/${org?.slug ?? "..."}/${agent.slug}`
    : `${origin}/dev-chat/${agent.slug}`
  const apiEndpoint = `${process.env.NEXT_PUBLIC_CONVEX_URL}/v1/agents/${agent.slug}/chat`

  const totalExecutions = stats?.total ?? 0
  const toolCount = config?.tools?.length ?? 0

  if (!isDeployed) {
    return (
      <div className="space-y-6">
        <AgentHeader
          agent={agent}
          config={config}
          stats={stats ?? null}
          chatUrl={chatUrl}
          apiEndpoint={apiEndpoint}
          environment={environment}
        />
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-content-secondary mb-3">
            {environment === "production"
              ? "Deploy your agent to production to make it available at the endpoint above."
              : "Sync your agent configuration to see it here."}
          </p>
          <code className="inline-block rounded bg-background-tertiary px-3 py-1.5 text-sm font-mono text-content-primary">
            {environment === "production" ? "struere deploy" : "struere dev"}
          </code>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <AgentHeader
        agent={agent}
        config={config}
        stats={stats ?? null}
        chatUrl={chatUrl}
        apiEndpoint={apiEndpoint}
        environment={environment}
      />

      <Tabs defaultValue="config" className="w-full">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="logs">Logs ({totalExecutions})</TabsTrigger>
          <TabsTrigger value="evals">Evals</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <AgentConfigTab
            agentId={agentId}
            config={config}
            environment={environment}
          />
        </TabsContent>

        <TabsContent value="tools">
          <AgentToolsTab config={config} agentId={agentId} environment={environment} />
        </TabsContent>

        <TabsContent value="logs">
          <AgentLogsTab
            agentId={agentId}
            environment={environment}
            totalExecutions={totalExecutions}
          />
        </TabsContent>

        <TabsContent value="evals">
          <EvalsTab
            agentId={agentId as Id<"agents">}
            environment={environment}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
