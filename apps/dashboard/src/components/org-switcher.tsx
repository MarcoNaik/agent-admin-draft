"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useOrganization, useOrganizationList, useUser } from "@clerk/nextjs"
import {
  Plus,
  ChevronsUpDown,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCurrentOrganization } from "@/hooks/use-convex-data"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CreateOrgDialog } from "./create-org-dialog"

function OrgAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = (name || "U")
    .split(" ")
    .map((n) => n[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  const sizeClasses = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm"

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full relative overflow-hidden shrink-0",
        sizeClasses
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle at 21% 59%, hsl(var(--primary) / 0.6) 0%, hsl(var(--primary)) 80%, hsl(var(--primary) / 0.8) 100%)",
      }}
    >
      <span className="pointer-events-none absolute inset-0 z-10 h-full w-full rounded-full bg-black/30 dark:bg-black/15" />
      <span
        className="relative z-20 font-medium text-white leading-none"
        style={{ textShadow: "0 0 3px rgba(0,0,0,0.5)" }}
      >
        {initials}
      </span>
    </span>
  )
}

export function OrgSwitcher() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [createOrgOpen, setCreateOrgOpen] = useState(false)

  const { user, isLoaded: userLoaded } = useUser()
  const { organization: clerkOrg, isLoaded: orgLoaded } = useOrganization()
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  })
  const convexOrg = useCurrentOrganization()

  const isLoaded = userLoaded && orgLoaded
  const orgName = convexOrg?.name || clerkOrg?.name || user?.firstName || "Personal"

  const handleOrgSelect = async (orgId: string) => {
    if (setActive) {
      await setActive({ organization: orgId })
      setOpen(false)
      window.location.href = "/agents"
    }
  }

  const handleOrgCreated = () => {
    router.push("/agents")
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center h-8 px-2 gap-1.5 select-none text-content-primary hover:bg-background-tertiary rounded-md cursor-pointer transition-colors"
          >
            <OrgAvatar name={orgName} />
            <span className="font-medium text-sm">{isLoaded ? orgName : "..."}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-content-tertiary" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-64 p-0 bg-popover border-border/50"
          sideOffset={8}
        >
          <div className="flex flex-col">
            <div className="px-3 py-2 border-b border-border/50">
              <span className="text-xs font-medium text-content-tertiary uppercase tracking-wider">
                Organizations
              </span>
            </div>

            <div className="p-1 max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors cursor-pointer bg-background-tertiary"
              >
                <OrgAvatar name={orgName} />
                <span className="text-sm text-content-primary truncate flex-1 text-left">
                  {orgName}
                </span>
                <Check className="h-4 w-4 text-primary shrink-0" />
              </button>
              {userMemberships?.data
                ?.filter((membership) => membership.organization.id !== clerkOrg?.id)
                .map((membership) => (
                  <button
                    key={membership.id}
                    type="button"
                    onClick={() => handleOrgSelect(membership.organization.id)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors cursor-pointer hover:bg-background-tertiary"
                  >
                    <OrgAvatar name={membership.organization.name} />
                    <span className="text-sm text-content-primary truncate flex-1 text-left">
                      {membership.organization.name}
                    </span>
                  </button>
                ))}
            </div>

            <div className="p-1 border-t border-border/50">
              <button
                type="button"
                onClick={() => setCreateOrgOpen(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-background-tertiary transition-colors cursor-pointer text-primary"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">Create Organization</span>
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <CreateOrgDialog
        open={createOrgOpen}
        onOpenChange={setCreateOrgOpen}
        onSuccess={handleOrgCreated}
      />
    </>
  )
}
