"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "@/lib/icons"
import { useCreateEvalSuite, useUpdateEvalSuite } from "@/hooks/use-convex-data"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from "@/components/ui/select"
import { Id } from "@convex/_generated/dataModel"

const modelOptions: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  xai: {
    label: "xAI",
    models: [
      { value: "openai/gpt-5-mini", label: "openai/gpt-5-mini" },
      { value: "openai/gpt-5-mini-reasoning", label: "openai/gpt-5-mini-reasoning" },
    ],
  },
  anthropic: {
    label: "Anthropic",
    models: [
      { value: "anthropic/claude-haiku-4-5-20251001", label: "anthropic/claude-haiku-4-5-20251001" },
      { value: "anthropic/claude-sonnet-4-20250514", label: "anthropic/claude-sonnet-4-20250514" },
    ],
  },
  openai: {
    label: "OpenAI",
    models: [
      { value: "openai/gpt-4o", label: "openai/gpt-4o" },
      { value: "openai/gpt-4o-mini", label: "openai/gpt-4o-mini" },
    ],
  },
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

interface EvalSuiteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: Id<"agents">
  environment: string
  suite?: any
}

export function EvalSuiteDialog({ open, onOpenChange, agentId, environment, suite }: EvalSuiteDialogProps) {
  const createSuite = useCreateEvalSuite()
  const updateSuite = useUpdateEvalSuite()
  const isEdit = !!suite

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugManual, setSlugManual] = useState(false)
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [judgeModel, setJudgeModel] = useState("openai/gpt-5-mini")
  const [customModel, setCustomModel] = useState(false)
  const [judgeContext, setJudgeContext] = useState("")
  const [judgePrompt, setJudgePrompt] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && suite) {
      setName(suite.name)
      setSlug(suite.slug)
      setSlugManual(true)
      setDescription(suite.description || "")
      setTags(suite.tags?.join(", ") || "")
      if (suite.judgeModel) {
        setJudgeModel(suite.judgeModel.model || "openai/gpt-5-mini")
      }
      setJudgeContext(suite.judgeContext || "")
      setJudgePrompt(suite.judgePrompt || "")
    } else if (open && !suite) {
      setName("")
      setSlug("")
      setSlugManual(false)
      setDescription("")
      setTags("")
      setJudgeModel("openai/gpt-5-mini")
      setCustomModel(false)
      setJudgeContext("")
      setJudgePrompt("")
      setError(null)
    }
  }, [open, suite])

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugManual) {
      setSlug(slugify(value))
    }
  }

  const handleModelSelect = (value: string) => {
    if (value === "__custom__") {
      setCustomModel(true)
      setJudgeModel("")
      return
    }
    setCustomModel(false)
    setJudgeModel(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (!isEdit && !slug.trim()) return

    setSaving(true)
    setError(null)

    try {
      if (isEdit) {
        await updateSuite({
          id: suite._id,
          name: name.trim(),
          description: description.trim() || undefined,
          tags: tags.trim() ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
          judgeModel: { model: judgeModel },
          judgeContext: judgeContext.trim() || undefined,
          judgePrompt: judgePrompt.trim() || undefined,
        })
      } else {
        await createSuite({
          agentId,
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          tags: tags.trim() ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
          judgeModel: { model: judgeModel },
          judgeContext: judgeContext.trim() || undefined,
          judgePrompt: judgePrompt.trim() || undefined,
          environment: environment as any,
        })
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? "update" : "create"} suite`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Suite" : "New Eval Suite"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-content-primary">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Booking Flow Tests"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-content-primary">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugManual(true) }}
                placeholder="booking-flow-tests"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-content-primary">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tests for the booking workflow..."
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-content-primary">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="booking, scheduling, happy-path"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-content-tertiary">Comma-separated</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-content-primary">Judge Model</label>
            {!customModel ? (
              <Select value={judgeModel} onValueChange={handleModelSelect}>
                <SelectTrigger className="w-full font-input text-sm">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(modelOptions).map(([provider, group]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.models.map((model) => (
                        <SelectItem key={model.value} value={model.value} className="font-input">
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                  <SelectSeparator />
                  <SelectItem value="__custom__">Custom model...</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={judgeModel}
                  onChange={(e) => setJudgeModel(e.target.value)}
                  placeholder="provider/model-name"
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => { setCustomModel(false); setJudgeModel("anthropic/claude-haiku-4-5-20251001") }}
                  className="rounded-md border px-2.5 py-2 text-xs text-content-secondary hover:bg-background-tertiary transition-colors ease-out-soft"
                >
                  Presets
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-content-primary">Judge Context</label>
            <textarea
              value={judgeContext}
              onChange={(e) => setJudgeContext(e.target.value)}
              placeholder={"{{entity.query({\"type\": \"example\"})}}"}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-content-primary">Judge Prompt</label>
            <textarea
              value={judgePrompt}
              onChange={(e) => setJudgePrompt(e.target.value)}
              placeholder="Be extremely strict. Any factual error is an automatic score of 1."
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!name.trim() || (!isEdit && !slug.trim()) || saving}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors ease-out-soft"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Suite"}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border px-4 py-2 text-sm text-content-secondary hover:bg-background-tertiary transition-colors ease-out-soft"
            >
              Cancel
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
