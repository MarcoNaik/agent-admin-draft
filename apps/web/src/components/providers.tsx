"use client"

import { I18nProvider } from "@/lib/i18n"
import { HeroEntranceProvider } from "@/lib/hero-entrance"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <HeroEntranceProvider>{children}</HeroEntranceProvider>
    </I18nProvider>
  )
}
