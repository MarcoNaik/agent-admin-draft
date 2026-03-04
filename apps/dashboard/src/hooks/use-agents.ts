"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

export function useAgents() {
  return useQuery(api.agents.list, {})
}

export function useAgent(id: Id<"agents">) {
  return useQuery(api.agents.get, { id })
}

export function useAgentWithConfig(id: Id<"agents">) {
  return useQuery(api.agents.getWithConfig, { id })
}

export function useCreateAgent() {
  return useMutation(api.agents.create)
}

export function useUpdateAgent() {
  return useMutation(api.agents.update)
}

export function useDeleteAgent() {
  return useMutation(api.agents.remove)
}

export function useCompileSystemPrompt() {
  return useAction(api.agents.compileSystemPrompt)
}
