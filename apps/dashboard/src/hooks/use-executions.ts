"use client"

import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

type Environment = "development" | "production"

export function useExecutions(agentId?: Id<"agents">, environment?: Environment) {
  return useQuery(api.executions.list, { agentId, environment })
}

export function useExecutionStats(agentId?: Id<"agents">, environment?: Environment, since?: number) {
  return useQuery(api.executions.getStats, { agentId, environment, since })
}

export function useUsageByAgent(environment?: Environment, since?: number) {
  return useQuery(api.executions.getUsageByAgent, { environment, since })
}

export function useUsageByModel(environment?: Environment, since?: number) {
  return useQuery(api.executions.getUsageByModel, { environment, since })
}

export function useRecentExecutions(agentId?: Id<"agents">, environment?: Environment, limit?: number) {
  return useQuery(api.executions.getRecent, { agentId, environment, limit })
}

export function useExecutionsByThread(threadId: Id<"threads"> | null) {
  return useQuery(api.executions.getByThread, threadId ? { threadId } : "skip")
}
