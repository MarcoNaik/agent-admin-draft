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
    customer: {
      name,
      external_customer_id: externalId,
    },
  })
  const json = (await response.json()) as { data: { id: string } }
  return json.data
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
      setup_link: {
        success_redirect_url: successUrl,
        failure_redirect_url: failureUrl,
      },
    }
  )
  const json = (await response.json()) as { data: { url: string; id: string } }
  return json.data
}

export async function registerProjectWebhook(
  webhookUrl: string,
  secret: string
): Promise<void> {
  await kapsoPlatformRequest(
    "POST",
    `/whatsapp/webhooks`,
    {
      whatsapp_webhook: {
        url: webhookUrl,
        secret_key: secret,
        kind: "kapso",
        payload_version: "v2",
        events: [
          "whatsapp.phone_number.created",
          "whatsapp.phone_number.deleted",
        ],
        active: true,
      },
    }
  )
}

export async function deletePhoneNumber(
  phoneNumberId: string
): Promise<void> {
  await kapsoPlatformRequest(
    "DELETE",
    `/whatsapp/phone_numbers/${phoneNumberId}`
  )
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
      whatsapp_webhook: {
        url: webhookUrl,
        secret_key: secret,
        kind: "kapso",
        payload_version: "v2",
        events: [
          "whatsapp.message.received",
          "whatsapp.message.sent",
          "whatsapp.message.delivered",
          "whatsapp.message.read",
          "whatsapp.message.failed",
        ],
        active: true,
      },
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

export async function resolveWabaId(phoneNumberId: string): Promise<string> {
  const response = await kapsoPlatformRequest(
    "GET",
    `/whatsapp/phone_numbers?phone_number_id=${encodeURIComponent(phoneNumberId)}`
  )
  const json = (await response.json()) as { data: Array<{ business_account_id?: string }> }
  const wabaId = json.data?.[0]?.business_account_id
  if (!wabaId) throw new Error("Could not resolve WABA ID from phone number")
  return wabaId
}

async function metaProxyFetch(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const url = `${KAPSO_META_PROXY_URL}/v24.0/${path}`
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
    throw new Error(`Meta proxy error (${response.status}): ${text}`)
  }
  return response
}

export async function listPhoneTemplates(
  phoneNumberId: string
): Promise<unknown> {
  const wabaId = await resolveWabaId(phoneNumberId)
  const client = getWhatsAppClient()
  return await client.templates.list({ businessAccountId: wabaId })
}

export async function createPhoneTemplate(
  phoneNumberId: string,
  name: string,
  language: string,
  category: string,
  components: Array<Record<string, unknown>>,
  allowCategoryChange?: boolean
): Promise<{ id: string; status: string; category: string }> {
  const wabaId = await resolveWabaId(phoneNumberId)
  const payload: Record<string, unknown> = {
    name,
    language,
    category,
    components,
  }
  if (allowCategoryChange !== undefined) {
    payload.allow_category_change = allowCategoryChange
  }
  const response = await metaProxyFetch(
    "POST",
    `${wabaId}/message_templates`,
    payload
  )
  const json = (await response.json()) as { id: string; status: string; category: string }
  return json
}

export async function deletePhoneTemplate(
  phoneNumberId: string,
  name: string
): Promise<{ success: boolean }> {
  const wabaId = await resolveWabaId(phoneNumberId)
  const url = `${KAPSO_META_PROXY_URL}/v24.0/${wabaId}/message_templates?name=${encodeURIComponent(name)}`
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "X-API-Key": getKapsoApiKey(),
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Meta proxy error (${response.status}): ${text}`)
  }
  const json = (await response.json()) as { success: boolean }
  return json
}

export async function getPhoneTemplateStatus(
  phoneNumberId: string,
  name: string
): Promise<unknown> {
  const wabaId = await resolveWabaId(phoneNumberId)
  const url = `${KAPSO_META_PROXY_URL}/v24.0/${wabaId}/message_templates?name=${encodeURIComponent(name)}&fields=name,status,category,language,components`
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-Key": getKapsoApiKey(),
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Meta proxy error (${response.status}): ${text}`)
  }
  return await response.json()
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
    mimeType: (metadata as any).mimeType ?? "application/octet-stream",
    fileName: (metadata as any).fileName,
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
