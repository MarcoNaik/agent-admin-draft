"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton, useUser, useOrganization } from "@clerk/nextjs"
import { Zap, Sparkles, HelpCircle, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navigation = [
  { name: "Agents", href: "/agents" },
  { name: "Settings", href: "/settings" },
]

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
          "radial-gradient(circle at 21% 59%, rgb(99, 109, 131) 0%, rgb(173, 131, 246) 80%, rgb(32, 32, 182) 100%)",
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

  const isLoaded = userLoaded && orgLoaded
  const orgName = organization?.name || user?.firstName || "Personal"

  return (
    <div className="sticky top-0 z-40">
      <header className="flex justify-between min-h-[56px] overflow-x-auto scrollbar-none bg-background-secondary border-b">
        <div className="flex items-center bg-background-secondary px-2">
          <div className="rounded-full p-2 transition-colors hover:bg-background-tertiary">
            <Link href="/" className="flex min-h-[28px] min-w-[28px] items-center justify-center rounded-full">
              <Zap className="h-7 w-7 text-util-accent" />
            </Link>
          </div>

          <div className="flex items-center gap-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center h-10 px-3 py-2 gap-2 select-none text-content-primary hover:bg-background-tertiary rounded-full cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <OrgAvatar name={orgName} />
                    <span className="text-content-secondary">/</span>
                    <div className="truncate font-semibold max-w-[14rem]">
                      {isLoaded ? orgName : "Loading..."}
                    </div>
                  </div>
                  <ChevronsUpDown className="h-5 w-5 text-content-secondary" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/settings">Organization Settings</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="relative">
              <div className="flex gap-1 truncate select-none">
                {navigation.map((item) => {
                  const isActive = item.href === "/agents"
                    ? pathname === "/agents" || pathname.startsWith("/agents/")
                    : pathname.startsWith(item.href)
                  return (
                    <div key={item.name} className="flex flex-col">
                      <Link
                        href={item.href}
                        className={cn(
                          "p-2 my-2 mx-1 text-sm text-content-primary hover:bg-background-tertiary rounded-full",
                          isActive && "font-medium"
                        )}
                      >
                        {item.name}
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-background-secondary px-2">
          <div className="flex items-center">
            <button
              type="button"
              className="flex items-center gap-1 rounded-full px-2.5 p-1.5 text-sm text-content-primary hover:bg-background-tertiary cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden md:block">Ask AI</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-full px-2.5 p-1.5 text-sm text-content-primary hover:bg-background-tertiary cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden md:block">Support</span>
            </button>
          </div>
          <div className="rounded-full p-2 transition-colors hover:bg-background-tertiary">
            <UserButton />
          </div>
        </div>
      </header>
    </div>
  )
}
