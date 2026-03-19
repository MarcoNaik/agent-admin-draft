"use client"

import { useQuery, useMutation, usePaginatedQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { useRoleContext } from "@/contexts/role-context"

type Environment = "development" | "production"

export function useEntityTypes(environment?: Environment) {
  return useQuery(api.entityTypes.list, { environment })
}

export function useEntityType(id: Id<"entityTypes">) {
  return useQuery(api.entityTypes.get, { id })
}

export function useEntityTypeBySlug(slug: string, environment?: Environment) {
  return useQuery(api.entityTypes.getBySlug, { slug, environment })
}

export function useCreateEntityType() {
  return useMutation(api.entityTypes.create)
}

export function useUpdateEntityType() {
  return useMutation(api.entityTypes.update)
}

export function useDeleteEntityType() {
  return useMutation(api.entityTypes.remove)
}

export function useEntities(entityTypeSlug: string, environment?: Environment, status?: string) {
  return useQuery(api.entities.list, { entityTypeSlug, environment, status })
}

export function useEntitiesPaginated(entityTypeSlug: string, environment?: Environment, status?: string) {
  return usePaginatedQuery(
    api.entities.listPaginated,
    { entityTypeSlug, environment, status },
    { initialNumItems: 50 }
  )
}

export function useEntity(id: Id<"entities">, environment?: Environment) {
  return useQuery(api.entities.get, { id, environment })
}

export function useEntityWithType(id: Id<"entities"> | undefined, environment?: Environment) {
  return useQuery(api.entities.getWithType, id ? { id, environment } : "skip")
}

export function useSearchEntities(entityTypeSlug: string | undefined, query: string, environment?: Environment) {
  return useQuery(
    api.entities.search,
    query.length > 0 ? { entityTypeSlug, query, environment } : "skip"
  )
}

export function useCreateEntity() {
  return useMutation(api.entities.create)
}

export function useUpdateEntity() {
  return useMutation(api.entities.update)
}

export function useDeleteEntity() {
  return useMutation(api.entities.remove)
}

export function useLinkEntities() {
  return useMutation(api.entities.link)
}

export function useUnlinkEntities() {
  return useMutation(api.entities.unlink)
}

export function useRelatedEntities(entityId: Id<"entities"> | undefined, environment?: Environment, relationType?: string) {
  return useQuery(api.entities.getRelated, entityId ? { entityId, environment, relationType } : "skip")
}

export function useEntitiesByEmail(entityTypeId: Id<"entityTypes"> | undefined, email?: string, environment?: Environment) {
  return useQuery(
    api.entities.searchByEmail,
    entityTypeId ? { entityTypeId, email, environment } : "skip"
  )
}

export function useLinkedEntity(entityTypeId: Id<"entityTypes"> | undefined, userClerkId: string | undefined, environment?: Environment) {
  return useQuery(
    api.entities.getByUserIdField,
    entityTypeId && userClerkId ? { entityTypeId, userClerkId, environment } : "skip"
  )
}

export function useLinkUserToEntity() {
  return useMutation(api.entities.linkUserToEntity)
}

export function useUnlinkUserFromEntity() {
  return useMutation(api.entities.unlinkUserFromEntity)
}

export function useUserCapabilities(environment?: Environment) {
  return useQuery(api.entityTypes.getUserCapabilities, { environment })
}

export function useEntityPermissions(entityTypeSlug: string, environment?: Environment) {
  const { isAdmin } = useRoleContext()
  const capabilities = useUserCapabilities(environment)

  if (isAdmin) return { canCreate: true, canRead: true, canUpdate: true, canDelete: true, isLoading: false }
  if (!capabilities) return { canCreate: false, canRead: false, canUpdate: false, canDelete: false, isLoading: true }

  const cap = capabilities.find((c: any) => c.entityType.slug === entityTypeSlug)
  return {
    canCreate: cap?.actions.includes("create") ?? false,
    canRead: cap?.actions.includes("read") ?? false,
    canUpdate: cap?.actions.includes("update") ?? false,
    canDelete: cap?.actions.includes("delete") ?? false,
    isLoading: false,
  }
}
