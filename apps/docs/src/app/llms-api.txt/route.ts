import { generateSectionLlmsTxt } from "@/lib/generate-section-llms"

export const dynamic = "force-static"

export async function GET() {
  const content = generateSectionLlmsTxt("api")
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
