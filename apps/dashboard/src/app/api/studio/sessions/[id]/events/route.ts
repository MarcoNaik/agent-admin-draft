import { auth } from "@clerk/nextjs/server"
import { Id } from "@convex/_generated/dataModel"
import { getConvexClient, getSessionForRequest } from "@/lib/studio/client"

export const runtime = "edge"
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

  console.log(`[studio/events] GET sessionId=${sessionId}`)

  let session
  try {
    session = await getSessionForRequest(convex, sessionId)
    console.log(`[studio/events] Session retrieved successfully sessionId=${sessionId}`)
  } catch (error) {
    console.error(`[studio/events] Session retrieval failed sessionId=${sessionId}`, error)
    return new Response("Session not found or not ready", { status: 404 })
  }

  if (!session.acpServerId) {
    return new Response("ACP server not available", { status: 404 })
  }

  const upstreamUrl = `${session.sandboxUrl}/v1/acp/${session.acpServerId}`

  console.log(`[studio/events] Fetching upstream url=${upstreamUrl}`)

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { Accept: "text/event-stream" },
      signal: request.signal,
    })
  } catch {
    return new Response("Failed to connect to sandbox", { status: 502 })
  }

  console.log(`[studio/events] Upstream response status=${upstream.status}`)

  if (!upstream.ok || !upstream.body) {
    return new Response("Failed to connect to sandbox event stream", { status: 502 })
  }

  const encoder = new TextEncoder()
  const keepaliveComment = encoder.encode(":keepalive\n\n")

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader()
      let closed = false
      let keepaliveTimer: ReturnType<typeof setTimeout> | null = null

      const scheduleKeepalive = () => {
        if (closed) return
        if (keepaliveTimer) clearTimeout(keepaliveTimer)
        keepaliveTimer = setTimeout(() => {
          if (closed) return
          try {
            controller.enqueue(keepaliveComment)
          } catch (error) {
            console.error(`[studio/events] Keepalive enqueue failed sessionId=${sessionId}`, error)
            closed = true
            return
          }
          scheduleKeepalive()
        }, KEEPALIVE_INTERVAL_MS)
      }

      scheduleKeepalive()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            console.log(`[studio/events] Stream done sessionId=${sessionId}`)
            break
          }
          controller.enqueue(value)
          scheduleKeepalive()
        }
        controller.close()
      } catch (error) {
        console.error(`[studio/events] Stream read error sessionId=${sessionId}`, error)
        controller.close()
      } finally {
        closed = true
        if (keepaliveTimer) clearTimeout(keepaliveTimer)
      }
    },
    cancel() {
      console.log(`[studio/events] Stream cancelled sessionId=${sessionId}`)
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
