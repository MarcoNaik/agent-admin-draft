import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@convex/_generated/api"

export async function POST(req: Request) {
  const session = await auth()
  if (!session.userId || !session.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { emailAddress, role } = await req.json()
  if (!emailAddress) {
    return NextResponse.json({ error: "emailAddress is required" }, { status: 400 })
  }

  if (session.orgRole !== "org:admin" && session.orgRole !== "org:owner") {
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
    if (role === "org:admin") {
      return NextResponse.json({ error: "Only admins can invite as admin" }, { status: 403 })
    }
  }

  const client = await clerkClient()
  await client.organizations.createOrganizationInvitation({
    organizationId: session.orgId,
    emailAddress,
    role: role || "org:member",
    inviterUserId: session.userId,
  })

  return NextResponse.json({ success: true })
}
