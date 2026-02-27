"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { useOrganization } from "@clerk/nextjs"
import { AlertTriangle, Trash2, Loader2 } from "lucide-react"
import { api } from "@convex/_generated/api"
import { useCurrentOrganization } from "@/hooks/use-convex-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function DangerZonePage() {
  const convexOrg = useCurrentOrganization()
  const { organization: clerkOrg } = useOrganization()
  const removeOrg = useMutation(api.organizations.remove)
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const orgName = convexOrg?.name || ""
  const canDelete = confirmText === orgName && !isDeleting

  const handleDelete = async () => {
    if (!canDelete || !convexOrg) return
    setIsDeleting(true)
    setError(null)
    try {
      await removeOrg({ id: convexOrg._id })
      await clerkOrg?.destroy()
      window.location.href = "/create-organization"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete organization")
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-semibold text-destructive">Danger Zone</h1>
        <p className="text-sm text-content-secondary">Irreversible and destructive actions</p>
      </div>

      <Card className="border-destructive bg-background-secondary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Organization
          </CardTitle>
          <CardDescription className="text-content-secondary">
            Permanently delete this organization and all of its data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-destructive/10 rounded-lg space-y-2">
            <p className="text-sm font-medium text-destructive">This will permanently delete:</p>
            <ul className="text-sm text-content-secondary list-disc list-inside space-y-1">
              <li>All agents and their configurations</li>
              <li>All entity types and entities</li>
              <li>All events, triggers, and execution history</li>
              <li>All API keys and integrations</li>
              <li>All team member access</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-sm">
              Type <span className="font-mono font-bold">{orgName}</span> to confirm
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={orgName}
              className="font-input max-w-sm"
              disabled={isDeleting}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            variant="destructive"
            disabled={!canDelete}
            onClick={handleDelete}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Organization
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
