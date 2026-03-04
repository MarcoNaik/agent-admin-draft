"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

export function useApiKeys() {
  return useQuery(api.apiKeys.list, {})
}

export function useApiKey(id: Id<"apiKeys">) {
  return useQuery(api.apiKeys.get, { id })
}

export function useCreateApiKey() {
  return useMutation(api.apiKeys.create)
}

export function useUpdateApiKey() {
  return useMutation(api.apiKeys.update)
}

export function useDeleteApiKey() {
  return useMutation(api.apiKeys.remove)
}
