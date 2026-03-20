"use client"

import { useState } from "react"
import { Loader2, Shield, User, UserPlus, Link, Unlink, Plus, Trash2 } from "@/lib/icons"
import { useUser } from "@clerk/nextjs"
import { useUsers, useUpdateUser, useRoles, useAssignRoleToUser, useRemoveRoleFromUser, useUserRoles, useEntityTypes, useCreateEntity } from "@/hooks/use-convex-data"
import { useRemoveUser } from "@/hooks/use-users"
import { useEntitiesByEmail, useLinkedEntity, useLinkUserToEntity, useUnlinkUserFromEntity } from "@/hooks/use-entities"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Doc, Id } from "@convex/_generated/dataModel"
import { InviteUserDialog } from "@/components/invite-user-dialog"
import { toast } from "sonner"

export interface UserPermissions {
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  isAdmin: boolean
}

type UserRoleWithDetails = Doc<"userRoles"> & { role: Doc<"roles"> | null }
type UserWithRole = Doc<"users"> & { role: "admin" | "member" }

function LinkEntityDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  entityTypeId,
  entityTypeName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: Id<"users">
  userEmail: string
  entityTypeId: Id<"entityTypes">
  entityTypeName: string
}) {
  const { environment } = useEnvironment()
  const matchingEntities = useEntitiesByEmail(entityTypeId, userEmail, environment)
  const linkUser = useLinkUserToEntity()
  const [isLinking, setIsLinking] = useState(false)

  const handleLink = async (entityId: Id<"entities">) => {
    setIsLinking(true)
    try {
      await linkUser({ entityId, userId, environment })
      toast.success(`Linked ${entityTypeName} entity`)
      onOpenChange(false)
    } catch (err) {
      toast.error(`Failed to link entity: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsLinking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link {entityTypeName}</DialogTitle>
          <DialogDescription>
            Select a {entityTypeName} entity to link to {userEmail}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {matchingEntities === undefined ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
            </div>
          ) : matchingEntities.length === 0 ? (
            <p className="text-sm text-content-secondary py-4 text-center">No entities found</p>
          ) : (
            matchingEntities.map((entity: { _id: Id<"entities">; data?: { name?: string; email?: string } }) => (
              <div
                key={entity._id}
                className="flex items-center justify-between rounded-md border border-border/50 bg-background-tertiary p-3"
              >
                <div className="text-sm">
                  <span className="font-medium text-content-primary">
                    {entity.data?.name || entity.data?.email || entity._id}
                  </span>
                  {entity.data?.email && entity.data?.name && (
                    <span className="ml-2 text-content-secondary">{entity.data.email}</span>
                  )}
                </div>
                <Button size="sm" onClick={() => handleLink(entity._id)} disabled={isLinking}>
                  {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                  <span className="ml-1">Link</span>
                </Button>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UnlinkEntityDialog({
  open,
  onOpenChange,
  entityId,
  entityName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityId: Id<"entities">
  entityName: string
}) {
  const unlinkUser = useUnlinkUserFromEntity()
  const [isUnlinking, setIsUnlinking] = useState(false)

  const handleUnlink = async (deleteEntity: boolean) => {
    setIsUnlinking(true)
    try {
      await unlinkUser({ entityId, deleteEntity })
      toast.success(deleteEntity ? `Deleted and unlinked ${entityName}` : `Unlinked ${entityName}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(`Failed to unlink: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsUnlinking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlink {entityName}</DialogTitle>
          <DialogDescription>
            Choose whether to just unlink the entity or delete it entirely.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUnlinking}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => handleUnlink(false)} disabled={isUnlinking}>
            {isUnlinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Just Unlink
          </Button>
          <Button variant="destructive" onClick={() => handleUnlink(true)} disabled={isUnlinking}>
            {isUnlinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete & Unlink
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UserRow({ user, roles, entityTypes, currentClerkUserId, permissions }: { user: UserWithRole; roles: Doc<"roles">[]; entityTypes: Doc<"entityTypes">[]; currentClerkUserId: string | undefined; permissions: UserPermissions }) {
  const { environment } = useEnvironment()
  const updateUser = useUpdateUser()
  const assignRole = useAssignRoleToUser()
  const removeRole = useRemoveRoleFromUser()
  const createEntity = useCreateEntity()
  const { removeUser, isRemoving } = useRemoveUser()
  const userRoles = useUserRoles(user._id)
  const [isUpdating, setIsUpdating] = useState(false)
  const [pendingEntityCreation, setPendingEntityCreation] = useState<Doc<"entityTypes"> | null>(null)
  const [isCreatingEntity, setIsCreatingEntity] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false)
  const [linkEntityType, setLinkEntityType] = useState<Doc<"entityTypes"> | null>(null)

  const currentRole = userRoles?.find((ur: UserRoleWithDetails) => ur.role !== null)

  const boundEntityType = currentRole?.role
    ? entityTypes.find((et) => et.boundToRole === currentRole.role?.name)
    : undefined

  const linkedEntity = useLinkedEntity(boundEntityType?._id, user.clerkUserId, environment)

  const handleOrgRoleChange = async (newRole: "admin" | "member") => {
    setIsUpdating(true)
    try {
      await updateUser({ id: user._id, role: newRole })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update organization role")
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

        const assignedRole = roles.find((r) => r._id === value)
        if (assignedRole) {
          const bet = entityTypes.find(
            (et) => et.boundToRole === assignedRole.name
          )
          if (bet) {
            setPendingEntityCreation(bet)
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCreateBoundEntity = async () => {
    if (!pendingEntityCreation) return
    setIsCreatingEntity(true)
    try {
      const userIdField = pendingEntityCreation.userIdField || "userId"
      const schema = pendingEntityCreation.schema as { properties?: Record<string, unknown>; required?: string[] } | undefined
      const properties = schema?.properties || {}

      const data: Record<string, unknown> = {
        [userIdField]: user.clerkUserId,
      }
      if ("name" in properties && user.name) {
        data.name = user.name
      }
      if ("email" in properties && user.email) {
        data.email = user.email
      }

      await createEntity({
        entityTypeSlug: pendingEntityCreation.slug,
        environment,
        data,
        status: "active",
      })
      setPendingEntityCreation(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create entity")
    } finally {
      setIsCreatingEntity(false)
    }
  }

  const handleOpenLinkDialog = (et: Doc<"entityTypes">) => {
    setLinkEntityType(et)
    setLinkDialogOpen(true)
  }

  const handleRemoveUser = async () => {
    if (!window.confirm(`Remove ${user.name || user.email} from the organization? This action cannot be undone.`)) return
    try {
      await removeUser(user.clerkUserId)
      toast.success(`${user.name || user.email} has been removed from the organization`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove user")
    }
  }

  const isSelf = currentClerkUserId === user.clerkUserId
  const canRemove = !isSelf && user.role !== "admin"

  const roleIcon = user.role === "admin" ? Shield : User

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background-tertiary p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          {roleIcon === Shield ? (
            <Shield className="h-4 w-4 text-primary" />
          ) : (
            <User className="h-4 w-4 text-content-secondary" />
          )}
        </div>
        <div>
          <div className="font-medium text-content-primary">{user.name || "Unnamed User"}</div>
          <div className="text-sm text-content-secondary">{user.email}</div>
          {boundEntityType && (
            <div className="mt-1 flex items-center gap-2">
              {linkedEntity ? (
                <>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                    {boundEntityType.name}: {(linkedEntity as { data?: { name?: string; email?: string } }).data?.name || (linkedEntity as { data?: { name?: string; email?: string } }).data?.email || "Linked"}
                  </span>
                  {permissions.canUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-xs text-content-secondary hover:text-red-400"
                      onClick={() => setUnlinkDialogOpen(true)}
                    >
                      <Unlink className="h-4 w-4" />
                    </Button>
                  )}
                </>
              ) : linkedEntity === null ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-content-secondary">No {boundEntityType.name} entity</span>
                  {permissions.canUpdate && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs"
                        onClick={() => handleOpenLinkDialog(boundEntityType)}
                      >
                        <Link className="h-4 w-4 mr-1" />
                        Link
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs"
                        onClick={() => setPendingEntityCreation(boundEntityType)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create
                      </Button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-content-secondary">Org Role:</span>
            <Select
              value={user.role}
              onValueChange={handleOrgRoleChange}
              disabled={isUpdating || !permissions.isAdmin}
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
                disabled={isUpdating || !permissions.canUpdate}
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
        {permissions.canDelete && canRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleRemoveUser}
            disabled={isRemoving}
          >
            {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <Dialog open={!!pendingEntityCreation} onOpenChange={(open) => !open && setPendingEntityCreation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create {pendingEntityCreation?.name}</DialogTitle>
            <DialogDescription>
              No {pendingEntityCreation?.name} record is linked to {user.name || user.email} yet. Would you like to create one now?
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-content-secondary space-y-1">
            {user.name && <p>Name: {user.name}</p>}
            <p>Email: {user.email}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingEntityCreation(null)} disabled={isCreatingEntity}>
              Skip
            </Button>
            <Button onClick={handleCreateBoundEntity} disabled={isCreatingEntity}>
              {isCreatingEntity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create {pendingEntityCreation?.name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {linkEntityType && (
        <LinkEntityDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          userId={user._id}
          userEmail={user.email}
          entityTypeId={linkEntityType._id}
          entityTypeName={linkEntityType.name}
        />
      )}

      {boundEntityType && linkedEntity && (
        <UnlinkEntityDialog
          open={unlinkDialogOpen}
          onOpenChange={setUnlinkDialogOpen}
          entityId={(linkedEntity as { _id: Id<"entities"> })._id}
          entityName={(linkedEntity as { data?: { name?: string } }).data?.name || boundEntityType.name}
        />
      )}
    </div>
  )
}

export function UsersPanel({ permissions }: { permissions: UserPermissions }) {
  const { environment } = useEnvironment()
  const { user: clerkUser } = useUser()
  const users = useUsers()
  const roles = useRoles(environment)
  const entityTypes = useEntityTypes(environment)
  const [inviteOpen, setInviteOpen] = useState(false)

  if (users === undefined || roles === undefined || entityTypes === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-semibold text-content-primary">Users</h1>
            <p className="text-sm text-content-secondary">Manage team members and their roles</p>
          </div>
          {permissions.canCreate && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          )}
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
        <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} isAdmin={permissions.isAdmin} />
      </div>
    )
  }

  const assignableRoles = roles.filter((r: Doc<"roles">) => !r.isSystem)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold text-content-primary">Users</h1>
          <p className="text-sm text-content-secondary">Manage team members and their roles</p>
        </div>
        {permissions.canCreate && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        )}
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
            users.map((user: UserWithRole) => (
              <UserRow key={user._id} user={user} roles={assignableRoles} entityTypes={entityTypes ?? []} currentClerkUserId={clerkUser?.id} permissions={permissions} />
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
              Each member can have an assigned role that controls access to specific entity types and actions.
            </p>
          </div>
        </CardContent>
      </Card>

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} roles={assignableRoles} environment={environment} isAdmin={permissions.isAdmin} />
    </div>
  )
}
