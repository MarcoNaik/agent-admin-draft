"use client"

import { AdminOnly } from "@/components/role-redirect"

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>
}
