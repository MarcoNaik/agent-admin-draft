import { Hono } from "hono"
import { serve } from "@hono/node-server"
import pino from "pino"
import { connect, disconnect, getStatus, send, reconnectAll } from "./connection-manager.js"

const logger = pino({ name: "whatsapp-gateway" })

const app = new Hono()

const GATEWAY_SECRET = process.env.GATEWAY_SECRET
if (!GATEWAY_SECRET) {
  throw new Error("GATEWAY_SECRET environment variable is required")
}

function verifySecret(request: Request): boolean {
  const header = request.headers.get("X-Gateway-Secret")
  return header === GATEWAY_SECRET
}

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: Date.now() })
})

app.post("/connect", async (c) => {
  if (!verifySecret(c.req.raw)) {
    return c.json({ error: "Unauthorized" }, 403)
  }
  const { orgId, method, phoneNumber } = await c.req.json<{
    orgId: string
    method?: "qr" | "pairing_code"
    phoneNumber?: string
  }>()
  if (!orgId) {
    return c.json({ error: "orgId is required" }, 400)
  }
  if (method === "pairing_code" && !phoneNumber?.match(/^\d+$/)) {
    return c.json({ error: "phoneNumber with digits only is required for pairing_code method" }, 400)
  }
  await connect(orgId, method ?? "qr", phoneNumber)
  const status = getStatus(orgId)
  return c.json({ success: true, ...status })
})

app.post("/disconnect", async (c) => {
  if (!verifySecret(c.req.raw)) {
    return c.json({ error: "Unauthorized" }, 403)
  }
  const { orgId } = await c.req.json<{ orgId: string }>()
  if (!orgId) {
    return c.json({ error: "orgId is required" }, 400)
  }
  await disconnect(orgId)
  return c.json({ success: true })
})

app.get("/status/:orgId", (c) => {
  if (!verifySecret(c.req.raw)) {
    return c.json({ error: "Unauthorized" }, 403)
  }
  const orgId = c.req.param("orgId")
  const status = getStatus(orgId)
  return c.json(status)
})

app.post("/send", async (c) => {
  if (!verifySecret(c.req.raw)) {
    return c.json({ error: "Unauthorized" }, 403)
  }
  const { orgId, to, text } = await c.req.json<{ orgId: string; to: string; text: string }>()
  if (!orgId || !to || !text) {
    return c.json({ error: "orgId, to, and text are required" }, 400)
  }

  try {
    const result = await send(orgId, to, text)
    return c.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed"
    logger.error({ orgId, to, error: message }, "/send failed")
    return c.json({ error: message }, 500)
  }
})

app.post("/reconnect-all", async (c) => {
  if (!verifySecret(c.req.raw)) {
    return c.json({ error: "Unauthorized" }, 403)
  }
  await reconnectAll()
  return c.json({ success: true })
})

const port = parseInt(process.env.PORT || "3001", 10)

serve({ fetch: app.fetch, port }, () => {
  logger.info({ port }, "WhatsApp Gateway running")
  reconnectAll().catch((err) =>
    logger.error({ err }, "Failed initial reconnect")
  )
})
