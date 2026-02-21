import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { destroySandbox } from "@/lib/studio/e2b"
import { getConvexClient } from "@/lib/studio/client"

export async function DELETE(
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

  try {
    const session = await convex.query(api.sandboxSessions.getById, {
      id: sessionId,
    })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.sandboxUrl && session.agentSessionId) {
      try {
        const { SandboxAgent } = await import("sandbox-agent")
        const sdk = new SandboxAgent({ baseUrl: session.sandboxUrl })
        await sdk.destroySession(session.agentSessionId)
        await sdk.dispose().catch(() => {})
      } catch {
      }
    }

    if (session.sandboxId) {
      try {
        await destroySandbox(session.sandboxId)
      } catch {
      }
    }

    await convex.mutation(api.sandboxSessions.cleanup, { id: sessionId })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
