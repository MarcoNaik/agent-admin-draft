"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, MoreHorizontal, Eye } from "lucide-react"
import { useRoleContext } from "@/contexts/role-context"
import { useEnvironment } from "@/contexts/environment-context"
import { useDeleteEntity } from "@/hooks/use-convex-data"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Id } from "@convex/_generated/dataModel"

interface EntityActionsProps {
  entityId: Id<"entities">
  entityType: string
  ownerId?: string
  onView?: () => void
  onEdit?: () => void
}

export function EntityActions({ entityId, entityType, ownerId, onView, onEdit }: EntityActionsProps) {
  const router = useRouter()
  const { userId, isAdmin } = useRoleContext()
  const { environment } = useEnvironment()
  const deleteEntity = useDeleteEntity()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isOwner = ownerId && userId ? ownerId === String(userId) : false
  const canView = true
  const canEdit = isAdmin || isOwner
  const canDelete = isAdmin

  const handleView = () => {
    if (onView) {
      onView()
    } else {
      router.push(`/entities/${entityType}/${entityId}`)
    }
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit()
    } else {
      router.push(`/entities/${entityType}/${entityId}`)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteEntity({ id: entityId, environment })
      setShowDeleteDialog(false)
    } catch (err) {
      console.error("Failed to delete entity:", err)
    } finally {
      setDeleting(false)
    }
  }

  if (!canView && !canEdit && !canDelete) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canView && (
            <DropdownMenuItem onClick={handleView}>
              <Eye className="mr-2 h-4 w-4" />
              View
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {entityType}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {entityType}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
