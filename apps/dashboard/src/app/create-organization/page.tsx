"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useOrganizationList, useUser } from "@clerk/nextjs"
import { Loader2, MessageSquare, Zap, Database, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEnsureOrganization } from "@/hooks/use-organizations"

const categories = [
  {
    id: "customer-facing",
    label: "Customer-facing bot",
    icon: MessageSquare,
    defaultText: "A bot that handles customer questions and support",
  },
  {
    id: "internal-automation",
    label: "Internal automation",
    icon: Zap,
    defaultText: "An agent that automates internal workflows and tasks",
  },
  {
    id: "data-management",
    label: "Data management",
    icon: Database,
    defaultText: "An assistant that helps manage and query business data",
  },
  {
    id: "something-else",
    label: "Something else",
    icon: Sparkles,
    defaultText: "",
  },
] as const

type CategoryId = (typeof categories)[number]["id"]

export default function CreateOrganizationPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null)
  const [description, setDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useUser()
  const { createOrganization, setActive } = useOrganizationList()
  const ensureOrganization = useEnsureOrganization()

  const handleContinue = () => {
    if (!name.trim()) return
    setStep(2)
  }

  const handleCategorySelect = (categoryId: CategoryId) => {
    setSelectedCategory(categoryId)
    const category = categories.find((c) => c.id === categoryId)
    if (category) {
      setDescription(category.defaultText)
    }
  }

  const handleCreate = async () => {
    if (!name.trim() || !createOrganization) return

    setIsCreating(true)
    setError(null)

    try {
      const org = await createOrganization({ name: name.trim() })
      try {
        if (user?.id) {
          await org.updateMember({ userId: user.id, role: "org:admin" })
        }
      } catch {}
      await setActive?.({ organization: org.id })
      await ensureOrganization({
        clerkOrgId: org.id,
        name: org.name,
        slug: org.slug ?? name.trim().toLowerCase().replace(/\s+/g, "-"),
      })
      window.location.href = `/?studio=${encodeURIComponent(description)}&onboarding=true`
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization")
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim() && !isCreating) {
      if (step === 1) {
        handleContinue()
      } else {
        handleCreate()
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-primary p-4">
      <div className="w-full max-w-md space-y-6">
        {step === 1 && (
          <>
            <div className="flex flex-col items-center space-y-2 text-center">
              <h1 className="text-2xl font-semibold text-content-primary">
                Name your workspace
              </h1>
              <p className="text-content-secondary">
                This is where your AI agents live. You can always change this later.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="org-name"
                  className="text-sm font-medium text-content-primary"
                >
                  Organization name
                </label>
                <Input
                  id="org-name"
                  placeholder="Acme Inc."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-background-secondary border-border/50"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleContinue}
                disabled={!name.trim()}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-col items-center space-y-2 text-center">
              <h1 className="text-2xl font-semibold text-content-primary">
                What are you building?
              </h1>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {categories.map((category) => {
                  const Icon = category.icon
                  const isSelected = selectedCategory === category.id
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id)}
                      className={`flex flex-col items-center gap-2 border rounded-lg p-4 cursor-pointer transition-colors ${
                        isSelected
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/30 bg-background-secondary/50 hover:border-border/50"
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-content-secondary"}`} />
                      <span className={`text-sm font-medium text-center ${isSelected ? "text-content-primary" : "text-content-secondary"}`}>
                        {category.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you want to build..."
                rows={3}
                className="w-full rounded-md border border-border/50 bg-background-secondary px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex-1"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Get Started"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
