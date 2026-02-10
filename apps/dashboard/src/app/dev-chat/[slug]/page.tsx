"use client"

import { useParams } from "next/navigation"
import { useAgentBySlug, useSendChatMessageBySlug } from "@/hooks/use-convex-data"
import { ChatInterface } from "@/components/chat/chat-interface"
import { Id } from "@convex/_generated/dataModel"

export default function DevChatPage() {
  const params = useParams()
  const slug = params.slug as string

  const agent = useAgentBySlug(slug)
  const sendBySlug = useSendChatMessageBySlug()

  const agentDisplay = agent
    ? { name: agent.name, model: agent.developmentConfig?.model }
    : agent

  const sendMessage = async (args: { message: string; threadId?: Id<"threads"> }) => {
    return await sendBySlug({
      slug,
      message: args.message,
      threadId: args.threadId,
      environment: "development",
    })
  }

  return (
    <ChatInterface
      agent={agentDisplay}
      sendMessage={sendMessage}
      environmentLabel="development"
    />
  )
}
