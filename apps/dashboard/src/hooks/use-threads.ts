"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

type Environment = "development" | "production"

export function useThreads(agentId?: Id<"agents">, environment?: Environment) {
  return useQuery(api.threads.list, { agentId, environment })
}

export function useThreadsWithPreviews(agentId?: Id<"agents">, environment?: Environment) {
  return useQuery(api.threads.listWithPreviews, { agentId, environment })
}

export function useThread(id: Id<"threads">) {
  return useQuery(api.threads.get, { id })
}

export function useThreadWithMessages(id: Id<"threads"> | null | undefined) {
  return useQuery(api.threads.getWithMessages, id ? { id } : "skip")
}

export function useCreateThread() {
  return useMutation(api.threads.create)
}

export function useDeleteThread() {
  return useMutation(api.threads.remove)
}

export function useAddMessage() {
  return useMutation(api.threads.addMessage)
}

export function useSetAgentPaused() {
  return useMutation(api.threads.setAgentPaused)
}
