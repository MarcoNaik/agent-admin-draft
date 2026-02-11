"use client"

import { AdminOnly } from "@/components/role-redirect"

export default function UsageLayout({ children }: { children: React.ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>
}
