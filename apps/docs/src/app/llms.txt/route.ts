import { generateLlmsTxt } from "@/lib/generate-llms"

export const dynamic = "force-static"

export async function GET() {
  const content = generateLlmsTxt()
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
