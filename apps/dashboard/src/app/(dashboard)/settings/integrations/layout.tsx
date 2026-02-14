"use client"

import { ProductionOnly } from "@/components/environment-guard"

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProductionOnly redirectTo="/settings">
      {children}
    </ProductionOnly>
  )
}
