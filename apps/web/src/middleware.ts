import { NextRequest, NextResponse } from "next/server"

const LLM_UA_PATTERNS = [
  /chatgpt-user/i,
  /gptbot/i,
  /claudebot/i,
  /claude-user/i,
  /claude-searchbot/i,
  /anthropic-ai/i,
  /perplexitybot/i,
  /perplexity/i,
  /cohere-ai/i,
  /ccbot/i,
]

const MARKDOWN_ACCEPT_TYPES = [
  "text/markdown",
  "application/markdown",
  "text/x-markdown",
]

function wantsMarkdown(req: NextRequest): boolean {
  const accept = req.headers.get("accept") || ""
  if (MARKDOWN_ACCEPT_TYPES.some((t) => accept.includes(t))) return true

  const ua = req.headers.get("user-agent") || ""
  if (LLM_UA_PATTERNS.some((p) => p.test(ua))) return true

  return false
}

export function middleware(req: NextRequest) {
  if (!wantsMarkdown(req)) return NextResponse.next()

  const path = req.nextUrl.pathname

  if (path === "/") {
    return NextResponse.rewrite(new URL("/llms.txt", req.url))
  }

  return NextResponse.rewrite(new URL(`/api/markdown${path}`, req.url))
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$).*)"],
}
