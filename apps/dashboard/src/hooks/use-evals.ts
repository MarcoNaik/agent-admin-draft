"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

export function useEvalStats() {
  return useQuery(api.evals.getEvalStats, { environment: "eval" })
}

export function useEvalSuites(agentId: Id<"agents"> | undefined) {
  return useQuery(api.evals.listSuites, agentId ? { agentId, environment: "eval" } : "skip")
}

export function useEvalSuite(id: Id<"evalSuites"> | undefined) {
  return useQuery(api.evals.getSuite, id ? { id } : "skip")
}

export function useEvalCase(id: Id<"evalCases"> | undefined) {
  return useQuery(api.evals.getCase, id ? { id } : "skip")
}

export function useEvalCases(suiteId: Id<"evalSuites"> | undefined) {
  return useQuery(api.evals.listCases, suiteId ? { suiteId } : "skip")
}

export function useEvalRuns(suiteId: Id<"evalSuites"> | undefined, limit?: number) {
  return useQuery(api.evals.listRuns, suiteId ? { suiteId, limit } : "skip")
}

export function useEvalRun(id: Id<"evalRuns"> | undefined) {
  return useQuery(api.evals.getRun, id ? { id } : "skip")
}

export function useEvalRunResults(runId: Id<"evalRuns"> | undefined) {
  return useQuery(api.evals.getRunResults, runId ? { runId } : "skip")
}

export function useCreateEvalSuite() {
  return useMutation(api.evals.createSuite)
}

export function useUpdateEvalSuite() {
  return useMutation(api.evals.updateSuite)
}

export function useDeleteEvalSuite() {
  return useMutation(api.evals.deleteSuite)
}

export function useCreateEvalCase() {
  return useMutation(api.evals.createCase)
}

export function useUpdateEvalCase() {
  return useMutation(api.evals.updateCase)
}

export function useDeleteEvalCase() {
  return useMutation(api.evals.deleteCase)
}

export function useStartEvalRun() {
  return useMutation(api.evals.startRun)
}

export function useCancelEvalRun() {
  return useMutation(api.evals.cancelRun)
}

export function useReorderEvalCases() {
  return useMutation(api.evals.reorderCases)
}

export function useFixtures() {
  return useQuery(api.evals.listFixtures, {})
}

export function useFixtureEntities(entityTypeSlug: string) {
  return useQuery(api.evals.listFixtureEntities, { entityTypeSlug })
}

export function useAllEvalSuites() {
  return useQuery(api.evals.listAllSuites, { environment: "eval" })
}
