"use client"

import { useState } from "react"
import { useOrganization } from "@clerk/nextjs"
import { Loader2, UserPlus } from "lucide-react"
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
import { useCreatePendingAssignment } from "@/hooks/use-convex-data"
import { Doc } from "@convex/_generated/dataModel"
import type { Environment } from "@/contexts/environment-context"

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles?: Doc<"roles">[]
  environment?: Environment
}

export function InviteUserDialog({ open, onOpenChange, roles, environment }: InviteUserDialogProps) {
  const [email, setEmail] = useState("")
  const [orgRole, setOrgRole] = useState<string>("org:member")
  const [internalRoleId, setInternalRoleId] = useState<string>("none")
  const [isInviting, setIsInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { organization } = useOrganization()
  const createPendingAssignment = useCreatePendingAssignment()

  const handleInvite = async () => {
    if (!email.trim() || !organization) return

    setIsInviting(true)
    setError(null)
    try {
      await organization.inviteMember({ emailAddress: email.trim(), role: orgRole })

      if (orgRole === "org:member" && internalRoleId !== "none" && environment) {
        await createPendingAssignment({
          email: email.trim(),
          roleId: internalRoleId as any,
          environment,
        })
      }

      setEmail("")
      setOrgRole("org:member")
      setInternalRoleId("none")
      onOpenChange(false)
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || "Failed to send invitation"
      setError(message)
    } finally {
      setIsInviting(false)
    }
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
    }
  }

  const showInternalRoleSelector = orgRole === "org:member" && roles && roles.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {showInternalRoleSelector && (
            <div className="space-y-2">
              <Label htmlFor="internalRole" className="text-content-primary">Internal Role</Label>
              <Select value={internalRoleId} onValueChange={setInternalRoleId} disabled={isInviting}>
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
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isInviting}>
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
