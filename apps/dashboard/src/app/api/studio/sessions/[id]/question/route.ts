import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { Id } from "@convex/_generated/dataModel"
import {
  getConvexClient,
  getSessionForRequest,
  replyQuestionToSandbox,
  rejectQuestionFromSandbox,
} from "@/lib/studio/client"

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
    const { questionId, answers, reject } = body as {
      questionId: string
      answers?: string[][]
      reject?: boolean
    }

    if (!questionId) {
      return NextResponse.json({ error: "questionId is required" }, { status: 400 })
    }

    if (reject) {
      await rejectQuestionFromSandbox(session.sandboxUrl, questionId)
    } else if (answers) {
      await replyQuestionToSandbox(session.sandboxUrl, questionId, answers)
    } else {
      return NextResponse.json({ error: "answers or reject is required" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
