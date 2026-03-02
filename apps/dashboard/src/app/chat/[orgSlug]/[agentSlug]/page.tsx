"use client"

import { useMemo } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { usePublicAgent, useSendPublicChat } from "@/hooks/use-convex-data"
import { ChatInterface } from "@/components/chat/chat-interface"
import { Id } from "@convex/_generated/dataModel"

export default function PublicChatPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const orgSlug = params.orgSlug as string
  const agentSlug = params.agentSlug as string

  const channelParams = useMemo(() => {
    const reserved = new Set(["theme"])
    const result: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      if (!reserved.has(key)) {
        result[key] = value
      }
    })
    return Object.keys(result).length > 0 ? result : undefined
  }, [searchParams])

  const agent = usePublicAgent(orgSlug, agentSlug)
  const sendPublicChat = useSendPublicChat()

  const sendMessage = async (args: { message: string; threadId?: Id<"threads"> }) => {
    return await sendPublicChat({
      orgSlug,
      agentSlug,
      message: args.message,
      threadId: args.threadId,
      channel: "widget" as const,
      channelParams,
    })
  }

  return (
    <ChatInterface
      agent={agent}
      sendMessage={sendMessage}
      orgName={agent?.orgName}
      mode="public"
    />
  )
}
