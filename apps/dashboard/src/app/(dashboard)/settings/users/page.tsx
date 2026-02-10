"use client"

import { useState } from "react"
import { Loader2, Shield, User } from "lucide-react"
import { useUsers, useUpdateUser, useRoles, useAssignRoleToUser, useRemoveRoleFromUser, useUserRoles } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Doc, Id } from "@convex/_generated/dataModel"

type UserRoleWithDetails = Doc<"userRoles"> & { role: Doc<"roles"> | null }

function UserRoleBadges({ userId }: { userId: Id<"users"> }) {
  const userRoles = useUserRoles(userId)

  if (!userRoles || userRoles.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {userRoles.map((ur: UserRoleWithDetails) => (
        <Badge key={ur._id} variant="secondary" className="text-xs">
          <Shield className="mr-1 h-3 w-3" />
          {ur.role?.name}
        </Badge>
      ))}
    </div>
  )
}

function UserRow({ user, roles }: { user: Doc<"users">; roles: Doc<"roles">[] }) {
  const updateUser = useUpdateUser()
  const assignRole = useAssignRoleToUser()
  const removeRole = useRemoveRoleFromUser()
  const userRoles = useUserRoles(user._id)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleOrgRoleChange = async (newRole: "admin" | "member") => {
    setIsUpdating(true)
    try {
      await updateUser({ id: user._id, role: newRole })
    } finally {
      setIsUpdating(false)
    }
  }

  const handlePackRoleToggle = async (role: Doc<"roles">) => {
    setIsUpdating(true)
    try {
      const hasRole = userRoles?.some((ur: UserRoleWithDetails) => ur.roleId === role._id)
      if (hasRole) {
        await removeRole({ userId: user._id, roleId: role._id })
      } else {
        await assignRole({ userId: user._id, roleId: role._id })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const roleIcon = user.role === "admin" ? Shield : User

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background-tertiary p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          {roleIcon === Shield ? (
            <Shield className="h-5 w-5 text-primary" />
          ) : (
            <User className="h-5 w-5 text-content-secondary" />
          )}
        </div>
        <div>
          <div className="font-medium text-content-primary">{user.name || "Unnamed User"}</div>
          <div className="text-sm text-content-secondary">{user.email}</div>
          <UserRoleBadges userId={user._id} />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-content-secondary">Org Role:</span>
            <Select
              value={user.role}
              onValueChange={handleOrgRoleChange}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-32 bg-background-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {roles.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-content-secondary">Pack Roles:</span>
              <div className="flex flex-wrap gap-1">
                {roles.map((role) => {
                  const hasRole = userRoles?.some((ur: UserRoleWithDetails) => ur.roleId === role._id)
                  return (
                    <Button
                      key={role._id}
                      size="sm"
                      variant={hasRole ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => handlePackRoleToggle(role)}
                      disabled={isUpdating}
                    >
                      {role.name}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-content-secondary" />}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const { environment } = useEnvironment()
  const users = useUsers()
  const roles = useRoles(environment)

  if (users === undefined || roles === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Users</h1>
          <p className="text-sm text-content-secondary">Manage team members and their roles</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const packRoles = roles.filter((r: Doc<"roles">) => !r.isSystem)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">Users</h1>
        <p className="text-sm text-content-secondary">Manage team members and their roles</p>
      </div>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">Team Members</CardTitle>
          <CardDescription className="text-content-secondary">
            {users.length} user{users.length !== 1 ? "s" : ""} in your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.length === 0 ? (
            <div className="py-8 text-center text-content-secondary">No users found</div>
          ) : (
            users.map((user: Doc<"users">) => (
              <UserRow key={user._id} user={user} roles={packRoles} />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">Role Types</CardTitle>
          <CardDescription className="text-content-secondary">Understanding organization and pack roles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-content-secondary">
          <div>
            <h4 className="font-medium text-content-primary">Organization Roles</h4>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li><strong>Admin</strong> - Full access to all features including billing and danger zone</li>
              <li><strong>Member</strong> - Limited access based on assigned pack roles</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-content-primary">Pack Roles</h4>
            <p className="mt-1">
              Pack roles (like Teacher, Guardian) are installed with Solution Packs and control access to specific entity types and actions.
              Members need pack roles to access business features.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
