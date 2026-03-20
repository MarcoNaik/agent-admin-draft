"use client"

import { useState, useMemo } from "react"
import { Loader2, UserPlus } from "@/lib/icons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreatePendingAssignment, useEntityTypes } from "@/hooks/use-convex-data"
import { useEntitiesByEmail } from "@/hooks/use-entities"
import { Doc, Id } from "@convex/_generated/dataModel"
import type { Environment } from "@/contexts/environment-context"

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles?: Doc<"roles">[]
  environment?: Environment
  isAdmin?: boolean
}

export function InviteUserDialog({ open, onOpenChange, roles, environment, isAdmin }: InviteUserDialogProps) {
  const [email, setEmail] = useState("")
  const [orgRole, setOrgRole] = useState<string>("org:member")
  const [internalRoleId, setInternalRoleId] = useState<string>("none")
  const [entityChoice, setEntityChoice] = useState<string>("create")
  const [isInviting, setIsInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createPendingAssignment = useCreatePendingAssignment()
  const entityTypes = useEntityTypes(environment)

  const selectedRole = useMemo(() => {
    if (internalRoleId === "none" || !roles) return null
    return roles.find((r) => r._id === internalRoleId) ?? null
  }, [internalRoleId, roles])

  const boundEntityType = useMemo(() => {
    if (!selectedRole || !entityTypes) return null
    return entityTypes.find((et: Doc<"entityTypes">) => et.boundToRole === selectedRole.name) ?? null
  }, [selectedRole, entityTypes])

  const showEntityFields = !!boundEntityType

  const matchingEntities = useEntitiesByEmail(
    boundEntityType?._id ?? undefined,
    showEntityFields && email ? email.trim() : undefined,
    environment
  )

  const handleInvite = async () => {
    if (!email.trim()) return

    setIsInviting(true)
    setError(null)
    try {
      const res = await fetch("/api/organizations/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAddress: email.trim(), role: orgRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to send invitation")
      }

      if (orgRole === "org:member" && internalRoleId !== "none" && environment) {
        const assignmentArgs: {
          email: string
          roleId: Id<"roles">
          environment: Environment
          linkedEntityId?: Id<"entities">
        } = {
          email: email.trim(),
          roleId: internalRoleId as Id<"roles">,
          environment,
        }

        if (entityChoice !== "create") {
          assignmentArgs.linkedEntityId = entityChoice as Id<"entities">
        }

        await createPendingAssignment(assignmentArgs)
      }

      resetForm()
      onOpenChange(false)
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || "Failed to send invitation"
      setError(message)
    } finally {
      setIsInviting(false)
    }
  }

  const resetForm = () => {
    setEmail("")
    setOrgRole("org:member")
    setInternalRoleId("none")
    setEntityChoice("create")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && email.trim()) {
      handleInvite()
    }
  }

  const handleOrgRoleChange = (value: string) => {
    setOrgRole(value)
    if (value !== "org:member") {
      setInternalRoleId("none")
      setEntityChoice("create")
    }
  }

  const handleRoleChange = (value: string) => {
    setInternalRoleId(value)
    setEntityChoice("create")
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

  const showInternalRoleSelector = orgRole === "org:member" && roles && roles.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-background-secondary border-border/50">
        <DialogHeader>
          <DialogTitle className="text-content-primary">Invite User</DialogTitle>
          <DialogDescription className="text-content-secondary">
            Send an invitation to join your organization.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-content-primary">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null) }}
              onKeyDown={handleKeyDown}
              disabled={isInviting}
              className="font-input bg-background-tertiary border-border/50"
              autoFocus
            />
          </div>
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="role" className="text-content-primary">Organization Role</Label>
              <Select value={orgRole} onValueChange={handleOrgRoleChange} disabled={isInviting}>
                <SelectTrigger className="bg-background-tertiary border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="org:member">Member</SelectItem>
                  <SelectItem value="org:admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {showInternalRoleSelector && (
            <div className="space-y-2">
              <Label htmlFor="internalRole" className="text-content-primary">Internal Role</Label>
              <Select value={internalRoleId} onValueChange={handleRoleChange} disabled={isInviting}>
                <SelectTrigger className="bg-background-tertiary border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No role</SelectItem>
                  {roles!.map((r) => (
                    <SelectItem key={r._id} value={r._id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-content-secondary">
                Auto-assigned when the user accepts the invite
              </p>
            </div>
          )}

          {showEntityFields && email && (
            <div className="space-y-3">
              {matchingEntities && matchingEntities.length > 0 ? (
                <>
                  <Label className="text-content-primary">
                    Existing {boundEntityType!.name} records found
                  </Label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {matchingEntities.map((entity: any) => (
                      <div
                        key={entity._id}
                        onClick={() => setEntityChoice(entity._id)}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer bg-background-tertiary ${
                          entityChoice === entity._id ? "border-primary" : "border-border/50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-content-primary truncate">
                            {entity.data?.name || entity._id}
                          </div>
                          {entity.data?.email && (
                            <div className="text-xs text-content-secondary truncate">
                              {entity.data.email}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-content-secondary shrink-0">Link existing</span>
                      </div>
                    ))}
                    <div
                      onClick={() => setEntityChoice("create")}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer bg-background-tertiary ${
                        entityChoice === "create" ? "border-primary" : "border-border/50"
                      }`}
                    >
                      <span className="text-sm text-content-primary">
                        Create new {boundEntityType!.name}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-content-secondary">
                  A new {boundEntityType!.name} will be created
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isInviting}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={!email.trim() || isInviting}>
            {isInviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
