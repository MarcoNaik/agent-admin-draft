const getGatewayUrl = (): string => {
  const url = process.env.WHATSAPP_GATEWAY_URL
  if (!url) throw new Error("WHATSAPP_GATEWAY_URL not configured")
  return url
}

const getGatewaySecret = (): string => {
  const secret = process.env.WHATSAPP_GATEWAY_SECRET
  if (!secret) throw new Error("WHATSAPP_GATEWAY_SECRET not configured")
  return secret
}

async function gatewayRequest(
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  const url = `${getGatewayUrl()}${path}`
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
    throw new Error(`Gateway error (${response.status}): ${text}`)
  }
  return response
}

export async function connectViaGateway(
  orgId: string,
  method?: "qr" | "pairing_code",
  phoneNumber?: string
): Promise<{ status: string; phoneNumber?: string }> {
  const body: Record<string, unknown> = { orgId }
  if (method) body.method = method
  if (phoneNumber) body.phoneNumber = phoneNumber
  const response = await gatewayRequest("/connect", body)
  return (await response.json()) as { status: string; phoneNumber?: string }
}

export async function disconnectViaGateway(orgId: string): Promise<void> {
  await gatewayRequest("/disconnect", { orgId })
}

export async function sendViaGateway(
  orgId: string,
  to: string,
  text: string
): Promise<{ messageId: string }> {
  const response = await gatewayRequest("/send", { orgId, to, text })
  return (await response.json()) as { messageId: string }
}

