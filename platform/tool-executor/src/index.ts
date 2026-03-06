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
  }>()

  const { handlerCode, args, context } = body

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

    const handler = new AsyncFunction("args", "context", "fetch", wrappedCode)

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

    const result = await handler(args, context ?? {}, sandboxedFetch)

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

    new AsyncFunction("args", "context", "fetch", wrappedCode)

    return c.json({ valid: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Syntax error"
    return c.json({ valid: false, error: message })
  }
})

const port = parseInt(process.env.PORT || "3002")
console.log(`Tool executor listening on port ${port}`)
serve({ fetch: app.fetch, port })
