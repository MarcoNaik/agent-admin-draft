"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ArrowLeft } from "@/lib/icons"
import Link from "next/link"
import { useCreateEvalSuite } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
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

interface NewSuitePageProps {
  params: { agentId: string }
}

const modelOptions: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  xai: {
    label: "xAI",
    models: [
      { value: "xai/grok-4-1-fast", label: "xai/grok-4-1-fast" },
      { value: "xai/grok-4-1-fast-reasoning", label: "xai/grok-4-1-fast-reasoning" },
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

export default function NewSuitePage({ params }: NewSuitePageProps) {
  const { agentId } = params
  const router = useRouter()
  const { environment } = useEnvironment()
  const createSuite = useCreateEvalSuite()

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugManual, setSlugManual] = useState(false)
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [judgeModel, setJudgeModel] = useState("xai/grok-4-1-fast")
  const [customModel, setCustomModel] = useState(false)
  const [judgeContext, setJudgeContext] = useState("")
  const [judgePrompt, setJudgePrompt] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!name.trim() || !slug.trim()) return

    setSaving(true)
    setError(null)

    try {
      const suiteId = await createSuite({
        agentId: agentId as Id<"agents">,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        tags: tags.trim() ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        judgeModel: { model: judgeModel },
        judgeContext: judgeContext.trim() || undefined,
        judgePrompt: judgePrompt.trim() || undefined,
        environment,
      })
      router.push(`/system/agents/${agentId}/evals/${suiteId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create suite")
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/system/agents/${agentId}/evals`}
          className="rounded-md p-1.5 hover:bg-background-tertiary transition-colors ease-out-soft"
        >
          <ArrowLeft className="h-4 w-4 text-content-secondary" />
        </Link>
        <div>
          <h2 className="text-xl font-semibold font-display text-content-primary">New Eval Suite</h2>
          <p className="text-sm text-content-secondary mt-0.5">Create a collection of test cases</p>
        </div>
      </div>

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

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-content-primary">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tests for the booking workflow..."
            rows={3}
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
          <p className="text-xs text-content-tertiary">Model used for LLM judge assertions</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-content-primary">Judge Context</label>
          <textarea
            value={judgeContext}
            onChange={(e) => setJudgeContext(e.target.value)}
            placeholder={"{{entity.query({\"type\": \"example\"})}}"}
            rows={5}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          />
          <p className="text-xs text-content-tertiary">
            Reference data for the judge. Supports template variables: {"{{entity.query(...)}}"}, {"{{entityTypes}}"}, etc.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-content-primary">Judge Prompt</label>
          <textarea
            value={judgePrompt}
            onChange={(e) => setJudgePrompt(e.target.value)}
            placeholder={"Be extremely strict. Any factual error is an automatic score of 1."}
            rows={4}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-input focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          />
          <p className="text-xs text-content-tertiary">
            Custom instructions prepended to the judge system prompt. Use this to control strictness and focus areas.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={!name.trim() || !slug.trim() || saving}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors ease-out-soft"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Suite
          </button>
          <Link
            href={`/system/agents/${agentId}/evals`}
            className="rounded-md border px-4 py-2 text-sm text-content-secondary hover:bg-background-tertiary transition-colors ease-out-soft"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
