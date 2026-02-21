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
  return session as typeof session & { sandboxUrl: string; agentSessionId: string; acpServerId: string }
}

let rpcIdCounter = 1

export async function postMessageToSandbox(
  sandboxUrl: string,
  acpServerId: string,
  agentSessionId: string,
  message: string
) {
  const body = {
    jsonrpc: "2.0",
    id: rpcIdCounter++,
    method: "session/prompt",
    params: {
      prompt: [{ type: "text", text: message }],
      sessionId: agentSessionId,
    },
  }

  const res = await fetch(`${sandboxUrl}/v1/acp/${acpServerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Failed to send message to sandbox: ${res.status} ${detail}`)
  }
  return res.json()
}

export async function replyPermissionToSandbox(
  sandboxUrl: string,
  acpServerId: string,
  permissionId: string,
  reply: string
) {
  const body = {
    jsonrpc: "2.0",
    id: rpcIdCounter++,
    method: "permission/reply",
    params: { permissionId, reply },
  }

  const res = await fetch(`${sandboxUrl}/v1/acp/${acpServerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error("Failed to reply to permission request")
  }
}

export async function replyQuestionToSandbox(
  sandboxUrl: string,
  acpServerId: string,
  questionId: string,
  answers: string[][]
) {
  const body = {
    jsonrpc: "2.0",
    id: rpcIdCounter++,
    method: "question/reply",
    params: { questionId, answers },
  }

  const res = await fetch(`${sandboxUrl}/v1/acp/${acpServerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error("Failed to reply to question")
  }
}

export async function rejectQuestionFromSandbox(
  sandboxUrl: string,
  acpServerId: string,
  questionId: string
) {
  const body = {
    jsonrpc: "2.0",
    id: rpcIdCounter++,
    method: "question/reply",
    params: { questionId, reject: true },
  }

  const res = await fetch(`${sandboxUrl}/v1/acp/${acpServerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error("Failed to reject question")
  }
}
