"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText } from "lucide-react"
import type { NavSection } from "@/lib/navigation"

export function Sidebar({ navigation }: { navigation?: NavSection[] }) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-forest/10 bg-cream">
      <div className="flex-1 flex flex-col overflow-y-auto px-4 py-6">
        <Link href="/" className="flex items-center gap-2 mb-8 px-2">
          <span className="text-lg font-bold tracking-tight text-forest">struere</span>
          <span className="text-xs text-forest-muted bg-cream-dark px-1.5 py-0.5 rounded">docs</span>
        </Link>
        <SidebarContent navigation={navigation} />
        <div className="mt-auto pt-6 border-t border-forest/10">
          <Link
            href="/llms.txt"
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-forest-muted hover:text-forest transition-colors"
          >
            <FileText size={14} />
            llms.txt
          </Link>
        </div>
      </div>
    </aside>
  )
}

export function SidebarContent({ navigation }: { navigation?: NavSection[] }) {
  const pathname = usePathname()
  const currentSlug = pathname === "/" ? "introduction" : pathname.slice(1)

  if (!navigation) return null

  return (
    <nav className="flex flex-col gap-6">
      {navigation.map((section) => (
        <div key={section.title}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-forest-muted px-2 mb-2">
            {section.title}
          </h3>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = currentSlug === item.slug
              return (
                <li key={item.slug}>
                  <Link
                    href={`/${item.slug}`}
                    className={`block px-2.5 py-1.5 text-[13px] rounded transition-colors ${
                      active
                        ? "bg-forest text-cream font-medium"
                        : "text-forest hover:bg-forest/5"
                    }`}
                  >
                    {item.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
