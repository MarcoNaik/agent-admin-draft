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

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<string>("org:member")
  const [isInviting, setIsInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { organization } = useOrganization()

  const handleInvite = async () => {
    if (!email.trim() || !organization) return

    setIsInviting(true)
    setError(null)
    try {
      await organization.inviteMember({ emailAddress: email.trim(), role })
      setEmail("")
      setRole("org:member")
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
              className="bg-background-tertiary border-border/50"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role" className="text-content-primary">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={isInviting}>
              <SelectTrigger className="bg-background-tertiary border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="org:member">Member</SelectItem>
                <SelectItem value="org:admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
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
