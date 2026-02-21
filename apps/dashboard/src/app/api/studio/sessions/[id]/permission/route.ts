import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { Id } from "@convex/_generated/dataModel"
import { getConvexClient, getSessionForRequest, replyPermissionToSandbox } from "@/lib/studio/client"

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
    const { permissionId, reply } = body as { permissionId: string; reply: string }

    if (!permissionId || !reply) {
      return NextResponse.json({ error: "permissionId and reply are required" }, { status: 400 })
    }

    if (!session.acpServerId) {
      return NextResponse.json({ error: "ACP server not available" }, { status: 400 })
    }

    await replyPermissionToSandbox(session.sandboxUrl, session.acpServerId, permissionId, reply)

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
