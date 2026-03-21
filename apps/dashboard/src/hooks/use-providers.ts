"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"

export function useProviderConfigs() {
  return useQuery(api.providers.listConfigs, {})
}

export function useProviderConfig(provider: "anthropic" | "openai" | "google" | "xai" | "openrouter") {
  return useQuery(api.providers.getConfig, { provider })
}

export function useUpdateProviderConfig() {
  return useMutation(api.providers.updateConfig)
}

export function useDeleteProviderConfig() {
  return useMutation(api.providers.deleteConfig)
}

export function useTestProviderConnection() {
  return useAction(api.providers.testConnection)
}
