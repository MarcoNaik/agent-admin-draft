"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { SidebarContent } from "./sidebar"
import type { NavSection } from "@/lib/navigation"

export function MobileNav({ navigation }: { navigation?: NavSection[] }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <div className="lg:hidden">
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-cream border-b border-forest/10">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-forest">struere</span>
          <span className="text-xs text-forest-muted bg-cream-dark px-1.5 py-0.5 rounded">docs</span>
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 text-forest"
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30 bg-forest/20"
            role="button"
            tabIndex={-1}
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(false) }}
          />
          <div className="fixed top-[53px] left-0 bottom-0 z-40 w-72 bg-cream border-r border-forest/10 overflow-y-auto p-4">
            <SidebarContent navigation={navigation} />
          </div>
        </>
      )}
    </div>
  )
}
