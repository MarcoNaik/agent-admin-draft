"use node"

import { WhatsAppClient } from "@kapso/whatsapp-cloud-api"

const KAPSO_BASE_URL = "https://api.kapso.ai"
const KAPSO_META_PROXY_URL = "https://api.kapso.ai/meta/whatsapp"
const PLATFORM_API_BASE = `${KAPSO_BASE_URL}/platform/v1`

export function getKapsoApiKey(): string {
  const key = process.env.KAPSO_API_KEY
  if (!key) throw new Error("KAPSO_API_KEY not configured")
  return key
}

export function getKapsoWebhookSecret(): string {
  const secret = process.env.KAPSO_WEBHOOK_SECRET
  if (!secret) throw new Error("KAPSO_WEBHOOK_SECRET not configured")
  return secret
}

export function getWhatsAppClient(): WhatsAppClient {
  return new WhatsAppClient({
    baseUrl: KAPSO_META_PROXY_URL,
    kapsoApiKey: getKapsoApiKey(),
  })
}

async function kapsoPlatformRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const url = `${PLATFORM_API_BASE}${path}`
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": getKapsoApiKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Kapso API error (${response.status}): ${text}`)
  }
  return response
}

export async function createKapsoCustomer(
  name: string,
  externalId: string
): Promise<{ id: string }> {
  const response = await kapsoPlatformRequest("POST", "/customers", {
    name,
    external_customer_id: externalId,
  })
  return (await response.json()) as { id: string }
}

export async function createSetupLink(
  kapsoCustomerId: string,
  successUrl: string,
  failureUrl: string
): Promise<{ url: string; id: string }> {
  const response = await kapsoPlatformRequest(
    "POST",
    `/customers/${kapsoCustomerId}/setup_links`,
    {
      success_url: successUrl,
      failure_url: failureUrl,
    }
  )
  return (await response.json()) as { url: string; id: string }
}

export async function registerPhoneWebhook(
  phoneNumberId: string,
  webhookUrl: string,
  secret: string
): Promise<void> {
  await kapsoPlatformRequest(
    "POST",
    `/whatsapp/phone_numbers/${phoneNumberId}/webhooks`,
    {
      url: webhookUrl,
      secret,
    }
  )
}

export async function sendTextMessage(
  phoneNumberId: string,
  to: string,
  text: string
): Promise<{ messageId: string }> {
  const client = getWhatsAppClient()
  const result = await client.messages.sendText({
    phoneNumberId,
    to,
    body: text,
  })
  return { messageId: result.messages[0].id }
}

export async function sendTemplateMessage(
  phoneNumberId: string,
  to: string,
  templateName: string,
  language: string,
  components?: Array<{ type: string; parameters: Array<{ type: string; text?: string }> }>
): Promise<{ messageId: string }> {
  const client = getWhatsAppClient()
  const result = await client.messages.sendTemplate({
    phoneNumberId,
    to,
    template: {
      name: templateName,
      language: { code: language },
      components: components as any,
    },
  })
  return { messageId: result.messages[0].id }
}

export async function verifyKapsoWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody))
  )
  const hexSignature = Array.from(signature)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return hexSignature === signatureHeader
}

export async function listPhoneTemplates(
  phoneNumberId: string
): Promise<unknown> {
  const client = getWhatsAppClient()
  const phoneInfo = await client.request<{ id: string; waba_id?: string }>(
    "GET",
    `/${phoneNumberId}`,
    { query: { fields: "id,waba_id" }, responseType: "json" }
  )
  const wabaId = phoneInfo.waba_id
  if (!wabaId) throw new Error("Could not resolve WABA ID from phone number")
  return await client.templates.list({ businessAccountId: wabaId })
}

export async function sendInteractiveButtons(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  footerText?: string
): Promise<{ messageId: string }> {
  const client = getWhatsAppClient()
  const result = await client.messages.sendInteractiveButtons({
    phoneNumberId,
    to,
    bodyText,
    buttons,
    footerText,
  })
  return { messageId: result.messages[0].id }
}

export async function sendImageMessage(
  phoneNumberId: string,
  to: string,
  image: { id?: string; link?: string; caption?: string }
): Promise<{ messageId: string }> {
  const client = getWhatsAppClient()
  const result = await client.messages.sendImage({
    phoneNumberId,
    to,
    image,
  })
  return { messageId: result.messages[0].id }
}

export async function sendAudioMessage(
  phoneNumberId: string,
  to: string,
  audio: { id?: string; link?: string }
): Promise<{ messageId: string }> {
  const client = getWhatsAppClient()
  const result = await client.messages.sendAudio({
    phoneNumberId,
    to,
    audio,
  })
  return { messageId: result.messages[0].id }
}

export async function downloadMedia(
  mediaId: string,
  phoneNumberId: string
): Promise<{ data: ArrayBuffer; mimeType: string; fileName?: string }> {
  const client = getWhatsAppClient()
  const metadata = await client.media.get({ mediaId, phoneNumberId })
  const data = await client.media.download({ mediaId, phoneNumberId, as: "arrayBuffer" }) as ArrayBuffer
  return {
    data,
    mimeType: (metadata as any).mime_type ?? "application/octet-stream",
    fileName: (metadata as any).file_name,
  }
}

export async function uploadMedia(
  phoneNumberId: string,
  mimeType: string,
  data: Blob
): Promise<{ mediaId: string }> {
  const client = getWhatsAppClient()
  const result = await client.media.upload({
    phoneNumberId,
    type: mimeType,
    file: data,
  })
  return { mediaId: (result as any).id }
}

export async function validateKapsoApiKey(): Promise<boolean> {
  const response = await fetch(`${PLATFORM_API_BASE}/customers?per_page=1`, {
    headers: {
      "X-API-Key": getKapsoApiKey(),
    },
  })
  return response.ok
}
