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
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and organization</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Your organization settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    defaultValue={user?.organization.name}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-slug">Slug</Label>
                  <Input
                    id="org-slug"
                    defaultValue={user?.organization.slug}
                    disabled
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Current Plan:</span>
                <Badge variant="secondary" className="capitalize">
                  {user?.organization.plan}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" defaultValue={user?.user.name} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" defaultValue={user?.user.email} disabled />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Role:</span>
                <Badge variant="outline" className="capitalize">
                  {user?.user.role}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>Manage your subscription and payment methods</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline">Manage Billing</Button>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
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
