import { NextRequest, NextResponse } from "next/server"

const BOT_PATTERNS = [
  /claude/i,
  /anthropic/i,
  /chatgpt/i,
  /openai/i,
  /gpt/i,
  /perplexity/i,
  /cohere/i,
  /ai2/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /fetch/i,
  /bot\b/i,
  /python-requests/i,
  /axios/i,
  /node-fetch/i,
  /undici/i,
  /httpx/i,
  /curl/i,
  /wget/i,
  /go-http-client/i,
  /java\//i,
  /ruby/i,
  /perl/i,
  /libwww/i,
  /http\.rb/i,
]

function isLikelyBot(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") || ""
  if (BOT_PATTERNS.some((p) => p.test(ua))) return true
  if (!ua || ua.length < 10) return true
  const secFetchMode = req.headers.get("sec-fetch-mode")
  if (!secFetchMode) return true
  return false
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname !== "/") return NextResponse.next()
  if (!isLikelyBot(req)) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = "/llms-full.txt"
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ["/"],
}
