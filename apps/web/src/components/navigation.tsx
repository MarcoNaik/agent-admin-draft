"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Menu, X, ArrowUpRight } from "lucide-react"
import { useHeroEntrance } from "@/lib/hero-entrance"

const navLinks = [
  { label: "Features", href: "/#use-cases", external: false },
  { label: "Demo", href: "/#demo", external: false },
  { label: "Pricing", href: "/pricing", external: false },
  { label: "Contact", href: "/contact", external: false },
  { label: "Docs", href: "https://docs.struere.dev", external: true },
]

export function Navigation() {
  const { mounted } = useHeroEntrance()

  const scrollTo = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const hash = href.startsWith("/#") ? href.slice(1) : href.startsWith("#") ? href : null
    if (!hash) return
    if (window.location.pathname !== "/") return
    e.preventDefault()
    const el = document.querySelector(hash)
    if (el) el.scrollIntoView({ behavior: "smooth" })
  }, [])
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="sticky top-0 left-0 right-0 z-50 bg-stone-base backdrop-blur-xl">
      <div className="relative mx-auto max-w-6xl px-6 md:px-12 flex items-center justify-between h-12">
        <div
          className={`ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? "opacity-100" : "opacity-0"}`}
          style={{
            transitionProperty: "opacity",
            transitionDuration: "800ms",
          }}
        >
          <a
            href="#"
            className="font-display text-xl font-semibold tracking-tight text-ocean"
          >
            Struere
          </a>
        </div>

        <div
          className={`hidden md:flex items-center gap-8 ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? "opacity-100" : "opacity-0"}`}
          style={{
            transitionProperty: "opacity",
            transitionDuration: "800ms",
          }}
        >
          {navLinks.map((link) =>
            link.href.startsWith("/") ? (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-ocean/70 hover:text-ocean transition-colors duration-200 inline-flex items-center gap-1"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => scrollTo(e, link.href)}
                className="text-sm text-ocean/70 hover:text-ocean transition-colors duration-200 inline-flex items-center gap-1"
                {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {link.label}
                {link.external && <ArrowUpRight className="w-3 h-3" strokeWidth={2} />}
              </a>
            )
          )}
          <a
            href="https://app.struere.dev?studio="
            className="text-sm font-medium px-5 py-2 rounded-xl text-white bg-ocean hover:bg-ocean-light transition-colors duration-200"
          >
            Start free
          </a>
        </div>

        <div
          className={`md:hidden ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? "opacity-100" : "opacity-0"}`}
          style={{
            transitionProperty: "opacity",
            transitionDuration: "800ms",
          }}
        >
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-ocean transition-colors duration-200"
            aria-label="Menu"
          >
            {mobileOpen ? (
              <X className="w-5 h-5" strokeWidth={1.5} />
            ) : (
              <Menu className="w-5 h-5" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white/80 backdrop-blur-xl border-t border-black/5">
          <div className="px-6 py-6 flex flex-col gap-4">
            {navLinks.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-base text-ocean/70 hover:text-ocean transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => { scrollTo(e, link.href); setMobileOpen(false) }}
                  className="text-base text-ocean/70 hover:text-ocean transition-colors duration-200"
                >
                  {link.label}
                </a>
              )
            )}
            <a
              href="https://app.struere.dev?studio="
              className="mt-2 text-center text-sm font-medium px-5 py-3 rounded-xl text-white bg-ocean hover:bg-ocean-light transition-colors duration-200"
            >
              Start free
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
