import { NextRequest, NextResponse } from "next/server"

const BOT_UA_PATTERNS = [
  /claude/i,
  /anthropic/i,
  /chatgpt/i,
  /openai/i,
  /gpt/i,
  /perplexity/i,
  /cohere/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /bot\b/i,
  /python-requests/i,
  /python-httpx/i,
  /axios/i,
  /node-fetch/i,
  /undici/i,
  /httpx/i,
  /curl/i,
  /wget/i,
  /go-http-client/i,
  /java\//i,
  /libwww/i,
  /http\.rb/i,
  /aiohttp/i,
  /requests/i,
]

const PASSTHROUGH_PATHS = [
  "/llms.txt",
  "/llms-full.txt",
  "/llms-sdk.txt",
  "/llms-api.txt",
  "/llms-cli.txt",
  "/llms-platform.txt",
  "/llms-tools.txt",
  "/llms-integrations.txt",
  "/openapi.yaml",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.svg",
]

function isBot(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") || ""
  if (!ua || ua.length < 10) return true
  if (BOT_UA_PATTERNS.some((p) => p.test(ua))) return true
  if (!req.headers.get("sec-fetch-mode")) return true
  return false
}

export function middleware(req: NextRequest) {
  if (!isBot(req)) return NextResponse.next()

  const path = req.nextUrl.pathname
  if (PASSTHROUGH_PATHS.includes(path)) return NextResponse.next()
  if (path.endsWith(".md")) return NextResponse.next()

  return NextResponse.redirect(new URL("/llms-full.txt", req.url), 302)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/).*)"],
}
