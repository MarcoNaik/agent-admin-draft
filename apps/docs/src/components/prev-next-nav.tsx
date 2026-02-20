import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import type { NavItem } from "@/lib/navigation"

export function PrevNextNav({ prev, next }: { prev: NavItem | null; next: NavItem | null }) {
  return (
    <div className="flex items-center justify-between mt-12 pt-6 border-t border-forest/10">
      {prev ? (
        <Link
          href={`/${prev.slug}`}
          className="flex items-center gap-2 text-sm text-forest-muted hover:text-forest transition-colors"
        >
          <ArrowLeft size={14} />
          {prev.title}
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/${next.slug}`}
          className="flex items-center gap-2 text-sm text-forest-muted hover:text-forest transition-colors"
        >
          {next.title}
          <ArrowRight size={14} />
        </Link>
      ) : (
        <div />
      )}
    </div>
  )
}
