import { Hono } from "hono"
import { cors } from "hono/cors"
import { bodyLimit } from "hono/body-limit"
import { serve } from "@hono/node-server"

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : []

const app = new Hono()

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null
      if (
        origin.endsWith(".struere.dev") ||
        origin.endsWith(".convex.cloud") ||
        origin.endsWith(".convex.site")
      ) {
        return origin
      }
      if (ALLOWED_ORIGINS.includes(origin)) return origin
      return null
    },
    allowMethods: ["GET", "POST"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 86400,
  })
)

app.use("*", bodyLimit({ maxSize: 1024 * 1024 }))

interface ToolCallbackIdentity {
  organizationId: string
  actorId: string
  actorType: string
  isOrgAdmin?: boolean
  environment: string
  agentId?: string
  conversationId?: string
  depth?: number
  callerAgentSlug?: string
}

function buildStruereSDK(callbackUrl: string, callbackToken: string, identity: ToolCallbackIdentity) {
  const callTool = async (toolName: string, toolArgs: Record<string, unknown>) => {
    const res = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${callbackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ toolName, args: toolArgs, identity }),
    })
    const data = await res.json() as { result?: unknown; error?: string }
    if (data.error) throw new Error(data.error)
    return data.result
  }

  return {
    entity: {
      create: (args: Record<string, unknown>) => callTool("entity.create", args),
      get: (args: Record<string, unknown>) => callTool("entity.get", args),
      query: (args: Record<string, unknown>) => callTool("entity.query", args),
      update: (args: Record<string, unknown>) => callTool("entity.update", args),
      delete: (args: Record<string, unknown>) => callTool("entity.delete", args),
    },
    event: {
      emit: (args: Record<string, unknown>) => callTool("event.emit", args),
      query: (args: Record<string, unknown>) => callTool("event.query", args),
    },
    whatsapp: {
      send: (args: Record<string, unknown>) => callTool("whatsapp.send", args),
      sendTemplate: (args: Record<string, unknown>) => callTool("whatsapp.sendTemplate", args),
      sendInteractive: (args: Record<string, unknown>) => callTool("whatsapp.sendInteractive", args),
      sendMedia: (args: Record<string, unknown>) => callTool("whatsapp.sendMedia", args),
      listTemplates: (args: Record<string, unknown>) => callTool("whatsapp.listTemplates", args),
      getConversation: (args: Record<string, unknown>) => callTool("whatsapp.getConversation", args),
      getStatus: (args: Record<string, unknown>) => callTool("whatsapp.getStatus", args),
    },
    calendar: {
      list: (args: Record<string, unknown>) => callTool("calendar.list", args),
      create: (args: Record<string, unknown>) => callTool("calendar.create", args),
      update: (args: Record<string, unknown>) => callTool("calendar.update", args),
      delete: (args: Record<string, unknown>) => callTool("calendar.delete", args),
      freeBusy: (args: Record<string, unknown>) => callTool("calendar.freeBusy", args),
    },
    airtable: {
      listBases: (args: Record<string, unknown>) => callTool("airtable.listBases", args),
      listTables: (args: Record<string, unknown>) => callTool("airtable.listTables", args),
      listRecords: (args: Record<string, unknown>) => callTool("airtable.listRecords", args),
      getRecord: (args: Record<string, unknown>) => callTool("airtable.getRecord", args),
      createRecords: (args: Record<string, unknown>) => callTool("airtable.createRecords", args),
      updateRecords: (args: Record<string, unknown>) => callTool("airtable.updateRecords", args),
      deleteRecords: (args: Record<string, unknown>) => callTool("airtable.deleteRecords", args),
    },
    email: {
      send: (args: Record<string, unknown>) => callTool("email.send", args),
    },
    payment: {
      create: (args: Record<string, unknown>) => callTool("payment.create", args),
      getStatus: (args: Record<string, unknown>) => callTool("payment.getStatus", args),
    },
    agent: {
      chat: (args: Record<string, unknown>) => callTool("agent.chat", args),
    },
    web: {
      search: (args: Record<string, unknown>) => callTool("web.search", args),
      fetch: (args: Record<string, unknown>) => callTool("web.fetch", args),
    },
  }
}

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "tool-executor", timestamp: Date.now() })
})

app.post("/execute", async (c) => {
  const auth = c.req.header("Authorization")
  const expectedAuth = `Bearer ${process.env.TOOL_EXECUTOR_SECRET}`

  if (auth !== expectedAuth) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const body = await c.req.json<{
    handlerCode: string
    args: Record<string, unknown>
    context?: Record<string, unknown>
    callbackUrl?: string
    callbackToken?: string
    identity?: ToolCallbackIdentity
  }>()

  const { handlerCode, args, context, callbackUrl, callbackToken, identity } = body

  if (!handlerCode) {
    return c.json({ error: "handlerCode is required" }, 400)
  }

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

    const wrappedCode = `
      return (async () => {
        ${handlerCode}
      })();
    `

    const handler = new AsyncFunction("args", "context", "struere", "fetch", wrappedCode)

    const allowedDomains = [
      "api.openai.com",
      "api.anthropic.com",
      "api.stripe.com",
      "api.sendgrid.com",
      "api.twilio.com",
      "hooks.slack.com",
      "discord.com",
      "api.github.com",
    ]

    const sandboxedFetch = async (url: string, options?: RequestInit) => {
      const urlObj = new URL(url)
      const isAllowed = allowedDomains.some(
        (domain) =>
          urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
      )

      if (!isAllowed) {
        throw new Error(
          `Fetch to ${urlObj.hostname} is not allowed. Allowed domains: ${allowedDomains.join(", ")}`
        )
      }

      return fetch(url, options)
    }

    const struereSDK = (callbackUrl && callbackToken && identity)
      ? buildStruereSDK(callbackUrl, callbackToken, identity)
      : {}

    const result = await handler(args, context ?? {}, struereSDK, sandboxedFetch)

    return c.json({ result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    console.error("Tool execution error:", {
      message,
      stack: error instanceof Error ? error.stack : undefined,
      handlerCode,
    })

    return c.json({ error: message }, 500)
  }
})

app.post("/validate", async (c) => {
  const auth = c.req.header("Authorization")
  const expectedAuth = `Bearer ${process.env.TOOL_EXECUTOR_SECRET}`

  if (auth !== expectedAuth) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const body = await c.req.json<{ handlerCode: string }>()
  const { handlerCode } = body

  if (!handlerCode) {
    return c.json({ error: "handlerCode is required" }, 400)
  }

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

    const wrappedCode = `
      return (async () => {
        ${handlerCode}
      })();
    `

    new AsyncFunction("args", "context", "struere", "fetch", wrappedCode)

    return c.json({ valid: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Syntax error"
    return c.json({ valid: false, error: message })
  }
})

const port = parseInt(process.env.PORT || "3002")
console.log(`Tool executor listening on port ${port}`)
serve({ fetch: app.fetch, port })
