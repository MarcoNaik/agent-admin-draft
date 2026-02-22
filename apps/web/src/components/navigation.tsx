"use client"

import { useState, useEffect } from "react"
import { useI18n } from "@/lib/i18n"

export function Navigation() {
  const { locale, setLocale, t } = useI18n()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = [
    { label: t.nav.howItWorks, href: "#como-funciona" },
    { label: t.nav.useCases, href: "#agentes" },
    { label: t.nav.earlyAccess, href: "#precios" },
    { label: t.nav.docs, href: "https://docs.struere.dev" },
  ]

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const toggleLocale = () => setLocale(locale === "es" ? "en" : "es")

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 border-b ${
        scrolled
          ? "bg-stone-base/80 backdrop-blur-xl border-charcoal/5 shadow-sm"
          : "bg-transparent border-transparent backdrop-blur-none shadow-none"
      }`}
      style={{
        transition:
          "background-color 600ms cubic-bezier(0.4,0,0.2,1), backdrop-filter 600ms cubic-bezier(0.4,0,0.2,1), border-color 600ms cubic-bezier(0.4,0,0.2,1), box-shadow 600ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 md:px-12 flex items-center justify-between h-16">
        <a
          href="#"
          className={`font-display text-xl font-semibold tracking-tight transition-colors duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
            scrolled ? "text-charcoal-heading" : "text-white"
          }`}
        >
          Struere
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
                scrolled
                  ? "text-charcoal/70 hover:text-charcoal"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={toggleLocale}
            className={`text-xs font-medium px-2 py-1 rounded transition-colors duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] cursor-pointer ${
              scrolled
                ? "text-charcoal/50 hover:text-charcoal"
                : "text-white/50 hover:text-white"
            }`}
          >
            {locale === "es" ? "EN" : "ES"}
          </button>
          <a
            href="https://app.struere.dev"
            className={`text-sm font-medium px-5 py-2 rounded-xl transition-all duration-300 ${
              scrolled
                ? "bg-ocean text-white hover:bg-ocean-light"
                : "bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm"
            }`}
          >
            {t.nav.cta}
          </a>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className={`md:hidden p-2 transition-colors duration-500 ${
            scrolled ? "text-charcoal" : "text-white"
          }`}
          aria-label="Menu"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 9h16.5m-16.5 6.75h16.5"
              />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-stone-base/95 backdrop-blur-xl border-t border-charcoal/5">
          <div className="px-6 py-6 flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-base text-charcoal/80 hover:text-charcoal transition-colors"
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={toggleLocale}
              className="text-left text-base text-charcoal/50 hover:text-charcoal transition-colors cursor-pointer"
            >
              {locale === "es" ? "English" : "Espa\u00f1ol"}
            </button>
            <a
              href="https://app.struere.dev"
              className="mt-2 text-center text-sm font-medium px-5 py-3 rounded-xl bg-ocean text-white hover:bg-ocean-light transition-colors"
            >
              {t.nav.cta}
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
