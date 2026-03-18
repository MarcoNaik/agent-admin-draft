"use node"

import { log } from "../logger"

const RESEND_API_BASE = "https://api.resend.com"

export function getResendApiKey(): string {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error("RESEND_API_KEY not configured")
  return key
}

export async function sendEmail(params: {
  to: string
  from: string
  subject: string
  html?: string
  text?: string
  replyTo?: string
}): Promise<{ id: string }> {
  const apiKey = getResendApiKey()

  const body: Record<string, unknown> = {
    from: params.from,
    to: [params.to],
    subject: params.subject,
  }
  if (params.html) body.html = params.html
  if (params.text) body.text = params.text
  if (params.replyTo) body.reply_to = params.replyTo

  const url = `${RESEND_API_BASE}/emails`
  const startTime = Date.now()
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  log.info("External API call", {
    integration: "resend",
    endpoint: url,
    method: "POST",
    status: response.status,
    durationMs: Date.now() - startTime,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Resend API error (${response.status}): ${text}`)
  }

  const json = (await response.json()) as { id: string }
  return { id: json.id }
}

export async function validateResendApiKey(): Promise<boolean> {
  const apiKey = getResendApiKey()

  const url = `${RESEND_API_BASE}/domains`
  const startTime = Date.now()
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })
  log.info("External API call", {
    integration: "resend",
    endpoint: url,
    method: "GET",
    status: response.status,
    durationMs: Date.now() - startTime,
  })

  return response.ok
}
