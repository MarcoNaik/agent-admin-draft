import { v } from "convex/values"
import { query, mutation, internalMutation, internalQuery } from "./_generated/server"
import { getAuthContext, requireAuth, isOrgAdmin } from "./lib/auth"
import { buildActorContext } from "./lib/permissions/context"
import { canPerform, assertCanPerform } from "./lib/permissions/evaluate"
import { cleanupMembershipData } from "./lib/membershipCleanup"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const user = await ctx.db.get(args.id)
    if (!user) {
      throw new Error("User not found")
    }
    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", auth.organizationId)
      )
      .first()
    if (!membership) {
      throw new Error("User not found in organization")
    }
    return { ...user, role: membership.role }
  },
})

export const getByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()
  },
})

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity() as {
      subject: string
      org_id?: string
    } | null
    if (!identity) {
      return null
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user) {
      return null
    }

    if (!identity.org_id) {
      return user
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", identity.org_id))
      .first()

    if (!org) {
      return user
    }

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", org._id)
      )
      .first()

    if (!membership) {
      return user
    }

    return { ...user, role: membership.role, allowDevAccess: membership.allowDevAccess }
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx)
    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    const users = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId)
        if (!user || user.deletedAt) return null
        return { ...user, role: membership.role, allowDevAccess: membership.allowDevAccess }
      })
    )

    return users.filter((u): u is NonNullable<typeof u> => u !== null)
  },
})

export const setDevAccess = mutation({
  args: {
    userId: v.id("users"),
    allowDevAccess: v.boolean(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const admin = await isOrgAdmin(ctx, {
      userId: auth.userId,
      organizationId: auth.organizationId,
    })
    if (!admin) {
      throw new Error("Admin access required")
    }

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("organizationId", auth.organizationId)
      )
      .first()

    if (!membership) {
      throw new Error("User not found in organization")
    }

    await ctx.db.patch(membership._id, {
      allowDevAccess: args.allowDevAccess,
      updatedAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("member"))),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const adminStatus = await isOrgAdmin(ctx, {
      userId: auth.userId,
      organizationId: auth.organizationId,
    })
    if (!adminStatus) {
      const actor = await buildActorContext(ctx, {
        organizationId: auth.organizationId,
        actorType: auth.actorType,
        actorId: auth.userId,
        environment: "production",
      })
      await assertCanPerform(ctx, actor, "update", "users")
    }

    const user = await ctx.db.get(args.id)

    if (!user) {
      throw new Error("User not found")
    }

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", auth.organizationId)
      )
      .first()

    if (!membership) {
      throw new Error("User not found in organization")
    }

    if (!adminStatus) {
      if (args.role === "admin") {
        throw new Error("Only admins can promote users to admin")
      }
      if (membership.role === "admin") {
        throw new Error("Only admins can modify admin users")
      }
    }

    if (args.role !== undefined) {
      if (args.role === "member" && membership.role === "admin") {
        const adminCount = await ctx.db
          .query("userOrganizations")
          .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
          .filter((q) => q.eq(q.field("role"), "admin"))
          .collect()

        if (adminCount.length <= 1) {
          throw new Error("Cannot demote the last admin")
        }
      }

      await ctx.db.patch(membership._id, {
        role: args.role,
        updatedAt: Date.now(),
      })

      if (args.role === "admin") {
        const userRoles = await ctx.db
          .query("userRoles")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect()

        for (const ur of userRoles) {
          await ctx.db.delete(ur._id)
        }
      }
    }

    const userUpdates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) userUpdates.name = args.name

    if (Object.keys(userUpdates).length > 1) {
      await ctx.db.patch(args.id, userUpdates)
    }

    const updatedUser = await ctx.db.get(args.id)
    const updatedMembership = await ctx.db.get(membership._id)
    return { ...updatedUser, role: updatedMembership?.role }
  },
})

export const remove = mutation({
  args: {
    id: v.id("users"),
    deleteLinkedEntities: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const adminStatus = await isOrgAdmin(ctx, {
      userId: auth.userId,
      organizationId: auth.organizationId,
    })
    if (!adminStatus) {
      const actor = await buildActorContext(ctx, {
        organizationId: auth.organizationId,
        actorType: auth.actorType,
        actorId: auth.userId,
        environment: "production",
      })
      await assertCanPerform(ctx, actor, "delete", "users")
    }

    const user = await ctx.db.get(args.id)

    if (!user) {
      throw new Error("User not found")
    }

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", auth.organizationId)
      )
      .first()

    if (!membership) {
      throw new Error("User not found in organization")
    }

    if (!adminStatus && membership.role === "admin") {
      throw new Error("Only admins can remove admin users")
    }

    await ctx.db.delete(membership._id)

    const summary = await cleanupMembershipData(ctx, {
      userId: user._id,
      organizationId: auth.organizationId,
      clerkUserId: user.clerkUserId,
      deleteLinkedEntities: args.deleteLinkedEntities,
      actor: { actorId: auth.userId, actorType: "user" },
    })

    return { success: true, cleanup: summary }
  },
})

export const removeByClerkId = mutation({
  args: {
    clerkUserId: v.string(),
    deleteLinkedEntities: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    if (!user) {
      return { success: true, cleanup: null }
    }

    const adminStatus = await isOrgAdmin(ctx, {
      userId: auth.userId,
      organizationId: auth.organizationId,
    })
    if (!adminStatus) {
      const actor = await buildActorContext(ctx, {
        organizationId: auth.organizationId,
        actorType: auth.actorType,
        actorId: auth.userId,
        environment: "production",
      })
      await assertCanPerform(ctx, actor, "delete", "users")
    }

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", auth.organizationId)
      )
      .first()

    if (!membership) {
      return { success: true, cleanup: null }
    }

    if (!adminStatus && membership.role === "admin") {
      throw new Error("Only admins can remove admin users")
    }

    await ctx.db.delete(membership._id)

    const summary = await cleanupMembershipData(ctx, {
      userId: user._id,
      organizationId: auth.organizationId,
      clerkUserId: user.clerkUserId,
      deleteLinkedEntities: args.deleteLinkedEntities,
      actor: { actorId: auth.userId, actorType: "user" },
    })

    return { success: true, cleanup: summary }
  },
})

