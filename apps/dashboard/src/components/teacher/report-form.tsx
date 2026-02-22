"use client"

import { useState, FormEvent } from "react"
import { useUpdateEntity } from "@/hooks/use-convex-data"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Id } from "@convex/_generated/dataModel"

interface ReportFormProps {
  sessionId: Id<"entities">
  onSuccess?: () => void
}

export function ReportForm({ sessionId, onSuccess }: ReportFormProps) {
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const updateEntity = useUpdateEntity()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await updateEntity({
        id: sessionId,
        data: {
          reportContent: content,
          reportSubmittedAt: Date.now(),
        },
        status: "completed",
      })
      setContent("")
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Describe what was covered in the session, student progress, and any notes for parents..."
        className="min-h-[160px] font-input bg-background-tertiary"
        required
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <Button
        type="submit"
        disabled={submitting || !content.trim()}
        className="w-full"
      >
        {submitting ? "Submitting..." : "Submit Report"}
      </Button>
    </form>
  )
}
