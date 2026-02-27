import { QueryCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"

export interface FlowConfig {
  apiUrl: string
  apiKey: string
  secretKey: string
  webhookBaseUrl: string
  defaultCurrency?: string
  returnUrl?: string
}

export interface FlowPaymentStatus {
  flowOrder: number
  commerceOrder: string
  status: number
  statusMessage: string
  amount: number
  currency: string
  payer: string
}

export async function getFlowConfig(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  environment: "development" | "production" | "eval"
): Promise<FlowConfig> {
  const config = await ctx.db
    .query("integrationConfigs")
    .withIndex("by_org_env_provider", (q) =>
      q.eq("organizationId", organizationId).eq("environment", environment).eq("provider", "flow")
    )
    .first()

  if (!config || config.status !== "active") {
    throw new Error("Flow integration not configured or inactive")
  }

  const configData = config.config as FlowConfig
  if (!configData.apiUrl || !configData.apiKey || !configData.secretKey) {
    throw new Error("Flow configuration is incomplete")
  }

  return configData
}

async function computeHmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const msgData = encoder.encode(message)
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData)
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("")
}

export async function signFlowRequest(
  data: Record<string, unknown>,
  secretKey: string
): Promise<string> {
  const sortedKeys = Object.keys(data).sort()
  const signString = sortedKeys.map((k) => `${k}${data[k]}`).join("")
  return computeHmacSha256(signString, secretKey)
}

export async function createFlowPaymentLinkAction(
  config: FlowConfig,
  params: {
    paymentId: string
    amount: number
    currency: string
    description: string
    customerEmail: string
    returnUrl: string
  }
): Promise<{ url: string; token: string; flowOrder: string }> {
  const orderData: Record<string, unknown> = {
    apiKey: config.apiKey,
    commerceOrder: params.paymentId,
    subject: params.description,
    currency: params.currency,
    amount: params.amount,
    email: params.customerEmail,
    urlConfirmation: `${config.webhookBaseUrl}/webhook/flow`,
    urlReturn: params.returnUrl,
  }

  const signature = await signFlowRequest(orderData, config.secretKey)

  const formData = new URLSearchParams()
  for (const [key, value] of Object.entries(orderData)) {
    formData.append(key, String(value))
  }
  formData.append("s", signature)

  const response = await fetch(`${config.apiUrl}/payment/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Flow API error: ${error}`)
  }

  const result = await response.json() as { url: string; token: string; flowOrder: number }

  return {
    url: result.url + "?token=" + result.token,
    token: result.token,
    flowOrder: result.flowOrder.toString(),
  }
}

export async function checkFlowOrderStatusAction(
  config: FlowConfig,
  flowOrderId: string
): Promise<FlowPaymentStatus> {
  const data: Record<string, unknown> = {
    apiKey: config.apiKey,
    flowOrder: flowOrderId,
  }
  const signature = await signFlowRequest(data, config.secretKey)

  const params = new URLSearchParams()
  params.append("apiKey", config.apiKey)
  params.append("flowOrder", flowOrderId)
  params.append("s", signature)

  const response = await fetch(`${config.apiUrl}/payment/getStatusByFlowOrder?${params.toString()}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Flow API error: ${error}`)
  }

  return await response.json() as FlowPaymentStatus
}

export async function verifyPaymentStatusAction(
  config: FlowConfig,
  token: string
): Promise<FlowPaymentStatus> {
  const data: Record<string, unknown> = {
    apiKey: config.apiKey,
    token,
  }
  const signature = await signFlowRequest(data, config.secretKey)

  const params = new URLSearchParams()
  params.append("apiKey", config.apiKey)
  params.append("token", token)
  params.append("s", signature)

  const response = await fetch(`${config.apiUrl}/payment/getStatus?${params.toString()}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Flow API error: ${error}`)
  }

  return await response.json() as FlowPaymentStatus
}
