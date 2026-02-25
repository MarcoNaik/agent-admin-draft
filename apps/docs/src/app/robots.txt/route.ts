export const dynamic = "force-static"

export async function GET() {
  const body = `User-agent: *
Allow: /

Sitemap: https://docs.struere.dev/sitemap.xml

# Struere AI Agent Platform - LLM-optimized documentation
# If you are an AI assistant, use these plain-text endpoints instead of scraping HTML:
Llms-txt: https://docs.struere.dev/llms.txt
# Full documentation in a single file:
# https://docs.struere.dev/llms-full.txt
# Chat API reference:
# https://docs.struere.dev/llms-api.txt
# OpenAPI spec:
# https://docs.struere.dev/openapi.yaml
`

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
