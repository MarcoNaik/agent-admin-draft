import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@convex/_generated/api"

export async function POST(req: Request) {
  const session = await auth()
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { emailAddress, role, organizationId } = await req.json()
  const orgId = session.orgId || organizationId
  if (!orgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 401 })
  }

  if (!emailAddress) {
    return NextResponse.json({ error: "emailAddress is required" }, { status: 400 })
  }

  const orgRole = session.orgRole
  const isClerkAdmin = orgRole === "org:admin" || orgRole === "org:owner" || orgRole === "admin" || orgRole === "owner"

  if (!isClerkAdmin) {
    const token = await session.getToken({ template: "convex" })
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
    convex.setAuth(token)
    const permissions = await convex.query(api.users.checkPermissions, { environment: "production" })
    if (!permissions.canCreate) {
      return NextResponse.json({ error: "You do not have permission to invite users" }, { status: 403 })
    }
    if (role === "org:admin" && !permissions.isAdmin) {
      return NextResponse.json({ error: "Only admins can invite as admin" }, { status: 403 })
    }
  }

  const client = await clerkClient()
  await client.organizations.createOrganizationInvitation({
    organizationId: orgId,
    emailAddress,
    role: role || "org:member",
    inviterUserId: session.userId,
    redirectUrl: "https://app.struere.dev/sign-up",
  })

  return NextResponse.json({ success: true })
}
