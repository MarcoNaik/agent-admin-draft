"use client"

import { useQuery, useMutation, useAction, usePaginatedQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

type Environment = "development" | "production"

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

export function useRoles(environment?: Environment) {
  return useQuery(api.roles.list, { environment })
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

export function useCreatePendingAssignment() {
  return useMutation(api.roles.createPendingAssignment)
}

export function useRoleAssignedUsers(roleId: Id<"roles"> | undefined) {
  return useQuery(api.roles.getAssignedUsers, roleId ? { roleId } : "skip")
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

export function useCurrentUserRoles() {
  const currentUser = useCurrentUser()
  return useQuery(
    api.roles.getUserRoles,
    currentUser?._id ? { userId: currentUser._id } : "skip"
  )
}

export function useIntegrationConfig(provider: "whatsapp" | "flow" | "google" | "zoom" | "airtable" | "resend", environment: Environment) {
  return useQuery(api.integrations.getConfig, { provider, environment })
}

export function useIntegrationConfigs(environment: Environment) {
  return useQuery(api.integrations.listConfigs, { environment })
}

export function useUpdateIntegrationConfig() {
  return useMutation(api.integrations.updateConfig)
}

export function useTestIntegrationConnection() {
  return useAction(api.integrations.testConnection)
}

export function useDeleteIntegrationConfig() {
  return useMutation(api.integrations.deleteConfig)
}

export function useSetIntegrationStatus() {
  return useMutation(api.integrations.setConfigStatus)
}

export function useWhatsAppConnections(environment: Environment) {
  return useQuery(api.whatsapp.listConnections, { environment })
}

export function useAddPhoneNumber() {
  return useMutation(api.whatsapp.addPhoneNumber)
}

export function useDisconnectPhoneNumber() {
  return useMutation(api.whatsapp.disconnectPhoneNumber)
}

export function useRemoveConnection() {
  return useMutation(api.whatsapp.removeConnection)
}

export function useSetPhoneAgent() {
  return useMutation(api.whatsapp.setPhoneAgent)
}

export function useUpdatePhoneLabel() {
  return useMutation(api.whatsapp.updatePhoneLabel)
}

export function useEnableWhatsApp() {
  return useMutation(api.whatsapp.enableWhatsApp)
}

export function useDisableWhatsApp() {
  return useMutation(api.whatsapp.disableWhatsApp)
}

export function useWhatsAppMessageStatuses(threadId: Id<"threads"> | null) {
  return useQuery(api.whatsapp.getMessageStatuses, threadId ? { threadId } : "skip")
}

export function useWhatsAppTimeline(threadId: Id<"threads"> | null) {
  return useQuery(api.whatsapp.getWhatsAppTimeline, threadId ? { threadId } : "skip")
}

export function useSendWhatsAppMedia() {
  return useAction(api.whatsappActions.sendMedia)
}

export function useSendWhatsAppInteractive() {
  return useAction(api.whatsappActions.sendInteractive)
}

export function useGenerateUploadUrl() {
  return useMutation(api.whatsapp.generateUploadUrl)
}

export function useListWhatsAppTemplates() {
  return useAction(api.whatsappActions.listTemplates)
}

export function useSendWhatsAppTemplate() {
  return useAction(api.whatsappActions.sendTemplate)
}

export function useCreateWhatsAppTemplate() {
  return useAction(api.whatsappActions.createTemplate)
}

export function useDeleteWhatsAppTemplate() {
  return useAction(api.whatsappActions.deleteTemplate)
}

export function useGetWhatsAppTemplateStatus() {
  return useAction(api.whatsappActions.getTemplateStatus)
}

export function useAgentBySlug(slug: string) {
  return useQuery(api.chat.getAgentBySlug, { slug })
}

export function usePublicAgent(orgSlug: string, agentSlug: string) {
  return useQuery(api.publicChat.getPublicAgent, { orgSlug, agentSlug })
}

export function useSendPublicChat() {
  return useAction(api.publicChat.sendPublicChat)
}

export function usePublicThreadMessages(threadId: Id<"threads"> | null | undefined) {
  return useQuery(api.publicChat.getPublicThreadMessages, threadId ? { threadId } : "skip")
}

export function useReplyToThread() {
  return useAction(api.chat.replyToThread)
}

export function useSendChatMessage() {
  return useAction(api.chat.send)
}

export function useSendChatMessageBySlug() {
  return useAction(api.chat.sendBySlug)
}

export function useEvalStats() {
  return useQuery(api.evals.getEvalStats, { environment: "eval" })
}

export function useEvalSuites(agentId: Id<"agents">) {
  return useQuery(api.evals.listSuites, { agentId, environment: "eval" })
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

export function useTriggers(environment?: Environment) {
  return useQuery(api.triggers.list, { environment })
}

export function useTriggerExecutions(environment?: Environment, triggerSlug?: string, limit?: number) {
  return useQuery(api.triggers.listExecutions, { environment, triggerSlug, limit })
}

export function useTriggerLastRunStatuses(environment?: Environment) {
  return useQuery(api.triggers.getLastRunStatuses, { environment })
}

export function useCalendarConnection(environment?: Environment) {
  return useQuery(api.calendar.getConnection, { environment })
}

export function useCalendarConnections(environment?: Environment) {
  return useQuery(api.calendar.listConnections, { environment })
}

export function useConnectCalendar() {
  return useMutation(api.calendar.connect)
}

export function useDisconnectCalendar() {
  return useMutation(api.calendar.disconnect)
}

export function useSelectCalendar() {
  return useMutation(api.calendar.selectCalendar)
}

export function useListUserCalendars() {
  return useAction(api.calendar.listUserCalendars)
}

export function useVerifyCalendarConnection() {
  return useAction(api.calendar.verifyConnection)
}

export function useProviderConfigs() {
  return useQuery(api.providers.listConfigs, {})
}

export function useProviderConfig(provider: "anthropic" | "openai" | "google" | "xai") {
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

export function useCreditBalance() {
  return useQuery(api.billing.getBalance, {})
}

export function useCreditTransactions(limit?: number) {
  return useQuery(api.billing.getTransactions, { limit })
}

export function useAddCredits() {
  return useMutation(api.billing.addCredits)
}

export function useAdjustBalance() {
  return useMutation(api.billing.adjustBalance)
}

export function useCreateCheckoutSession() {
  return useAction(api.billing.createCheckoutSession)
}

export function useActiveSandboxSession(environment?: Environment) {
  return useQuery(api.sandboxSessions.getActive, { environment: environment ?? "development" })
}

export function useSandboxEvents(sessionId: Id<"sandboxSessions"> | undefined, afterSequence?: number) {
  return useQuery(
    api.sandboxSessions.getEvents,
    sessionId ? { sessionId, afterSequence: afterSequence ?? -1 } : "skip"
  )
}

export function useAppendSandboxEvents() {
  return useMutation(api.sandboxSessions.appendEvents)
}

export function useCleanupSandboxSession() {
  return useMutation(api.sandboxSessions.cleanup)
}

export function useRecordSandboxActivity() {
  return useMutation(api.sandboxSessions.recordActivity)
}

export function useSyncEvents(environment: Environment, limit?: number) {
  return useQuery(api.events.listSyncEvents, { environment, limit })
}
