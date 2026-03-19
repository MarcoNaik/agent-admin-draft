"use client"

import { useUser } from "@clerk/nextjs"
import { Loader2, User, Mail, Shield, Database } from "@/lib/icons"
import { useCurrentRole } from "@/hooks/use-current-role"
import { useCurrentOrganization } from "@/hooks/use-convex-data"
import { useCurrentUserRoles } from "@/hooks/use-roles"
import { useEnvironment } from "@/contexts/environment-context"
import { CalendarConnectionCard } from "@/components/calendar-connection-card"
import { useEntityTypes, useLinkedEntity } from "@/hooks/use-entities"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"

export default function ProfilePage() {
  const { user, isLoaded } = useUser()
  const { role } = useCurrentRole()
  const org = useCurrentOrganization()
  const userRoles = useCurrentUserRoles()
  const { environment } = useEnvironment()

  const entityTypes = useEntityTypes(environment)

  const userRole = userRoles?.filter((ur: any) => ur.role && (!ur.role.environment || ur.role.environment === environment))?.[0]

  const boundEntityType = entityTypes?.find((et: any) => et.boundToRole === userRole?.role?.name)

  const linkedEntity = useLinkedEntity(
    boundEntityType?._id,
    user?.id,
    environment
  )

  const maskedEntity = useQuery(
    api.entities.get,
    linkedEntity?._id ? { id: linkedEntity._id, environment } : "skip"
  )

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
              {userRole?.role ? (
                <>
                  <p className="text-sm text-content-primary">{userRole.role.name}</p>
                  {userRole.role.description && (
                    <p className="text-xs text-content-secondary">{userRole.role.description}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-content-primary capitalize">{role}</p>
              )}
            </div>
          </div>

          {maskedEntity?.data && Object.keys(maskedEntity.data).length > 0 && (() => {
            const skipFields = new Set([
              boundEntityType?.userIdField || "userId",
              "name",
              "email",
            ])
            const entries = Object.entries(maskedEntity.data as Record<string, any>)
              .filter(([key]) => !skipFields.has(key))
              .filter(([, value]) => value != null)
            if (entries.length === 0) return null
            return (
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="h-4 w-4 text-content-tertiary" />
                  <p className="text-xs font-medium text-content-tertiary uppercase tracking-wider">
                    {boundEntityType?.name || "Details"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {entries.map(([key, value]) => (
                    <div key={key} className={`min-w-0 ${typeof value === "object" && !Array.isArray(value) ? "col-span-2" : ""}`}>
                      <p className="text-xs text-content-tertiary mb-0.5">
                        {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </p>
                      {Array.isArray(value) ? (
                        <div className="flex flex-wrap gap-1.5">
                          {value.map((item, i) => (
                            <span key={i} className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {String(item)}
                            </span>
                          ))}
                        </div>
                      ) : typeof value === "object" && value !== null ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {Object.entries(value as Record<string, any>).map(([day, hours]) => (
                            <span key={day} className="text-sm text-content-primary">
                              <span className="capitalize">{day}</span>
                              <span className="text-content-tertiary">: </span>
                              {Array.isArray(hours) && hours.length > 0
                                ? `${hours[0]}:00 - ${hours[hours.length - 1] + 1}:00`
                                : String(hours)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-content-primary break-all">
                          {String(value)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      <CalendarConnectionCard />
    </div>
  )
}
