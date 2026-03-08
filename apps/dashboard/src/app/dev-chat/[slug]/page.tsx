"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useAgentBySlug, useSendChatMessageBySlug, useCurrentOrganization } from "@/hooks/use-convex-data"
import { ChatInterface } from "@/components/chat/chat-interface"
import { DevChatLayout } from "@/components/dev-chat/dev-chat-layout"
import { Id } from "@convex/_generated/dataModel"

export default function DevChatPage() {
  const params = useParams()
  const slug = params.slug as string
  const [threadId, setThreadId] = useState<Id<"threads"> | null>(null)

  const agent = useAgentBySlug(slug)
  const org = useCurrentOrganization()
  const sendBySlug = useSendChatMessageBySlug()

  const agentDisplay = agent
    ? { name: agent.name, model: agent.developmentConfig?.model, firstMessageSuggestions: agent.developmentConfig?.firstMessageSuggestions }
    : agent

  const sendMessage = async (args: { message: string; threadId?: Id<"threads"> }) => {
    return await sendBySlug({
      slug,
      message: args.message,
      threadId: args.threadId,
      environment: "development",
      channel: "dashboard" as const,
    })
  }

  return (
    <DevChatLayout threadId={threadId} agentId={agent?._id}>
      <ChatInterface
        agent={agentDisplay}
        sendMessage={sendMessage}
        orgName={org?.name}
        environmentLabel="development"
        authenticated
        mode="dev"
        onThreadChange={setThreadId}
      />
    </DevChatLayout>
  )
}
