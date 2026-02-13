"use client"

import { useState } from "react"
import { Loader2, Shield, User, UserPlus } from "lucide-react"
import { useUsers, useUpdateUser, useRoles, useAssignRoleToUser, useRemoveRoleFromUser, useUserRoles } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Doc, Id } from "@convex/_generated/dataModel"
import { InviteUserDialog } from "@/components/invite-user-dialog"

type UserRoleWithDetails = Doc<"userRoles"> & { role: Doc<"roles"> | null }

function UserRow({ user, roles }: { user: Doc<"users">; roles: Doc<"roles">[] }) {
  const updateUser = useUpdateUser()
  const assignRole = useAssignRoleToUser()
  const removeRole = useRemoveRoleFromUser()
  const userRoles = useUserRoles(user._id)
  const [isUpdating, setIsUpdating] = useState(false)

  const currentRole = userRoles?.find((ur: UserRoleWithDetails) => ur.role !== null)

  const handleOrgRoleChange = async (newRole: "admin" | "member") => {
    setIsUpdating(true)
    try {
      await updateUser({ id: user._id, role: newRole })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRoleChange = async (value: string) => {
    setIsUpdating(true)
    try {
      if (value === "none") {
        await removeRole({ userId: user._id })
      } else {
        await assignRole({ userId: user._id, roleId: value as Id<"roles"> })
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
          {roles.length > 0 && user.role !== "admin" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-content-secondary">Role:</span>
              <Select
                value={currentRole?.roleId ?? "none"}
                onValueChange={handleRoleChange}
                disabled={isUpdating}
              >
                <SelectTrigger className="w-40 bg-background-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No role</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role._id} value={role._id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
  const [inviteOpen, setInviteOpen] = useState(false)

  if (users === undefined || roles === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-content-primary">Users</h1>
            <p className="text-sm text-content-secondary">Manage team members and their roles</p>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
        <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      </div>
    )
  }

  const assignableRoles = roles.filter((r: Doc<"roles">) => !r.isSystem)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Users</h1>
          <p className="text-sm text-content-secondary">Manage team members and their roles</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
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
              <UserRow key={user._id} user={user} roles={assignableRoles} />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">Role Types</CardTitle>
          <CardDescription className="text-content-secondary">Understanding organization and assigned roles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-content-secondary">
          <div>
            <h4 className="font-medium text-content-primary">Organization Roles</h4>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li><strong>Admin</strong> - Full access to all features including billing and danger zone</li>
              <li><strong>Member</strong> - Limited access based on assigned role</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-content-primary">Assigned Roles</h4>
            <p className="mt-1">
              Each member can have one role (like Teacher, Guardian) that controls access to specific entity types and actions.
            </p>
          </div>
        </CardContent>
      </Card>

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}
