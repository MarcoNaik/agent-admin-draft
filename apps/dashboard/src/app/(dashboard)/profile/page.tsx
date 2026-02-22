"use client"

import { useUser } from "@clerk/nextjs"
import { Loader2, User, Mail, Shield } from "lucide-react"
import { useCurrentRole } from "@/hooks/use-current-role"
import { useCurrentOrganization } from "@/hooks/use-convex-data"
import { CalendarConnectionCard } from "@/components/calendar-connection-card"

export default function ProfilePage() {
  const { user, isLoaded } = useUser()
  const { role } = useCurrentRole()
  const org = useCurrentOrganization()

  if (!isLoaded) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-display font-semibold text-content-primary mb-6">Profile</h1>

      <div className="rounded-lg border bg-background-secondary p-6 space-y-6">
        <div className="flex items-center gap-4">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={user.fullName || "Profile"}
              className="h-16 w-16 rounded-full"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-display font-medium text-content-primary">
              {user?.fullName || "Unknown"}
            </h2>
            <p className="text-sm text-content-secondary">
              {org?.name || "No organization"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-content-tertiary" />
            <div>
              <p className="text-xs text-content-tertiary">Email</p>
              <p className="text-sm text-content-primary">
                {user?.primaryEmailAddress?.emailAddress || "No email"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-content-tertiary" />
            <div>
              <p className="text-xs text-content-tertiary">Role</p>
              <p className="text-sm text-content-primary capitalize">{role}</p>
            </div>
          </div>
        </div>
      </div>

      <CalendarConnectionCard />
    </div>
  )
}
