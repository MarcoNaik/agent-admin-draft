export const CONVEX_URL = process.env.STRUERE_CONVEX_URL || 'https://rapid-wildebeest-172.convex.cloud'

export function getSiteUrl(): string {
  return CONVEX_URL.replace('.cloud', '.site')
}
