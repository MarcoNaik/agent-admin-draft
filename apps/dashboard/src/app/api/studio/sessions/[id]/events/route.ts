import { auth } from "@clerk/nextjs/server"
import { Id } from "@convex/_generated/dataModel"
import { getConvexClient, getSessionForRequest } from "@/lib/studio/client"

export const dynamic = "force-dynamic"

const KEEPALIVE_INTERVAL_MS = 15_000

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

  const encoder = new TextEncoder()
  const keepaliveComment = encoder.encode(":keepalive\n\n")

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader()
      const keepaliveTimer = setInterval(() => {
        try {
          controller.enqueue(keepaliveComment)
        } catch {
          clearInterval(keepaliveTimer)
        }
      }, KEEPALIVE_INTERVAL_MS)

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }
        controller.close()
      } catch {
        controller.close()
      } finally {
        clearInterval(keepaliveTimer)
      }
    },
    cancel() {
      upstream.body!.cancel()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
