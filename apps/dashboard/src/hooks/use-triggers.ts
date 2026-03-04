"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"

type Environment = "development" | "production"

export function useTriggers(environment?: Environment) {
  return useQuery(api.triggers.list, { environment })
}

export function useTriggerExecutions(environment?: Environment, triggerSlug?: string, limit?: number) {
  return useQuery(api.triggers.listExecutions, { environment, triggerSlug, limit })
}

export function useTriggerLastRunStatuses(environment?: Environment) {
  return useQuery(api.triggers.getLastRunStatuses, { environment })
}

export function useTriggerRuns(environment?: Environment, status?: "pending" | "running" | "completed" | "failed" | "dead", triggerSlug?: string) {
  return useQuery(api.triggers.listRuns, { environment, status, triggerSlug })
}

export function useTriggerRunStats(environment?: Environment) {
  return useQuery(api.triggers.getRunStats, { environment })
}

export function useRetryTriggerRun() {
  return useMutation(api.triggers.retryRun)
}

export function useCancelTriggerRun() {
  return useMutation(api.triggers.cancelRun)
}
