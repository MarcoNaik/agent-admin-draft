"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton, useUser, useOrganization } from "@clerk/nextjs"
import {
  Zap,
  Sparkles,
  HelpCircle,
  ChevronsUpDown,
  ChevronDown,
  Database,
  Calendar,
  Users,
  CreditCard,
  Clock,
  GraduationCap,
  UserCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type NavItem = {
  name: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  roles?: string[]
}

type NavSeparator = {
  type: "separator"
  label: string
  roles?: string[]
}

type NavEntry = NavItem | NavSeparator

const builderNavigation: NavItem[] = [
  { name: "Agents", href: "/agents" },
  { name: "Packs", href: "/packs" },
  { name: "Settings", href: "/settings" },
]

const businessNavigation: NavEntry[] = [
  { type: "separator", label: "Business", roles: ["admin", "teacher", "guardian"] },
  { name: "Entities", href: "/entities", icon: Database, roles: ["admin"] },
  { name: "Sessions", href: "/entities/session", icon: Calendar, roles: ["admin", "teacher", "guardian"] },
  { name: "Students", href: "/entities/student", icon: GraduationCap, roles: ["admin", "teacher"] },
  { name: "Teachers", href: "/entities/teacher", icon: UserCheck, roles: ["admin"] },
  { name: "Payments", href: "/entities/payment", icon: CreditCard, roles: ["admin"] },
  { name: "Jobs", href: "/jobs", icon: Clock, roles: ["admin"] },
]

function isSeparator(entry: NavEntry): entry is NavSeparator {
  return "type" in entry && entry.type === "separator"
}

function hasAccess(roles?: string[], userRole?: string): boolean {
  if (!roles || roles.length === 0) return true
  if (!userRole) return roles.includes("admin")
  return roles.includes(userRole)
}

function OrgAvatar({ name }: { name: string }) {
  const initials = (name || "U")
    .split(" ")
    .map((n) => n[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full relative overflow-hidden shrink-0"
      style={{
        backgroundImage:
          "radial-gradient(circle at 21% 59%, hsl(var(--primary) / 0.6) 0%, hsl(var(--primary)) 80%, hsl(var(--primary) / 0.8) 100%)",
      }}
    >
      <span className="pointer-events-none absolute inset-0 z-10 h-full w-full rounded-full bg-black/30 dark:bg-black/15" />
      <span className="relative z-20 text-sm font-medium text-white leading-none" style={{ textShadow: "0 0 3px rgba(0,0,0,0.5)" }}>
        {initials}
      </span>
    </span>
  )
}

export function Header() {
  const pathname = usePathname()
  const { user, isLoaded: userLoaded } = useUser()
  const { organization, isLoaded: orgLoaded } = useOrganization()
  const [userRole, setUserRole] = useState<string>("admin")

  const isLoaded = userLoaded && orgLoaded
  const orgName = organization?.name || user?.firstName || "Personal"

  useEffect(() => {
    if (user?.publicMetadata?.role) {
      setUserRole(user.publicMetadata.role as string)
    } else if (organization?.publicMetadata?.role) {
      setUserRole(organization.publicMetadata.role as string)
    }
  }, [user, organization])

  const filteredBusinessNav = businessNavigation.filter((entry) => {
    if (isSeparator(entry)) {
      return hasAccess(entry.roles, userRole)
    }
    return hasAccess(entry.roles, userRole)
  })

  const hasBusinessItems = filteredBusinessNav.some((entry) => !isSeparator(entry))

  return (
    <div className="sticky top-0 z-40">
      <header className="flex justify-between min-h-[56px] overflow-x-auto scrollbar-none bg-background-secondary border-b">
        <div className="flex items-center px-2">
          <div className="rounded-md p-2 transition-colors hover:bg-background-tertiary">
            <Link href="/" className="flex min-h-[28px] min-w-[28px] items-center justify-center">
              <Zap className="h-6 w-6 text-primary" />
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center h-9 px-2 gap-2 select-none text-content-primary hover:bg-background-tertiary rounded-md cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <OrgAvatar name={orgName} />
                    <span className="text-content-tertiary">/</span>
                    <div className="truncate font-medium max-w-[14rem]">
                      {isLoaded ? orgName : "Loading..."}
                    </div>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 text-content-tertiary" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/settings">Organization Settings</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="relative">
              <div className="flex gap-0.5 truncate select-none">
                {builderNavigation.map((item) => {
                  const isActive = item.href === "/agents"
                    ? pathname === "/agents" || pathname.startsWith("/agents/")
                    : pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "px-3 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-background-tertiary rounded-md transition-colors",
                        isActive && "text-content-primary font-medium"
                      )}
                    >
                      {item.name}
                    </Link>
                  )
                })}

                {hasBusinessItems && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1 px-3 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-background-tertiary rounded-md cursor-pointer transition-colors",
                          (pathname.startsWith("/entities") || pathname.startsWith("/jobs")) && "text-content-primary font-medium"
                        )}
                      >
                        Business
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {filteredBusinessNav.map((entry, index) => {
                        if (isSeparator(entry)) {
                          return index > 0 ? <DropdownMenuSeparator key={`sep-${index}`} /> : null
                        }
                        const Icon = entry.icon
                        return (
                          <DropdownMenuItem key={entry.name} asChild>
                            <Link href={entry.href} className="flex items-center gap-2">
                              {Icon && <Icon className="h-4 w-4" />}
                              {entry.name}
                            </Link>
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center px-2">
          <div className="flex items-center">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-background-tertiary cursor-pointer transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden md:block">Ask AI</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-background-tertiary cursor-pointer transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden md:block">Support</span>
            </button>
          </div>
          <div className="rounded-md p-2 transition-colors hover:bg-background-tertiary">
            <UserButton />
          </div>
        </div>
      </header>
    </div>
  )
}
