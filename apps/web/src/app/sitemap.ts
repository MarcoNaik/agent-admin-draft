import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://struere.dev",
      lastModified: new Date("2026-03-23"),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: "https://struere.dev/privacy-policy",
      lastModified: new Date("2026-03-01"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: "https://struere.dev/terms-of-service",
      lastModified: new Date("2026-03-01"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ]
}
