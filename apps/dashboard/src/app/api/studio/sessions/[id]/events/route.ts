import { auth } from "@clerk/nextjs/server"
import { Id } from "@convex/_generated/dataModel"
import { getConvexClient, getSessionForRequest } from "@/lib/studio/client"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { getToken } = await auth()
  const token = await getToken({ template: "convex" })
  if (!token) {
    return new Response("Unauthorized", { status: 401 })
  }

  const convex = getConvexClient(token)
  const { id } = await params
  const sessionId = id as Id<"sandboxSessions">

  let session
  try {
    session = await getSessionForRequest(convex, sessionId)
  } catch {
    return new Response("Session not found or not ready", { status: 404 })
  }

  if (!session.acpServerId) {
    return new Response("ACP server not available", { status: 404 })
  }

  const upstreamUrl = `${session.sandboxUrl}/v1/acp/${session.acpServerId}`

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { Accept: "text/event-stream" },
      signal: request.signal,
    })
  } catch {
    return new Response("Failed to connect to sandbox", { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("Failed to connect to sandbox event stream", { status: 502 })
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
