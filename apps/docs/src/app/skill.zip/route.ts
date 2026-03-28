import { zipSync } from "fflate"
import { generateSkillMd } from "@/lib/generate-skill"

export const dynamic = "force-static"

export async function GET() {
  const content = generateSkillMd()
  const encoded = new TextEncoder().encode(content)
  const zipped = zipSync({
    "struere-developer/SKILL.md": encoded,
  })
  return new Response(Buffer.from(zipped), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="struere-developer-skill.zip"',
    },
  })
}
