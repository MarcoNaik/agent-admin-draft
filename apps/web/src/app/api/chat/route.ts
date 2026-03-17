import { NextRequest, NextResponse } from "next/server"

const API_URL = "https://rapid-wildebeest-172.convex.site/v1/agents"
const API_KEY = process.env.STRUERE_API_KEY!

export async function POST(req: NextRequest) {
  const { message, agentSlug, threadId } = await req.json()

  if (!message || !agentSlug) {
    return NextResponse.json({ error: "Missing message or agentSlug" }, { status: 400 })
  }

  const res = await fetch(`${API_URL}/${agentSlug}/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, threadId }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
