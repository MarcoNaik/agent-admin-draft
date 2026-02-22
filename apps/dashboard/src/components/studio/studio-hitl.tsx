"use client"

import { useState } from "react"
import { Shield, HelpCircle } from "lucide-react"
import type { PendingPermission, PendingQuestion } from "@/hooks/use-studio-events"

interface PermissionRequestCardProps {
  permission: PendingPermission
  onReply: (id: string, reply: "once" | "always" | "reject") => void
}

export function PermissionRequestCard({ permission, onReply }: PermissionRequestCardProps) {
  return (
    <div className="mx-4 my-2 rounded-lg border border-warning/30 bg-warning/5 p-3 backdrop-blur-sm">
      <div className="flex items-start gap-2 mb-3">
        <Shield className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-display font-medium text-content-primary">Permission Request</p>
          <p className="text-xs text-content-secondary mt-0.5 font-mono">{permission.action}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onReply(permission.permission_id, "once")}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-warning/20 text-warning hover:bg-warning/30 transition-colors ease-out-soft"
        >
          Allow Once
        </button>
        <button
          type="button"
          onClick={() => onReply(permission.permission_id, "always")}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-success/20 text-success hover:bg-success/30 transition-colors ease-out-soft"
        >
          Always Allow
        </button>
        <button
          type="button"
          onClick={() => onReply(permission.permission_id, "reject")}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors ease-out-soft"
        >
          Reject
        </button>
      </div>
    </div>
  )
}

interface QuestionRequestCardProps {
  question: PendingQuestion
  onAnswer: (id: string, answers: string[][]) => void
  onReject: (id: string) => void
}

export function QuestionRequestCard({ question, onAnswer, onReject }: QuestionRequestCardProps) {
  const [selected, setSelected] = useState<string[]>([])

  return (
    <div className="mx-4 my-2 rounded-lg border border-ocean/30 bg-ocean/5 p-3 backdrop-blur-sm">
      <div className="flex items-start gap-2 mb-3">
        <HelpCircle className="h-4 w-4 text-ocean shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-display font-medium text-content-primary">Question</p>
          <p className="text-xs text-content-secondary mt-0.5">{question.prompt}</p>
        </div>
      </div>
      {question.options.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {question.options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelected([...selected, option])
                  } else {
                    setSelected(selected.filter((s) => s !== option))
                  }
                }}
                className="rounded border-border"
              />
              <span className="text-content-primary">{option}</span>
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAnswer(question.question_id, [selected])}
          disabled={selected.length === 0}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-ocean/20 text-ocean hover:bg-ocean/30 transition-colors ease-out-soft disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit
        </button>
        <button
          type="button"
          onClick={() => onReject(question.question_id)}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors ease-out-soft"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
