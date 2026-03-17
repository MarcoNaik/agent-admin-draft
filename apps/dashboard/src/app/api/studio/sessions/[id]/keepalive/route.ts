import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { getConvexClient } from "@/lib/studio/client"
import { extendSandboxTimeout } from "@/lib/studio/e2b"

export async function POST(
  _request: Request,
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
  console.log(`[studio/keepalive] Keepalive request for session ${sessionId}`)

  try {
    const session = await convex.query(api.sandboxSessions.getById, { id: sessionId })
    if (!session) {
      console.log(`[studio/keepalive] Session ${sessionId} not found`)
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    await convex.mutation(api.sandboxSessions.recordActivity, { id: sessionId })

    if (session.sandboxId) {
      await extendSandboxTimeout(session.sandboxId)
    }

    console.log(`[studio/keepalive] Successfully extended session ${sessionId}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`[studio/keepalive] Failed for session ${sessionId}:`, error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
