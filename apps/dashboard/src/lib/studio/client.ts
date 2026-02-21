import { ConvexHttpClient } from "convex/browser"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"

export function getConvexClient(token: string) {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  client.setAuth(token)
  return client
}

export async function getSessionForRequest(
  convex: ConvexHttpClient,
  sessionId: Id<"sandboxSessions">
) {
  const session = await convex.query(api.sandboxSessions.getById, { id: sessionId })
  if (!session) {
    throw new Error("Session not found")
  }
  if (!session.sandboxUrl || !session.agentSessionId) {
    throw new Error("Session not ready")
  }
  return session as typeof session & { sandboxUrl: string; agentSessionId: string }
}

export async function postMessageToSandbox(
  sandboxUrl: string,
  agentSessionId: string,
  message: string
) {
  const res = await fetch(`${sandboxUrl}/opencode/session/${agentSessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    throw new Error("Failed to send message to sandbox")
  }
}

export async function replyPermissionToSandbox(
  sandboxUrl: string,
  permissionId: string,
  reply: string
) {
  const res = await fetch(`${sandboxUrl}/opencode/permission/${permissionId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reply }),
  })
  if (!res.ok) {
    throw new Error("Failed to reply to permission request")
  }
}

export async function replyQuestionToSandbox(
  sandboxUrl: string,
  questionId: string,
  answers: string[][]
) {
  const res = await fetch(`${sandboxUrl}/opencode/question/${questionId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  })
  if (!res.ok) {
    throw new Error("Failed to reply to question")
  }
}

export async function rejectQuestionFromSandbox(
  sandboxUrl: string,
  questionId: string
) {
  const res = await fetch(`${sandboxUrl}/opencode/question/${questionId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reject: true }),
  })
  if (!res.ok) {
    throw new Error("Failed to reject question")
  }
}
