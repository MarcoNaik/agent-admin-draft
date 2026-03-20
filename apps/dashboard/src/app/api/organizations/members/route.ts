import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@convex/_generated/api"

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { userId, organizationId } = await req.json()
  const orgId = session.orgId || organizationId
  if (!orgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 401 })
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  if (userId === session.userId) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 })
  }

  const client = await clerkClient()

  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
  })

  const membership = memberships.data.find(
    (m) => m.publicUserData?.userId === userId
  )

  if (!membership) {
    return NextResponse.json({ error: "User not found in organization" }, { status: 404 })
  }

  if (membership.role === "org:admin") {
    return NextResponse.json({ error: "Only admins can remove admin users" }, { status: 403 })
  }

  const orgRole = session.orgRole
  if (orgRole !== "org:admin" && orgRole !== "org:owner") {
    const token = await session.getToken({ template: "convex" })
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
    convex.setAuth(token)
    const permissions = await convex.query(api.users.checkPermissions, { environment: "production" })
    if (!permissions.canDelete) {
      return NextResponse.json({ error: "You do not have permission to remove users" }, { status: 403 })
    }
  }

  await client.organizations.deleteOrganizationMembership({
    organizationId: orgId,
    userId,
  })

  try {
    const token = await session.getToken({ template: "convex" })
    if (token) {
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
      convex.setAuth(token)
      const convexUser = await convex.query(api.users.getByClerkId, { clerkUserId: userId })
      if (convexUser) {
        await convex.mutation(api.users.remove, { id: convexUser._id })
      }
    }
  } catch (_) {}

  return NextResponse.json({ success: true })
}
