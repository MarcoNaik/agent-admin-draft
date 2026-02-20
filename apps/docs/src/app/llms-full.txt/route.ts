import { generateLlmsFullTxt } from "@/lib/generate-llms"

export const dynamic = "force-static"

export async function GET() {
  const content = generateLlmsFullTxt()
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
