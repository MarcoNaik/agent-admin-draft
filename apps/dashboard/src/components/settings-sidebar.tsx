"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface SettingsSidebarProps {
  agentId: string
}

const navItems = [
  { label: "Edit Agent", href: "" },
  { label: "Production Deploy Keys", href: "#deploy-keys-production" },
  { label: "Preview Deploy Keys", href: "#deploy-keys-preview" },
  { label: "Environment Variables", href: "#env-vars" },
  { label: "Delete Agent", href: "#delete", variant: "destructive" as const },
]

export function SettingsSidebar({ agentId }: SettingsSidebarProps) {
  const pathname = usePathname()
  const basePath = `/agents/${agentId}/settings`

  return (
    <nav className="w-56 flex-shrink-0 space-y-1">
      {navItems.map((item) => {
        const isHash = item.href.startsWith("#")
        const fullPath = isHash ? `${basePath}${item.href}` : `${basePath}${item.href}`

        return isHash ? (
          <a
            key={item.label}
            href={item.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm transition-colors",
              item.variant === "destructive"
                ? "text-destructive hover:bg-destructive/10"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {item.label}
          </a>
        ) : (
          <Link
            key={item.label}
            href={fullPath}
            className={cn(
              "block rounded-md px-3 py-2 text-sm transition-colors",
              pathname === basePath && item.href === ""
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
