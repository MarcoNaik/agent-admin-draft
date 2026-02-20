import { MetadataRoute } from "next"
import { getAllDocs } from "@/lib/content"

const BASE_URL = "https://docs.struere.dev"

export default function sitemap(): MetadataRoute.Sitemap {
  const docs = getAllDocs()

  return [
    {
      url: BASE_URL,
      changeFrequency: "weekly" as const,
      priority: 1.0,
    },
    ...docs.map((doc) => ({
      url: `${BASE_URL}/${doc.slug}`,
      changeFrequency: "weekly" as const,
      priority: doc.slug === "introduction" || doc.slug === "getting-started" ? 0.9 : 0.7,
    })),
  ]
}
