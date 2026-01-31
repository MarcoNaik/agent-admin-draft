"use client"

import { useState } from "react"
import { useOrganizationList } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface CreateOrgDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateOrgDialog({ open, onOpenChange, onSuccess }: CreateOrgDialogProps) {
  const [name, setName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const { createOrganization, setActive } = useOrganizationList()

  const handleCreate = async () => {
    if (!name.trim() || !createOrganization) return

    setIsCreating(true)
    try {
      const org = await createOrganization({ name: name.trim() })
      await setActive?.({ organization: org.id })
      setName("")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error("Failed to create organization:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim()) {
      handleCreate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background-secondary border-border/50">
        <DialogHeader>
          <DialogTitle className="text-content-primary">Create Organization</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-content-secondary">
          Collaborate with your team members by creating a Struere Organization.
        </p>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isCreating}
            className="flex-1 bg-background-tertiary border-border/50"
            autoFocus
          />
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="shrink-0"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
