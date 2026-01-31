"use client"

import { GuardianOnly } from "@/components/role-redirect"

export default function GuardianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <GuardianOnly>{children}</GuardianOnly>
}
