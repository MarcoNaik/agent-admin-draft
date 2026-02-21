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

  try {
    const session = await getSessionForRequest(convex, sessionId)
    const body = await request.json()
    const { message } = body as { message: string }

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    await postMessageToSandbox(session.sandboxUrl, session.agentSessionId, message)

    convex.mutation(api.sandboxSessions.recordActivity, { id: sessionId }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
