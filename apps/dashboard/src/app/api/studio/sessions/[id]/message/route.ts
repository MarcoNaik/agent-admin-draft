import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { Id } from "@convex/_generated/dataModel"
import { api } from "@convex/_generated/api"
import { getConvexClient, getSessionForRequest, postMessageToSandbox } from "@/lib/studio/client"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { getToken } = await auth()
  const token = await getToken({ template: "convex" })
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const convex = getConvexClient(token)
  const { id } = await params
  const sessionId = id as Id<"sandboxSessions">

  const body = await request.json()
  const { message } = body as { message: string }

  console.log(`[studio/message] POST start sessionId=${sessionId} message=${(message ?? "").slice(0, 100)}`)

  try {
    const session = await getSessionForRequest(convex, sessionId)
    console.log(`[studio/message] session state: status=${session.status} agentId=${session.agentId} acpServerId=${session.acpServerId ?? "none"}`)

    if (session.keySource !== "custom") {
      const { balance } = await convex.query(api.billing.getBalance, {})
      console.log(`[studio/message] credits balance=${balance}`)
      if (balance <= 0) {
        return NextResponse.json({ error: "Insufficient credits" }, { status: 402 })
      }
    }

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    if (!session.acpServerId) {
      return NextResponse.json({ error: "ACP server not available" }, { status: 400 })
    }

    const timingStart = Date.now()
    console.log(`[studio/message] postMessageToSandbox start`)
    const response = await postMessageToSandbox(session.sandboxUrl, session.acpServerId, session.agentSessionId, message)
    const timingEnd = Date.now()
    console.log(`[studio/message] postMessageToSandbox end elapsed=${timingEnd - timingStart}ms response=${JSON.stringify(response, null, 2)}`)

    const usage = (response as Record<string, unknown>)?.result as Record<string, unknown> | undefined
    const usageData = usage?.usage as Record<string, number> | undefined
    if (usageData?.inputTokens && usageData?.outputTokens) {
      convex.mutation(api.sandboxSessions.recordUsage, {
        sessionId,
        inputTokens: usageData.inputTokens,
        outputTokens: usageData.outputTokens,
      }).catch((err) => { console.error(`[studio/message] recordUsage failed:`, err) })
    }

    convex.mutation(api.sandboxSessions.recordActivity, { id: sessionId }).catch((err) => { console.error(`[studio/message] recordActivity failed:`, err) })

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[studio/sessions/message] POST failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
