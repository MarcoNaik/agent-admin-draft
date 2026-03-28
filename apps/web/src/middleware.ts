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
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.svg",
  "/privacy-policy",
  "/terms-of-service",
  "/pricing",
  "/contact",
]

function isBot(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") || ""
  if (!ua || ua.length < 10) return true
  if (BOT_UA_PATTERNS.some((p) => p.test(ua))) return true

  const accept = req.headers.get("accept") || ""
  if (!accept.includes("text/html")) return true

  if (!req.headers.get("sec-fetch-mode")) return true

  const secFetchDest = req.headers.get("sec-fetch-dest")
  if (secFetchDest && secFetchDest !== "document") return true

  return false
}

export function middleware(req: NextRequest) {
  if (!isBot(req)) return NextResponse.next()

  const path = req.nextUrl.pathname
  if (PASSTHROUGH_PATHS.includes(path)) return NextResponse.next()
  if (path.startsWith("/.well-known/")) return NextResponse.next()

  if (path === "/") {
    return NextResponse.rewrite(new URL("/llms.txt", req.url))
  }

  return NextResponse.rewrite(new URL(`/api/markdown${path}`, req.url))
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$).*)"],
}
