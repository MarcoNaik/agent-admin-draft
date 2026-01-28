import { api } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default async function SettingsPage() {
  const token = await getAuthToken()

  let user: Awaited<ReturnType<typeof api.user.me>> | null = null
  let error: string | null = null

  try {
    user = await api.user.me(token!)
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load user"
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">Settings</h1>
        <p className="text-content-secondary">Manage your account and organization</p>
      </div>

      {error ? (
        <Card className="bg-background-secondary">
          <CardContent className="py-8 text-center">
            <p className="text-content-secondary">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-background-secondary">
            <CardHeader>
              <CardTitle className="text-content-primary">Organization</CardTitle>
              <CardDescription className="text-content-secondary">Your organization settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-name" className="text-content-primary">Organization Name</Label>
                  <Input
                    id="org-name"
                    defaultValue={user?.organization.name}
                    disabled
                    className="bg-background-tertiary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-slug" className="text-content-primary">Slug</Label>
                  <Input
                    id="org-slug"
                    defaultValue={user?.organization.slug}
                    disabled
                    className="bg-background-tertiary"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-content-secondary">Current Plan:</span>
                <Badge variant="secondary" className="capitalize">
                  {user?.organization.plan}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background-secondary">
            <CardHeader>
              <CardTitle className="text-content-primary">Profile</CardTitle>
              <CardDescription className="text-content-secondary">Your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-content-primary">Name</Label>
                  <Input id="name" defaultValue={user?.user.name} disabled className="bg-background-tertiary" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-content-primary">Email</Label>
                  <Input id="email" defaultValue={user?.user.email} disabled className="bg-background-tertiary" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-content-secondary">Role:</span>
                <Badge variant="outline" className="capitalize">
                  {user?.user.role}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background-secondary">
            <CardHeader>
              <CardTitle className="text-content-primary">Billing</CardTitle>
              <CardDescription className="text-content-secondary">Manage your subscription and payment methods</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="bg-background-tertiary hover:bg-background-primary">Manage Billing</Button>
            </CardContent>
          </Card>

          <Card className="border-destructive bg-background-secondary">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription className="text-content-secondary">Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive">Delete Organization</Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
