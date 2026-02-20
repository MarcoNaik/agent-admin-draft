import { getAllDocs, SECTION_ORDER } from "./content"

export interface NavItem {
  title: string
  slug: string
  order: number
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export function getNavigation(): NavSection[] {
  const docs = getAllDocs()
  const sections = new Map<string, NavItem[]>()

  for (const doc of docs) {
    const section = doc.section || "Getting Started"
    if (!sections.has(section)) {
      sections.set(section, [])
    }
    sections.get(section)!.push({
      title: doc.title,
      slug: doc.slug,
      order: doc.order,
    })
  }

  return SECTION_ORDER
    .filter((s) => sections.has(s))
    .map((s) => ({
      title: s,
      items: sections.get(s)!.sort((a, b) => a.order - b.order),
    }))
}

export function getPrevNext(slug: string): { prev: NavItem | null; next: NavItem | null } {
  const docs = getAllDocs()
  const index = docs.findIndex((d) => d.slug === slug)
  return {
    prev: index > 0 ? { title: docs[index - 1].title, slug: docs[index - 1].slug, order: docs[index - 1].order } : null,
    next: index < docs.length - 1 ? { title: docs[index + 1].title, slug: docs[index + 1].slug, order: docs[index + 1].order } : null,
  }
}
