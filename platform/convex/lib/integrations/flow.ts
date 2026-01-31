import { ActionCtx, MutationCtx, QueryCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"

interface FlowConfig {
  apiUrl: string
  apiKey: string
  secretKey: string
  webhookBaseUrl: string
}

interface CreatePaymentLinkParams {
  organizationId: Id<"organizations">
  paymentId: Id<"entities">
  amount: number
  currency: string
  description: string
  customerEmail: string
  returnUrl: string
}

interface CreatePaymentLinkResult {
  paymentLinkUrl: string
  flowOrderId: string
}

interface FlowPaymentStatus {
  flowOrder: number
  status: string
  statusMessage: string
  amount: number
  currency: string
  payer: string
}

export async function getFlowConfig(
  ctx: QueryCtx,
  organizationId: Id<"organizations">
): Promise<FlowConfig> {
  const config = await ctx.db
    .query("integrationConfigs")
    .withIndex("by_org_provider", (q) =>
      q.eq("organizationId", organizationId).eq("provider", "flow")
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

export function signFlowRequest(
  data: Record<string, unknown>,
  secretKey: string
): string {
  const sortedKeys = Object.keys(data).sort()
  const signString = sortedKeys.map((k) => `${k}=${data[k]}`).join("&")

  const encoder = new TextEncoder()
  const keyData = encoder.encode(secretKey)
  const messageData = encoder.encode(signString)

  return computeHmacSha256Sync(keyData, messageData)
}

function computeHmacSha256Sync(key: Uint8Array, message: Uint8Array): string {
  const blockSize = 64
  const outputSize = 32

  let keyBlock = new Uint8Array(blockSize)
  if (key.length > blockSize) {
    keyBlock.set(sha256(key).slice(0, blockSize))
  } else {
    keyBlock.set(key)
  }

  const iPad = new Uint8Array(blockSize)
  const oPad = new Uint8Array(blockSize)
  for (let i = 0; i < blockSize; i++) {
    iPad[i] = keyBlock[i] ^ 0x36
    oPad[i] = keyBlock[i] ^ 0x5c
  }

  const innerData = new Uint8Array(blockSize + message.length)
  innerData.set(iPad)
  innerData.set(message, blockSize)
  const innerHash = sha256(innerData)

  const outerData = new Uint8Array(blockSize + outputSize)
  outerData.set(oPad)
  outerData.set(innerHash, blockSize)
  const outerHash = sha256(outerData)

  return Array.from(outerHash).map((b) => b.toString(16).padStart(2, "0")).join("")
}

function sha256(data: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ])

  let H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ])

  const padded = padMessage(data)
  const blocks = Math.floor(padded.length / 64)

  for (let i = 0; i < blocks; i++) {
    const W = new Uint32Array(64)
    for (let t = 0; t < 16; t++) {
      const offset = i * 64 + t * 4
      W[t] = (padded[offset] << 24) | (padded[offset + 1] << 16) | (padded[offset + 2] << 8) | padded[offset + 3]
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3)
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10)
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = H

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    H[0] = (H[0] + a) >>> 0
    H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0
    H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0
    H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0
    H[7] = (H[7] + h) >>> 0
  }

  const result = new Uint8Array(32)
  for (let i = 0; i < 8; i++) {
    result[i * 4] = (H[i] >>> 24) & 0xff
    result[i * 4 + 1] = (H[i] >>> 16) & 0xff
    result[i * 4 + 2] = (H[i] >>> 8) & 0xff
    result[i * 4 + 3] = H[i] & 0xff
  }
  return result
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0
}

function padMessage(data: Uint8Array): Uint8Array {
  const bitLength = data.length * 8
  const paddingLength = ((448 - (bitLength + 1) % 512) + 512) % 512
  const totalLength = data.length + 1 + Math.floor(paddingLength / 8) + 8
  const padded = new Uint8Array(totalLength)

  padded.set(data)
  padded[data.length] = 0x80

  const view = new DataView(padded.buffer)
  view.setUint32(totalLength - 4, bitLength >>> 0, false)

  return padded
}

export async function createPaymentLink(
  ctx: MutationCtx,
  params: CreatePaymentLinkParams
): Promise<CreatePaymentLinkResult> {
  const config = await getFlowConfig(ctx, params.organizationId)

  const orderData: Record<string, unknown> = {
    apiKey: config.apiKey,
    commerceOrder: params.paymentId.toString(),
    subject: params.description,
    currency: params.currency,
    amount: params.amount,
    email: params.customerEmail,
    urlConfirmation: `${config.webhookBaseUrl}/webhook/flow`,
    urlReturn: params.returnUrl,
  }

  const signature = signFlowRequest(orderData, config.secretKey)

  const formData = new URLSearchParams()
  for (const [key, value] of Object.entries(orderData)) {
    formData.append(key, String(value))
  }
  formData.append("s", signature)

  const response = await fetch(`${config.apiUrl}/payment/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Flow API error: ${error}`)
  }

  const result = await response.json() as { url: string; token: string; flowOrder: number }

  const payment = await ctx.db.get(params.paymentId)
  if (payment) {
    await ctx.db.patch(params.paymentId, {
      data: {
        ...payment.data,
        paymentLinkUrl: result.url + "?token=" + result.token,
        providerReference: result.flowOrder.toString(),
        status: "pending",
      },
      providerReference: result.flowOrder.toString(),
      updatedAt: Date.now(),
    })
  }

  return {
    paymentLinkUrl: result.url + "?token=" + result.token,
    flowOrderId: result.flowOrder.toString(),
  }
}

export async function verifyPaymentStatus(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
  token: string
): Promise<FlowPaymentStatus> {
  const config = await ctx.runQuery(
    (async (ctx: QueryCtx) => {
      return getFlowConfig(ctx, organizationId)
    }) as never,
    {} as never
  ) as FlowConfig

  const params: Record<string, unknown> = {
    apiKey: config.apiKey,
    token,
  }
  const signature = signFlowRequest(params, config.secretKey)

  const formData = new URLSearchParams()
  formData.append("apiKey", config.apiKey)
  formData.append("token", token)
  formData.append("s", signature)

  const response = await fetch(`${config.apiUrl}/payment/getStatus`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Flow API error: ${error}`)
  }

  return await response.json() as FlowPaymentStatus
}

export async function checkFlowOrderStatus(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  flowOrderId: string
): Promise<FlowPaymentStatus> {
  const config = await getFlowConfig(ctx, organizationId)

  const params: Record<string, unknown> = {
    apiKey: config.apiKey,
    flowOrder: flowOrderId,
  }
  const signature = signFlowRequest(params, config.secretKey)

  const formData = new URLSearchParams()
  formData.append("apiKey", config.apiKey)
  formData.append("flowOrder", flowOrderId)
  formData.append("s", signature)

  const response = await fetch(`${config.apiUrl}/payment/getStatusByFlowOrder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Flow API error: ${error}`)
  }

  return await response.json() as FlowPaymentStatus
}
