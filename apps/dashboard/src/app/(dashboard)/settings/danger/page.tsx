"use client"

import { useState } from "react"
import { AlertTriangle, Trash2 } from "lucide-react"
import { useCurrentOrganization } from "@/hooks/use-convex-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function DangerZonePage() {
  const organization = useCurrentOrganization()
  const [confirmText, setConfirmText] = useState("")
  const orgName = organization?.name || ""
  const canDelete = confirmText === orgName

  const handleDelete = () => {
    if (!canDelete) return
    alert("Organization deletion is not implemented yet")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-destructive">Danger Zone</h1>
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
              className="max-w-sm"
            />
          </div>

          <Button
            variant="destructive"
            disabled={!canDelete}
            onClick={handleDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Organization
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
