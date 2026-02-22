import Link from "next/link"
import { ChevronRight } from "lucide-react"

export function Breadcrumb({ section, title }: { section: string; title: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-content-tertiary mb-4">
      <Link href="/" className="hover:text-ocean transition-colors">
        Docs
      </Link>
      {section && (
        <>
          <ChevronRight size={12} />
          <span>{section}</span>
        </>
      )}
      <ChevronRight size={12} />
      <span className="text-charcoal">{title}</span>
    </div>
  )
}
