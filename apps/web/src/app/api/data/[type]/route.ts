import { NextRequest, NextResponse } from "next/server"

const API_URL = "https://rapid-wildebeest-172.convex.site/v1/data"
const API_KEY = process.env.STRUERE_API_KEY!

export async function GET(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  const { type } = params
  const searchParams = req.nextUrl.searchParams.toString()
  const url = searchParams ? `${API_URL}/${type}?${searchParams}` : `${API_URL}/${type}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
