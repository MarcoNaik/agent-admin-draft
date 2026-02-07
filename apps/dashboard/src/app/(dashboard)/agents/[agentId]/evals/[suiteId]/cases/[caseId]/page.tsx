"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, ArrowLeft, Plus, Trash2, Save } from "lucide-react"
import { useEvalCase, useUpdateEvalCase } from "@/hooks/use-convex-data"
import { Id } from "@convex/_generated/dataModel"

interface EditCasePageProps {
  params: { agentId: string; suiteId: string; caseId: string }
}

type AssertionType = "llm_judge" | "contains" | "matches" | "tool_called" | "tool_not_called"

interface AssertionForm {
  type: AssertionType
  criteria?: string
  value?: string
  weight?: number
}

interface TurnForm {
  userMessage: string
  assertions: AssertionForm[]
}

export default function EditCasePage({ params }: EditCasePageProps) {
  const { agentId, suiteId, caseId } = params
  const router = useRouter()
  const evalCase = useEvalCase(caseId as Id<"evalCases">)
  const updateCase = useUpdateEvalCase()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [turns, setTurns] = useState<TurnForm[]>([])
  const [finalAssertions, setFinalAssertions] = useState<AssertionForm[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (evalCase && !loaded) {
      setName(evalCase.name)
      setDescription(evalCase.description || "")
      setTags(evalCase.tags?.join(", ") || "")
      setTurns(
        evalCase.turns.map((t: any) => ({
          userMessage: t.userMessage,
          assertions: (t.assertions || []).map((a: any) => ({
            type: a.type,
            criteria: a.criteria,
            value: a.value,
            weight: a.weight,
          })),
        }))
      )
      setFinalAssertions(
        (evalCase.finalAssertions || []).map((a: any) => ({
          type: a.type,
          criteria: a.criteria,
          value: a.value,
          weight: a.weight,
        }))
      )
      setLoaded(true)
    }
  }, [evalCase, loaded])

  if (evalCase === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (!evalCase) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-content-secondary">Case not found</p>
      </div>
    )
  }

  const addTurn = () => setTurns([...turns, { userMessage: "", assertions: [] }])
  const removeTurn = (idx: number) => setTurns(turns.filter((_, i) => i !== idx))
  const updateTurnMessage = (idx: number, message: string) => {
    setTurns(turns.map((t, i) => i === idx ? { ...t, userMessage: message } : t))
  }

  const addAssertion = (turnIdx: number) => {
    setTurns(turns.map((t, i) =>
      i === turnIdx ? { ...t, assertions: [...t.assertions, { type: "contains" as AssertionType, value: "" }] } : t
    ))
  }

  const removeAssertion = (turnIdx: number, assertIdx: number) => {
    setTurns(turns.map((t, i) =>
      i === turnIdx ? { ...t, assertions: t.assertions.filter((_, ai) => ai !== assertIdx) } : t
    ))
  }

  const updateAssertion = (turnIdx: number, assertIdx: number, field: string, value: string | number) => {
    setTurns(turns.map((t, i) =>
      i === turnIdx ? { ...t, assertions: t.assertions.map((a, ai) =>
        ai === assertIdx ? { ...a, [field]: value } : a
      ) } : t
    ))
  }

  const addFinalAssertion = () => setFinalAssertions([...finalAssertions, { type: "llm_judge", criteria: "" }])
  const removeFinalAssertion = (idx: number) => setFinalAssertions(finalAssertions.filter((_, i) => i !== idx))
  const updateFinalAssertion = (idx: number, field: string, value: string | number) => {
    setFinalAssertions(finalAssertions.map((a, i) =>
      i === idx ? { ...a, [field]: value } : a
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || turns.length === 0 || turns.some((t) => !t.userMessage.trim())) return

    setSaving(true)
    setError(null)

    try {
      const formattedTurns = turns.map((t) => ({
        userMessage: t.userMessage.trim(),
        assertions: t.assertions.length > 0
          ? t.assertions.map((a) => ({
              type: a.type,
              ...(a.criteria ? { criteria: a.criteria } : {}),
              ...(a.value ? { value: a.value } : {}),
              ...(a.weight ? { weight: a.weight } : {}),
            }))
          : undefined,
      }))

      const formattedFinal = finalAssertions.length > 0
        ? finalAssertions.map((a) => ({
            type: a.type,
            ...(a.criteria ? { criteria: a.criteria } : {}),
            ...(a.value ? { value: a.value } : {}),
            ...(a.weight ? { weight: a.weight } : {}),
          }))
        : undefined

      await updateCase({
        id: evalCase._id,
        name: name.trim(),
        description: description.trim() || undefined,
        tags: tags.trim() ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        turns: formattedTurns,
        finalAssertions: formattedFinal,
      })

      router.push(`/agents/${agentId}/evals/${suiteId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update case")
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/agents/${agentId}/evals/${suiteId}`}
          className="rounded-md p-1.5 hover:bg-background-tertiary transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-content-secondary" />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-content-primary">Edit Test Case</h2>
          <p className="text-sm text-content-secondary mt-0.5">{evalCase.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-content-primary">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-content-primary">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="happy-path, booking"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-content-primary">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-content-primary">Turns</label>
            <button
              type="button"
              onClick={addTurn}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Turn
            </button>
          </div>

          {turns.map((turn, turnIdx) => (
            <div key={turnIdx} className="rounded-md border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-content-secondary">Turn {turnIdx + 1}</span>
                {turns.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTurn(turnIdx)}
                    className="rounded p-1 text-content-tertiary hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <textarea
                value={turn.userMessage}
                onChange={(e) => updateTurnMessage(turnIdx, e.target.value)}
                placeholder="User message..."
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-content-tertiary">Assertions</label>
                  <button
                    type="button"
                    onClick={() => addAssertion(turnIdx)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>

                {turn.assertions.map((assertion, assertIdx) => (
                  <AssertionRow
                    key={assertIdx}
                    assertion={assertion}
                    onUpdate={(field, value) => updateAssertion(turnIdx, assertIdx, field, value)}
                    onRemove={() => removeAssertion(turnIdx, assertIdx)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-content-primary">Final Assertions</label>
            <button
              type="button"
              onClick={addFinalAssertion}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>

          {finalAssertions.map((assertion, idx) => (
            <AssertionRow
              key={idx}
              assertion={assertion}
              onUpdate={(field, value) => updateFinalAssertion(idx, field, value)}
              onRemove={() => removeFinalAssertion(idx)}
            />
          ))}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={!name.trim() || turns.some((t) => !t.userMessage.trim()) || saving}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
          <Link
            href={`/agents/${agentId}/evals/${suiteId}`}
            className="rounded-md border px-4 py-2 text-sm text-content-secondary hover:bg-background-tertiary transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

function AssertionRow({
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
      <select
        value={assertion.type}
        onChange={(e) => onUpdate("type", e.target.value)}
        className="rounded border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="contains">contains</option>
        <option value="matches">matches</option>
        <option value="tool_called">tool_called</option>
        <option value="tool_not_called">tool_not_called</option>
        <option value="llm_judge">llm_judge</option>
      </select>

      {needsCriteria && (
        <input
          type="text"
          value={assertion.criteria || ""}
          onChange={(e) => onUpdate("criteria", e.target.value)}
          placeholder="Evaluation criteria..."
          className="flex-1 rounded border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}

      {needsValue && (
        <input
          type="text"
          value={assertion.value || ""}
          onChange={(e) => onUpdate("value", e.target.value)}
          placeholder={assertion.type.includes("tool") ? "entity.query" : "expected text"}
          className="flex-1 rounded border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-content-tertiary hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
