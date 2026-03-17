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
  console.log("[studio/client] getSessionForRequest", {
    sessionId,
    found: !!session,
    sandboxUrl: session?.sandboxUrl,
    agentSessionId: session?.agentSessionId,
    acpServerId: session?.acpServerId,
    status: session?.status,
  })
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

  const url = `${sandboxUrl}/v1/acp/${acpServerId}`
  console.log("[studio/client] postMessageToSandbox request", { url, body })

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error("[studio/client] postMessageToSandbox fetch error", err)
    throw err
  }

  console.log("[studio/client] postMessageToSandbox response status", res.status)

  if (!res.ok) {
    const detail = await res.text().catch((err) => {
      console.error("[studio/client] postMessageToSandbox failed to read error body", err)
      return ""
    })
    console.error("[studio/client] postMessageToSandbox error detail", { status: res.status, detail })
    throw new Error(`Failed to send message to sandbox: ${res.status} ${detail}`)
  }

  const parsed = await res.json()
  console.log("[studio/client] postMessageToSandbox parsed response", parsed)
  return parsed
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

  const url = `${sandboxUrl}/v1/acp/${acpServerId}`
  console.log("[studio/client] replyPermissionToSandbox request", { url, body })

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error("[studio/client] replyPermissionToSandbox fetch error", err)
    throw err
  }

  console.log("[studio/client] replyPermissionToSandbox response status", res.status)

  if (!res.ok) {
    console.error("[studio/client] replyPermissionToSandbox failed", { status: res.status })
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

  const url = `${sandboxUrl}/v1/acp/${acpServerId}`
  console.log("[studio/client] replyQuestionToSandbox request", { url, body })

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error("[studio/client] replyQuestionToSandbox fetch error", err)
    throw err
  }

  console.log("[studio/client] replyQuestionToSandbox response status", res.status)

  if (!res.ok) {
    console.error("[studio/client] replyQuestionToSandbox failed", { status: res.status })
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

  const url = `${sandboxUrl}/v1/acp/${acpServerId}`
  console.log("[studio/client] rejectQuestionFromSandbox request", { url, body })

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error("[studio/client] rejectQuestionFromSandbox fetch error", err)
    throw err
  }

  console.log("[studio/client] rejectQuestionFromSandbox response status", res.status)

  if (!res.ok) {
    console.error("[studio/client] rejectQuestionFromSandbox failed", { status: res.status })
    throw new Error("Failed to reject question")
  }
}
