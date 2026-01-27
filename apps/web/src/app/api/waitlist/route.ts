import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { email } = await request.json()

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 })
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL

  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `New waitlist signup: **${email}**`,
      }),
    })
  }

  return NextResponse.json({ success: true })
}
