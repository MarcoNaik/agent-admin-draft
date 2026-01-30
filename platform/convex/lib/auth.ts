import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"

export interface AuthContext {
  userId: Id<"users">
  organizationId: Id<"organizations">
  clerkUserId: string
  actorType: "user" | "agent" | "system" | "webhook"
}

export async function getAuthContext(
  ctx: QueryCtx | MutationCtx
): Promise<AuthContext> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error("Not authenticated")
  }

  const clerkUserId = identity.subject

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
    .first()

  if (!user) {
    throw new Error("User not found. Please ensure your account is provisioned.")
  }

  return {
    userId: user._id,
    organizationId: user.organizationId,
    clerkUserId,
    actorType: "user",
  }
}

export async function getOrCreateAuthContext(
  ctx: MutationCtx
): Promise<AuthContext> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error("Not authenticated")
  }

  const clerkUserId = identity.subject
  const email = identity.email ?? `${clerkUserId}@unknown.com`
  const name = identity.name ?? identity.nickname ?? undefined

  let user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
    .first()

  if (!user) {
    const now = Date.now()
    const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-")

    const organizationId = await ctx.db.insert("organizations", {
      name: name ? `${name}'s Organization` : "My Organization",
      slug: `${slug}-${now}`,
      plan: "free",
      createdAt: now,
      updatedAt: now,
    })

    const userId = await ctx.db.insert("users", {
      email,
      name,
      clerkUserId,
      organizationId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    })

    return {
      userId,
      organizationId,
      clerkUserId,
      actorType: "user",
    }
  }

  return {
    userId: user._id,
    organizationId: user.organizationId,
    clerkUserId,
    actorType: "user",
  }
}

export async function getAuthContextFromApiKey(
  ctx: QueryCtx | MutationCtx,
  keyHash: string
): Promise<AuthContext | null> {
  const apiKey = await ctx.db
    .query("apiKeys")
    .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
    .first()

  if (!apiKey) {
    return null
  }

  if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) {
    return null
  }

  const org = await ctx.db.get(apiKey.organizationId)
  if (!org) {
    return null
  }

  return {
    userId: apiKey.organizationId as unknown as Id<"users">,
    organizationId: apiKey.organizationId,
    clerkUserId: "",
    actorType: "system",
  }
}

export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<AuthContext> {
  const auth = await getAuthContext(ctx)
  if (!auth) {
    throw new Error("Authentication required")
  }
  return auth
}

export async function requireOrgAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
): Promise<AuthContext> {
  const auth = await requireAuth(ctx)
  if (auth.organizationId !== organizationId) {
    throw new Error("Access denied to organization")
  }
  return auth
}
