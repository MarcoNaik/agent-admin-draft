"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react"
import { useCreateEvalCase } from "@/hooks/use-convex-data"
import { AssertionRow, type AssertionType, type AssertionForm } from "@/components/evals/assertion-row"
import { Id } from "@convex/_generated/dataModel"

interface NewCasePageProps {
  params: { agentId: string; suiteId: string }
}

interface TurnForm {
  userMessage: string
  assertions: AssertionForm[]
}

export default function NewCasePage({ params }: NewCasePageProps) {
  const { agentId, suiteId } = params
  const router = useRouter()
  const createCase = useCreateEvalCase()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [turns, setTurns] = useState<TurnForm[]>([{ userMessage: "", assertions: [] }])
  const [finalAssertions, setFinalAssertions] = useState<AssertionForm[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addTurn = () => {
    setTurns([...turns, { userMessage: "", assertions: [] }])
  }

  const removeTurn = (idx: number) => {
    setTurns(turns.filter((_, i) => i !== idx))
  }

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

  const addFinalAssertion = () => {
    setFinalAssertions([...finalAssertions, { type: "llm_judge", criteria: "" }])
  }

  const removeFinalAssertion = (idx: number) => {
    setFinalAssertions(finalAssertions.filter((_, i) => i !== idx))
  }

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

      await createCase({
        suiteId: suiteId as Id<"evalSuites">,
        name: name.trim(),
        description: description.trim() || undefined,
        tags: tags.trim() ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        turns: formattedTurns,
        finalAssertions: formattedFinal,
      })

      router.push(`/agents/${agentId}/evals/${suiteId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case")
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/agents/${agentId}/evals/${suiteId}`}
          className="rounded-md p-1.5 hover:bg-background-tertiary transition-colors ease-out-soft"
        >
          <ArrowLeft className="h-4 w-4 text-content-secondary" />
        </Link>
        <div>
          <h2 className="text-xl font-semibold font-display text-content-primary">New Test Case</h2>
          <p className="text-sm text-content-secondary mt-0.5">Define a multi-turn conversation with assertions</p>
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
              placeholder="Happy path booking"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-content-primary">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="happy-path, booking"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-content-primary">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tests the happy path for session booking..."
            rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-content-primary">Turns</label>
            <button
              type="button"
              onClick={addTurn}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors ease-out-soft"
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
                    className="rounded p-1 text-content-tertiary hover:text-destructive hover:bg-destructive/10 transition-colors ease-out-soft"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-content-tertiary">User Message</label>
                <textarea
                  value={turn.userMessage}
                  onChange={(e) => updateTurnMessage(turnIdx, e.target.value)}
                  placeholder="Book a session for tomorrow at 3pm"
                  rows={3}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-content-tertiary">Assertions</label>
                  <button
                    type="button"
                    onClick={() => addAssertion(turnIdx)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors ease-out-soft"
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
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors ease-out-soft"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          <p className="text-xs text-content-tertiary">Evaluated after all turns complete, against the last response</p>

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
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors ease-out-soft"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Case
          </button>
          <Link
            href={`/agents/${agentId}/evals/${suiteId}`}
            className="rounded-md border px-4 py-2 text-sm text-content-secondary hover:bg-background-tertiary transition-colors ease-out-soft"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
