import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session.userId || !session.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.orgRole !== "org:admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  if (userId === session.userId) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 })
  }

  const client = await clerkClient()

  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId: session.orgId,
  })

  const membership = memberships.data.find(
    (m) => m.publicUserData?.userId === userId
  )

  if (!membership) {
    return NextResponse.json({ error: "User not found in organization" }, { status: 404 })
  }

  await client.organizations.deleteOrganizationMembership({
    organizationId: session.orgId,
    userId,
  })

  return NextResponse.json({ success: true })
}
