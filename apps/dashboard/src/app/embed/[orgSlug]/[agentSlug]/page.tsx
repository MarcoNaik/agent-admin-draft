"use client"

import { useParams, useSearchParams } from "next/navigation"
import { usePublicAgent, useSendPublicChat } from "@/hooks/use-convex-data"
import { ChatInterface } from "@/components/chat/chat-interface"
import { Id } from "@convex/_generated/dataModel"

export default function EmbedChatPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const orgSlug = params.orgSlug as string
  const agentSlug = params.agentSlug as string
  const theme = searchParams.get("theme") ?? "dark"

  const agent = usePublicAgent(orgSlug, agentSlug)
  const sendPublicChat = useSendPublicChat()

  const sendMessage = async (args: { message: string; threadId?: Id<"threads"> }) => {
    const result = await sendPublicChat({
      orgSlug,
      agentSlug,
      message: args.message,
      threadId: args.threadId,
    })

    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({
        type: "struere:message",
        threadId: result.threadId,
        message: result.message,
      }, "*")
    }

    return result
  }

  return (
    <div className={theme === "light" ? "light" : "dark"} style={{ background: "transparent" }}>
      <ChatInterface
        agent={agent}
        sendMessage={sendMessage}
        orgName={agent?.orgName}
        mode="public"
        embedded
      />
    </div>
  )
}
