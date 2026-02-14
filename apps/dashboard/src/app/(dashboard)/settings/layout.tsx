"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Settings,
  Building2,
  Users,
  Shield,
  Plug,
  Key,
  CreditCard,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AdminOnly } from "@/components/role-redirect"
import { useEnvironment } from "@/contexts/environment-context"

type Environment = "development" | "production"

const settingsNav: {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  environments?: Environment[]
}[] = [
  {
    name: "General",
    href: "/settings",
    icon: Building2,
    description: "Organization and profile",
  },
  {
    name: "Users",
    href: "/settings/users",
    icon: Users,
    description: "Team members and roles",
  },
  {
    name: "Roles",
    href: "/settings/roles",
    icon: Shield,
    description: "Permission roles and policies",
  },
  {
    name: "Integrations",
    href: "/settings/integrations",
    icon: Plug,
    description: "External services",
    environments: ["production"],
  },
  {
    name: "API Keys",
    href: "/settings/api-keys",
    icon: Key,
    description: "External access",
  },
  {
    name: "Billing",
    href: "/settings/billing",
    icon: CreditCard,
    description: "Subscription and payments",
  },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { environment } = useEnvironment()

  const isActive = (href: string) => {
    if (href === "/settings") {
      return pathname === "/settings"
    }
    return pathname.startsWith(href)
  }

  const filteredNav = settingsNav.filter(
    (item) => !item.environments || item.environments.includes(environment)
  )

  return (
    <AdminOnly>
      <div className="flex h-[calc(100dvh-49px)]">
        <aside className="w-56 border-r bg-background-secondary flex flex-col shrink-0">
          <div className="p-3 border-b">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-content-primary">Settings</h2>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-0.5">
              {filteredNav.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-content-secondary hover:text-content-primary hover:bg-background-tertiary"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="mt-4 pt-4 border-t">
              <Link
                href="/settings/danger"
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                  pathname === "/settings/danger"
                    ? "bg-destructive/10 text-destructive font-medium"
                    : "text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                )}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Danger Zone</span>
              </Link>
            </div>
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-4xl">
            {children}
          </div>
        </main>
      </div>
    </AdminOnly>
  )
}
