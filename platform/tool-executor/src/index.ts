import { Hono } from "hono"
import { cors } from "hono/cors"

type Bindings = {
  TOOL_EXECUTOR_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use("*", cors())

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: Date.now() })
})

app.post("/execute", async (c) => {
  const auth = c.req.header("Authorization")
  const expectedAuth = `Bearer ${c.env.TOOL_EXECUTOR_SECRET}`

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

    const sandboxedFetch = async (url: string, options?: RequestInit) => {
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
    const stack = error instanceof Error ? error.stack : undefined

    console.error("Tool execution error:", { message, stack, handlerCode })

    return c.json(
      {
        error: message,
        details: stack,
      },
      500
    )
  }
})

app.post("/validate", async (c) => {
  const auth = c.req.header("Authorization")
  const expectedAuth = `Bearer ${c.env.TOOL_EXECUTOR_SECRET}`

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

export default app
