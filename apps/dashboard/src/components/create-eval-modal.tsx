"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useThreadWithMessages } from "@/hooks/use-threads"
import { Doc, Id } from "@convex/_generated/dataModel"

interface CreateEvalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentName: string
  threadId: Id<"threads"> | null
}

export function CreateEvalModal({
  open,
  onOpenChange,
  agentName,
  threadId,
}: CreateEvalModalProps) {
  const router = useRouter()
  const threadData = useThreadWithMessages(threadId)
  const [criteria, setCriteria] = useState("")

  const handleSubmit = () => {
    if (!criteria.trim()) return

    const transcript = threadData?.messages
      ?.map((m: Doc<"messages">) => {
        const role = m.role === "user" ? "User" : "Assistant"
        return `${role}: ${m.content}`
      })
      .join("\n") ?? ""

    const prompt = `Turn this conversation into an eval suite for agent '${agentName}'. The agent should get this right: ${criteria.trim()}.\n\nHere's the conversation:\n\n${transcript}`

    handleOpenChange(false)
    router.push(`/?studio=${encodeURIComponent(prompt)}`)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) setCriteria("")
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create eval from conversation</DialogTitle>
          <DialogDescription>Describe what the agent should get right, then generate an eval suite in Studio.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="eval-criteria" className="text-sm font-medium text-content-primary">
              What should the agent get right?
            </label>
            <Textarea
              id="eval-criteria"
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              placeholder="Always greet by name, suggest relevant next steps..."
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!criteria.trim() || (threadId !== null && !threadData)}>
              Create with Studio
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
