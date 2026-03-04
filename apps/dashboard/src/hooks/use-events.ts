"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

type Environment = "development" | "production"

export function useEvents(environment?: Environment, entityId?: Id<"entities">, eventType?: string) {
  return useQuery(api.events.list, { environment, entityId, eventType })
}

export function useEntityEvents(entityId: Id<"entities"> | undefined, environment?: Environment) {
  return useQuery(api.events.getByEntity, entityId ? { entityId, environment } : "skip")
}

export function useEventTypes(environment?: Environment) {
  return useQuery(api.events.getEventTypes, { environment })
}

export function useEmitEvent() {
  return useMutation(api.events.emit)
}

export function useSyncEvents(environment: Environment, limit?: number) {
  return useQuery(api.events.listSyncEvents, { environment, limit })
}