export const getOrCreateFromClerkNoOrg = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    if (existing) {
      if (args.name && args.name !== existing.name) {
        await ctx.db.patch(existing._id, {
          name: args.name,
          updatedAt: Date.now(),
        })
      }
      return existing._id
    }

    const now = Date.now()
    return await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      clerkUserId: args.clerkUserId,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const clerkUserId = identity.subject
    const email = identity.email ?? `${clerkUserId}@unknown.com`
    const name = identity.name ?? identity.nickname ?? undefined

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .first()

    if (existing) {
      return { userId: existing._id, created: false }
    }

    const now = Date.now()
    const userId = await ctx.db.insert("users", {
      email,
      name,
      clerkUserId,
      createdAt: now,
      updatedAt: now,
    })

    return { userId, created: true }
  },
})

export const checkPermissions = query({
  args: {
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    const admin = await isOrgAdmin(ctx, {
      userId: auth.userId,
      organizationId: auth.organizationId,
    })

    if (admin) {
      return { canCreate: true, canUpdate: true, canDelete: true, isAdmin: true }
    }

    const actor = await buildActorContext(ctx, {
      organizationId: auth.organizationId,
      actorType: auth.actorType,
      actorId: auth.userId,
      environment: args.environment,
    })

    const [createResult, updateResult, deleteResult] = await Promise.all([
      canPerform(ctx, actor, "create", "users"),
      canPerform(ctx, actor, "update", "users"),
      canPerform(ctx, actor, "delete", "users"),
    ])

    return {
      canCreate: createResult.allowed,
      canUpdate: updateResult.allowed,
      canDelete: deleteResult.allowed,
      isAdmin: false,
    }
  },
})

export const previewMembershipCleanup = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error("User not found")
    }

    const organizationId = auth.organizationId

    let rolesRemoved = 0
    let pendingAssignmentsRemoved = 0
    let calendarConnectionsRemoved = 0
    let sandboxSessionsRemoved = 0
    let entitiesDeleted = 0

    const userRoles = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()

    for (const ur of userRoles) {
      const role = await ctx.db.get(ur.roleId)
      if (role && role.organizationId === organizationId) {
        rolesRemoved++
      }
    }

    if (user.email) {
      const pendingAssignments = await ctx.db
        .query("pendingRoleAssignments")
        .withIndex("by_org_email", (q) =>
          q.eq("organizationId", organizationId).eq("email", user.email!)
        )
        .collect()
      pendingAssignmentsRemoved = pendingAssignments.length
    }

    for (const env of ["development", "production", "eval"] as const) {
      const calConnections = await ctx.db
        .query("calendarConnections")
        .withIndex("by_user_org_env", (q) =>
          q.eq("userId", args.userId).eq("organizationId", organizationId).eq("environment", env)
        )
        .collect()
      calendarConnectionsRemoved += calConnections.length

      const sandboxSessions = await ctx.db
        .query("sandboxSessions")
        .withIndex("by_org_env_user", (q) =>
          q.eq("organizationId", organizationId).eq("environment", env).eq("userId", args.userId)
        )
        .collect()
      sandboxSessionsRemoved += sandboxSessions.length

      const entityTypes = await ctx.db
        .query("entityTypes")
        .withIndex("by_org_env", (q) =>
          q.eq("organizationId", organizationId).eq("environment", env)
        )
        .collect()

      for (const et of entityTypes) {
        if (!et.userIdField) continue
        const entities = await ctx.db
          .query("entities")
          .withIndex("by_org_env_type", (q) =>
            q.eq("organizationId", organizationId).eq("environment", env).eq("entityTypeId", et._id)
          )
          .collect()

        for (const entity of entities) {
          if (entity.deletedAt) continue
          if (entity.data?.[et.userIdField] === user.clerkUserId) {
            entitiesDeleted++
          }
        }
      }
    }

    return {
      rolesRemoved,
      pendingAssignmentsRemoved,
      calendarConnectionsRemoved,
      sandboxSessionsRemoved,
      entitiesDeleted,
    }
  },
})

export const getLinkedEntitiesForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error("User not found")
    }

    const organizationId = auth.organizationId
    const results: Array<{
      environment: string
      entityTypeName: string
      entityName: string
      entityId: string
    }> = []

    for (const env of ["development", "production", "eval"] as const) {
      const entityTypes = await ctx.db
        .query("entityTypes")
        .withIndex("by_org_env", (q) =>
          q.eq("organizationId", organizationId).eq("environment", env)
        )
        .collect()

      for (const et of entityTypes) {
        if (!et.userIdField) continue
        const entities = await ctx.db
          .query("entities")
          .withIndex("by_org_env_type", (q) =>
            q.eq("organizationId", organizationId).eq("environment", env).eq("entityTypeId", et._id)
          )
          .collect()

        for (const entity of entities) {
          if (entity.deletedAt) continue
          if (entity.data?.[et.userIdField] === user.clerkUserId) {
            const name = (entity.data?.name as string) ?? (entity.data?.email as string) ?? String(entity._id)
            results.push({
              environment: env,
              entityTypeName: et.name,
              entityName: name,
              entityId: entity._id,
            })
          }
        }
      }
    }

    return results
  },
})
