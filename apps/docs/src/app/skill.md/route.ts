import { generateSkillMd } from "@/lib/generate-skill"

export const dynamic = "force-static"

export async function GET() {
  const content = generateSkillMd()
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
