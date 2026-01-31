"use client"

import { useQuery, useMutation } from "convex/react"
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

export function useDeployAgent() {
  return useMutation(api.agents.deploy)
}

export function useCompileSystemPrompt(
  agentId: Id<"agents">,
  environment: "development" | "production",
  sampleContext?: { message?: string; threadMetadata?: Record<string, unknown> }
) {
  return useQuery(api.agents.compileSystemPrompt, {
    agentId,
    environment,
    sampleContext,
  })
}

export function useEntityTypes() {
  return useQuery(api.entityTypes.list, {})
}

export function useEntityType(id: Id<"entityTypes">) {
  return useQuery(api.entityTypes.get, { id })
}

export function useEntityTypeBySlug(slug: string) {
  return useQuery(api.entityTypes.getBySlug, { slug })
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

export function useEntities(entityTypeSlug: string, status?: string) {
  return useQuery(api.entities.list, { entityTypeSlug, status })
}

export function useEntity(id: Id<"entities">) {
  return useQuery(api.entities.get, { id })
}

export function useEntityWithType(id: Id<"entities"> | undefined) {
  return useQuery(api.entities.getWithType, id ? { id } : "skip")
}

export function useSearchEntities(entityTypeSlug: string | undefined, query: string) {
  return useQuery(
    api.entities.search,
    query.length > 0 ? { entityTypeSlug, query } : "skip"
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

export function useRelatedEntities(entityId: Id<"entities"> | undefined, relationType?: string) {
  return useQuery(api.entities.getRelated, entityId ? { entityId, relationType } : "skip")
}

export function useEvents(entityId?: Id<"entities">, eventType?: string) {
  return useQuery(api.events.list, { entityId, eventType })
}

export function useEntityEvents(entityId: Id<"entities"> | undefined) {
  return useQuery(api.events.getByEntity, entityId ? { entityId } : "skip")
}

export function useEventTypes() {
  return useQuery(api.events.getEventTypes, {})
}

export function useEmitEvent() {
  return useMutation(api.events.emit)
}

export function useJobs(status?: "pending" | "claimed" | "running" | "completed" | "failed" | "dead") {
  return useQuery(api.jobs.list, { status })
}

export function useJob(id: Id<"jobs">) {
  return useQuery(api.jobs.get, { id })
}

export function useJobStats() {
  return useQuery(api.jobs.getStats, {})
}

export function useEnqueueJob() {
  return useMutation(api.jobs.enqueue)
}

export function useRetryJob() {
  return useMutation(api.jobs.retry)
}

export function useCancelJob() {
  return useMutation(api.jobs.cancel)
}

export function useRoles() {
  return useQuery(api.roles.list, {})
}

export function useRole(id: Id<"roles">) {
  return useQuery(api.roles.get, { id })
}

export function useRoleWithPolicies(id: Id<"roles">) {
  return useQuery(api.roles.getWithPolicies, { id })
}

export function useCreateRole() {
  return useMutation(api.roles.create)
}

export function useUpdateRole() {
  return useMutation(api.roles.update)
}

export function useDeleteRole() {
  return useMutation(api.roles.remove)
}

export function useAddPolicy() {
  return useMutation(api.roles.addPolicy)
}

export function useRemovePolicy() {
  return useMutation(api.roles.removePolicy)
}

export function useAssignRoleToUser() {
  return useMutation(api.roles.assignToUser)
}

export function useRemoveRoleFromUser() {
  return useMutation(api.roles.removeFromUser)
}

export function useUserRoles(userId: Id<"users"> | undefined) {
  return useQuery(api.roles.getUserRoles, userId ? { userId } : "skip")
}

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

export function useExecutions(agentId?: Id<"agents">) {
  return useQuery(api.executions.list, { agentId })
}

export function useExecutionStats(agentId?: Id<"agents">, since?: number) {
  return useQuery(api.executions.getStats, { agentId, since })
}

export function useUsageByAgent(since?: number) {
  return useQuery(api.executions.getUsageByAgent, { since })
}

export function useRecentExecutions(agentId?: Id<"agents">, limit?: number) {
  return useQuery(api.executions.getRecent, { agentId, limit })
}

export function useThreads(agentId?: Id<"agents">) {
  return useQuery(api.threads.list, { agentId })
}

export function useThread(id: Id<"threads">) {
  return useQuery(api.threads.get, { id })
}

export function useThreadWithMessages(id: Id<"threads">) {
  return useQuery(api.threads.getWithMessages, { id })
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

export function useUsers() {
  return useQuery(api.users.list, {})
}

export function useUpdateUser() {
  return useMutation(api.users.update)
}

export function useCurrentUser() {
  return useQuery(api.users.getCurrent, {})
}

export function useEnsureUser() {
  return useMutation(api.users.ensureUser)
}

export function useCurrentOrganization() {
  return useQuery(api.organizations.getCurrent, {})
}

export function usePacks() {
  return useQuery(api.packs.list, {})
}

export function usePack(packId: string) {
  return useQuery(api.packs.get, { packId })
}

export function useInstallPack() {
  return useMutation(api.packs.install)
}

export function useUninstallPack() {
  return useMutation(api.packs.uninstall)
}

export function useUpgradePack() {
  return useMutation(api.packs.upgrade)
}

export function usePreviewUpgrade(packId: string | undefined) {
  return useQuery(api.packs.previewUpgrade, packId ? { packId } : "skip")
}

export function useTrackPackCustomization() {
  return useMutation(api.packs.trackCustomization)
}

export function useCurrentUserRoles() {
  const currentUser = useCurrentUser()
  return useQuery(
    api.roles.getUserRoles,
    currentUser?._id ? { userId: currentUser._id } : "skip"
  )
}

export function useIntegrationConfig(provider: "whatsapp" | "flow" | "google" | "zoom") {
  return useQuery(api.integrations.getConfig, { provider })
}

export function useIntegrationConfigs() {
  return useQuery(api.integrations.listConfigs, {})
}

export function useUpdateIntegrationConfig() {
  return useMutation(api.integrations.updateConfig)
}

export function useTestIntegrationConnection() {
  return useMutation(api.integrations.testConnection)
}

export function useDeleteIntegrationConfig() {
  return useMutation(api.integrations.deleteConfig)
}

export function useSetIntegrationStatus() {
  return useMutation(api.integrations.setConfigStatus)
}
