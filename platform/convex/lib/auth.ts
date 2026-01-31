import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"

export interface AuthContext {
  userId: Id<"users">
  organizationId: Id<"organizations">
  clerkUserId: string
  actorType: "user" | "agent" | "system" | "webhook"
}

interface ClerkIdentity {
  subject: string
  email?: string
  name?: string
  nickname?: string
  org_id?: string
}

export async function getAuthContext(
  ctx: QueryCtx | MutationCtx
): Promise<AuthContext> {
  const identity = await ctx.auth.getUserIdentity() as ClerkIdentity | null
  if (!identity) {
    throw new Error("Not authenticated")
  }

  const clerkUserId = identity.subject
  const clerkOrgId = identity.org_id

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
    .first()

  if (!user) {
    throw new Error("User not found. Please ensure your account is provisioned.")
  }

  if (clerkOrgId) {
    const clerkOrg = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", clerkOrgId))
      .first()

    if (clerkOrg) {
      const clerkMembership = await ctx.db
        .query("userOrganizations")
        .withIndex("by_user_org", (q) =>
          q.eq("userId", user._id).eq("organizationId", clerkOrg._id)
        )
        .first()

      if (clerkMembership) {
        return {
          userId: user._id,
          organizationId: clerkOrg._id,
          clerkUserId,
          actorType: "user",
        }
      }
    }
  }

  const firstMembership = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first()

  if (!firstMembership) {
    throw new Error("No organization found. Please create or join an organization.")
  }

  const fallbackOrg = await ctx.db.get(firstMembership.organizationId)

  if (!fallbackOrg) {
    throw new Error("Organization not found.")
  }

  return {
    userId: user._id,
    organizationId: fallbackOrg._id,
    clerkUserId,
    actorType: "user",
  }
}

export async function getOrCreateAuthContext(
  ctx: MutationCtx
): Promise<AuthContext> {
  return getAuthContext(ctx)
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
