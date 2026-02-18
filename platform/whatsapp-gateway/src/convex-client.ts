import pino from "pino"

const logger = pino({ name: "convex-client" })

function getConvexUrl(): string {
  const url = process.env.CONVEX_URL
  if (!url) throw new Error("CONVEX_URL environment variable is required")
  return url
}

function getGatewaySecret(): string {
  const secret = process.env.GATEWAY_SECRET
  if (!secret) throw new Error("GATEWAY_SECRET environment variable is required")
  return secret
}

async function postToConvex(path: string, body: Record<string, unknown>): Promise<void> {
  const url = `${getConvexUrl()}${path}`
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Secret": getGatewaySecret(),
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const text = await response.text()
      logger.error({ url, status: response.status, text }, "Convex request failed")
    }
  } catch (error) {
    logger.error({ url, error }, "Convex request error")
  }
}

export async function sendQRToConvex(orgId: string, qrCode: string): Promise<void> {
  await postToConvex("/webhook/whatsapp/qr", { orgId, qrCode })
}

export async function sendStatusToConvex(
  orgId: string,
  status: "disconnected" | "connecting" | "qr_ready" | "pairing_code_ready" | "connected",
  phoneNumber?: string
): Promise<void> {
  await postToConvex("/webhook/whatsapp/status", { orgId, status, phoneNumber })
}

export async function sendPairingCodeToConvex(orgId: string, pairingCode: string): Promise<void> {
  await postToConvex("/webhook/whatsapp/pairing-code", { orgId, pairingCode })
}

export async function sendInboundToConvex(
  orgId: string,
  from: string,
  messageId: string,
  type: string,
  text: string | undefined,
  timestamp: number
): Promise<void> {
  await postToConvex("/webhook/whatsapp/inbound", {
    orgId,
    from,
    messageId,
    type,
    text,
    timestamp,
  })
}
