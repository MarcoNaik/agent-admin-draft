import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { getConvexClient } from "@/lib/studio/client"

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

  try {
    await convex.mutation(api.sandboxSessions.recordActivity, { id: sessionId })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
