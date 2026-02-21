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
    <div className="mx-4 my-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
      <div className="flex items-start gap-2 mb-3">
        <Shield className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-content-primary">Permission Request</p>
          <p className="text-xs text-content-secondary mt-0.5 font-mono">{permission.action}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onReply(permission.permission_id, "once")}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
        >
          Allow Once
        </button>
        <button
          type="button"
          onClick={() => onReply(permission.permission_id, "always")}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
        >
          Always Allow
        </button>
        <button
          type="button"
          onClick={() => onReply(permission.permission_id, "reject")}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
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
    <div className="mx-4 my-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
      <div className="flex items-start gap-2 mb-3">
        <HelpCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-content-primary">Question</p>
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
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit
        </button>
        <button
          type="button"
          onClick={() => onReject(question.question_id)}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
