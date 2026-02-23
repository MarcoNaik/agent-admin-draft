"use client"

import { useState, useEffect } from "react"
import { I18nProvider } from "@/lib/i18n"
import { HeroEntranceProvider, useHeroEntrance } from "@/lib/hero-entrance"

function BrandLoader() {
  const { loaded } = useHeroEntrance()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!loaded) return
    const timer = setTimeout(() => setVisible(false), 150)
    return () => clearTimeout(timer)
  }, [loaded])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-[#F8F6F2] transition-opacity duration-150 ease-out ${loaded ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      <span className="font-display text-3xl md:text-4xl font-semibold text-white tracking-tight select-none">
        Struere
      </span>
    </div>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <HeroEntranceProvider>
        <BrandLoader />
        {children}
      </HeroEntranceProvider>
    </I18nProvider>
  )
}
