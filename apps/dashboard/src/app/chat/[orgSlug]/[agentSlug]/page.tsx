"use client"

import { useParams } from "next/navigation"
import { usePublicAgent, useSendPublicChat } from "@/hooks/use-convex-data"
import { ChatInterface } from "@/components/chat/chat-interface"
import { Id } from "@convex/_generated/dataModel"

export default function PublicChatPage() {
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const agentSlug = params.agentSlug as string

  const agent = usePublicAgent(orgSlug, agentSlug)
  const sendPublicChat = useSendPublicChat()

  const sendMessage = async (args: { message: string; threadId?: Id<"threads"> }) => {
    return await sendPublicChat({
      orgSlug,
      agentSlug,
      message: args.message,
      threadId: args.threadId,
    })
  }

  return (
    <ChatInterface
      agent={agent}
      sendMessage={sendMessage}
      orgName={agent?.orgName}
    />
  )
}
