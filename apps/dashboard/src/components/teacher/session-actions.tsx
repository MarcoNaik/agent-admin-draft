"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCurrentRole } from "@/hooks/use-current-role"
import { useDeleteEntity } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Id } from "@convex/_generated/dataModel"

interface SessionData {
  teacherId?: string
  reportSubmittedAt?: number
  status?: string
}

interface SessionActionsProps {
  sessionId: Id<"entities">
  sessionData: SessionData
  onReportClick?: () => void
}

export function SessionActions({ sessionId, sessionData, onReportClick }: SessionActionsProps) {
  const router = useRouter()
  const { role, userId } = useCurrentRole()
  const deleteEntity = useDeleteEntity()
  const { environment } = useEnvironment()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canEdit = role === "admin" || (userId && sessionData.teacherId === String(userId))
  const canDelete = role === "admin"
  const canSubmitReport = role === "teacher" && !sessionData.reportSubmittedAt && sessionData.status !== "completed"

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteEntity({ id: sessionId, environment })
      setShowDeleteDialog(false)
      router.push("/teacher/sessions")
    } catch (err) {
      console.error("Failed to delete session:", err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        {canEdit && (
          <Button
            variant="outline"
            onClick={() => router.push(`/entities/session/${sessionId}`)}
          >
            Edit
          </Button>
        )}

        {canSubmitReport && onReportClick && (
          <Button onClick={onReportClick}>
            Submit Report
          </Button>
        )}

        {canDelete && (
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete
          </Button>
        )}
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this session? This action cannot be undone.
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
