"use client"

import { useQuery, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

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
