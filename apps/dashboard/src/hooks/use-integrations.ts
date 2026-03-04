"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

type Environment = "development" | "production"

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
