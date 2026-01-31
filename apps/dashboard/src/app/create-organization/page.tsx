"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useOrganizationList, useUser } from "@clerk/nextjs"
import { Loader2, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function CreateOrganizationPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useUser()
  const { createOrganization, setActive } = useOrganizationList()

  const handleCreate = async () => {
    if (!name.trim() || !createOrganization) return

    setIsCreating(true)
    setError(null)

    try {
      const org = await createOrganization({ name: name.trim() })
      if (user?.id) {
        await org.updateMember({ userId: user.id, role: "org:owner" })
      }
      await setActive?.({ organization: org.id })
      window.location.href = "/agents"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization")
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim() && !isCreating) {
      handleCreate()
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-primary p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-content-primary">
            Create your organization
          </h1>
          <p className="text-content-secondary">
            Organizations help you manage your agents and collaborate with your team.
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
              disabled={isCreating}
              className="bg-background-secondary border-border/50"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="w-full"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Organization"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
