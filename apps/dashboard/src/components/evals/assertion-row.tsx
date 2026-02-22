"use client"

import { Trash2 } from "lucide-react"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"

export type AssertionType = "llm_judge" | "contains" | "matches" | "tool_called" | "tool_not_called"

export interface AssertionForm {
  type: AssertionType
  criteria?: string
  value?: string
  weight?: number
}

const assertionDescriptions: Record<AssertionType, string> = {
  contains: "Response must contain this text",
  matches: "Response must match this regex",
  tool_called: "Agent must call this tool",
  tool_not_called: "Agent must NOT call this tool",
  llm_judge: "LLM judges response against criteria (1-5)",
}

export function AssertionRow({
  assertion,
  onUpdate,
  onRemove,
}: {
  assertion: { type: string; criteria?: string; value?: string; weight?: number }
  onUpdate: (field: string, value: string | number) => void
  onRemove: () => void
}) {
  const needsCriteria = assertion.type === "llm_judge"
  const needsValue = ["contains", "matches", "tool_called", "tool_not_called"].includes(assertion.type)

  return (
    <div className="flex items-start gap-2 rounded-md border bg-background p-2.5">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <select
              value={assertion.type}
              onChange={(e) => onUpdate("type", e.target.value)}
              className="rounded border bg-background px-2 py-1.5 text-xs font-input focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="contains">contains</option>
              <option value="matches">matches</option>
              <option value="tool_called">tool_called</option>
              <option value="tool_not_called">tool_not_called</option>
              <option value="llm_judge">llm_judge</option>
            </select>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[200px]">
            {assertionDescriptions[assertion.type as AssertionType]}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {needsCriteria && (
        <input
          type="text"
          value={assertion.criteria || ""}
          onChange={(e) => onUpdate("criteria", e.target.value)}
          placeholder="Agent should acknowledge and ask for details"
          className="flex-1 rounded border bg-background px-2 py-1.5 text-xs font-input focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}

      {needsValue && (
        <input
          type="text"
          value={assertion.value || ""}
          onChange={(e) => onUpdate("value", e.target.value)}
          placeholder={assertion.type.includes("tool") ? "entity.query" : "expected text"}
          className="flex-1 rounded border bg-background px-2 py-1.5 text-xs font-input focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}

      <input
        type="number"
        value={assertion.weight ?? ""}
        onChange={(e) => onUpdate("weight", e.target.value === "" ? 0 : parseFloat(e.target.value))}
        placeholder="1.0"
        min={0}
        max={1}
        step={0.1}
        className="w-16 rounded border bg-background px-2 py-1.5 text-xs font-input text-center focus:outline-none focus:ring-2 focus:ring-primary"
      />

      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-content-tertiary hover:text-destructive hover:bg-destructive/10 transition-colors ease-out-soft shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
