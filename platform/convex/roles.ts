import { v } from "convex/values"
import { query, mutation, internalQuery } from "./_generated/server"
import { getAuthContext, requireAuth } from "./lib/auth"

export const list = query({
  args: {
    environment: v.optional(v.union(v.literal("development"), v.literal("production"))),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    return await ctx.db
      .query("roles")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment)
      )
      .collect()
  },
})

export const get = query({
  args: { id: v.id("roles") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const role = await ctx.db.get(args.id)

    if (!role || role.organizationId !== auth.organizationId) {
      return null
    }

    return role
  },
})

export const getByName = query({
  args: {
    name: v.string(),
    environment: v.optional(v.union(v.literal("development"), v.literal("production"))),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    return await ctx.db
      .query("roles")
      .withIndex("by_org_env_name", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("name", args.name)
      )
      .first()
  },
})

export const getWithPolicies = query({
  args: { id: v.id("roles") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const role = await ctx.db.get(args.id)

    if (!role || role.organizationId !== auth.organizationId) {
      return null
    }

    const policies = await ctx.db
      .query("policies")
      .withIndex("by_role", (q) => q.eq("roleId", args.id))
      .collect()

    const policiesWithRules = await Promise.all(
      policies.map(async (policy) => {
        const scopeRules = await ctx.db
          .query("scopeRules")
          .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
          .collect()

        const fieldMasks = await ctx.db
          .query("fieldMasks")
          .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
          .collect()

        return {
          ...policy,
          scopeRules,
          fieldMasks,
        }
      })
    )

    return {
      ...role,
      policies: policiesWithRules,
    }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isSystem: v.optional(v.boolean()),
    environment: v.union(v.literal("development"), v.literal("production")),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const existing = await ctx.db
      .query("roles")
      .withIndex("by_org_env_name", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment).eq("name", args.name)
      )
      .first()

    if (existing) {
      throw new Error("Role with this name already exists")
    }

    const now = Date.now()
    return await ctx.db.insert("roles", {
      organizationId: auth.organizationId,
      environment: args.environment,
      name: args.name,
      description: args.description,
      isSystem: args.isSystem ?? false,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("roles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const role = await ctx.db.get(args.id)

    if (!role || role.organizationId !== auth.organizationId) {
      throw new Error("Role not found")
    }

    if (role.isSystem) {
      throw new Error("Cannot modify system roles")
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description

    await ctx.db.patch(args.id, updates)
    return await ctx.db.get(args.id)
  },
})

export const remove = mutation({
  args: { id: v.id("roles") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const role = await ctx.db.get(args.id)

    if (!role || role.organizationId !== auth.organizationId) {
      throw new Error("Role not found")
    }

    if (role.isSystem) {
      throw new Error("Cannot delete system roles")
    }

    const existingUserRoles = await ctx.db
      .query("userRoles")
      .withIndex("by_role", (q) => q.eq("roleId", args.id))
      .collect()

    if (existingUserRoles.length > 0) {
      throw new Error("Cannot delete role with assigned users")
    }

    const policies = await ctx.db
      .query("policies")
      .withIndex("by_role", (q) => q.eq("roleId", args.id))
      .collect()

    for (const policy of policies) {
      const scopeRules = await ctx.db
        .query("scopeRules")
        .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
        .collect()
      for (const rule of scopeRules) {
        await ctx.db.delete(rule._id)
      }

      const fieldMasks = await ctx.db
        .query("fieldMasks")
        .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
        .collect()
      for (const mask of fieldMasks) {
        await ctx.db.delete(mask._id)
      }

      await ctx.db.delete(policy._id)
    }

    await ctx.db.delete(args.id)
    return { success: true }
  },
})

export const addPolicy = mutation({
  args: {
    roleId: v.id("roles"),
    resource: v.string(),
    action: v.string(),
    effect: v.union(v.literal("allow"), v.literal("deny")),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const role = await ctx.db.get(args.roleId)

    if (!role || role.organizationId !== auth.organizationId) {
      throw new Error("Role not found")
    }

    return await ctx.db.insert("policies", {
      organizationId: auth.organizationId,
      roleId: args.roleId,
      resource: args.resource,
      action: args.action,
      effect: args.effect,
      priority: args.priority ?? 0,
      createdAt: Date.now(),
    })
  },
})

export const removePolicy = mutation({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const policy = await ctx.db.get(args.policyId)

    if (!policy || policy.organizationId !== auth.organizationId) {
      throw new Error("Policy not found")
    }

    const scopeRules = await ctx.db
      .query("scopeRules")
      .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
      .collect()
    for (const rule of scopeRules) {
      await ctx.db.delete(rule._id)
    }

    const fieldMasks = await ctx.db
      .query("fieldMasks")
      .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
      .collect()
    for (const mask of fieldMasks) {
      await ctx.db.delete(mask._id)
    }

    await ctx.db.delete(args.policyId)
    return { success: true }
  },
})

export const assignToUser = mutation({
  args: {
    userId: v.id("users"),
    roleId: v.id("roles"),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const user = await ctx.db.get(args.userId)
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
      throw new Error("User not in organization")
    }

    const role = await ctx.db.get(args.roleId)
    if (!role || role.organizationId !== auth.organizationId) {
      throw new Error("Role not found")
    }

    if (membership.role === "admin") {
      throw new Error("Admins have full access and cannot be assigned pack roles")
    }

    let existingQuery = ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("roleId"), args.roleId))

    if (args.resourceType !== undefined) {
      existingQuery = existingQuery.filter((q) =>
        q.eq(q.field("resourceType"), args.resourceType)
      )
    }

    if (args.resourceId !== undefined) {
      existingQuery = existingQuery.filter((q) =>
        q.eq(q.field("resourceId"), args.resourceId)
      )
    }

    const existing = await existingQuery.first()

    if (existing) {
      throw new Error("User already has this role")
    }

    return await ctx.db.insert("userRoles", {
      userId: args.userId,
      roleId: args.roleId,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      grantedBy: auth.userId,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    })
  },
})

export const removeFromUser = mutation({
  args: {
    userId: v.id("users"),
    roleId: v.id("roles"),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    let userRoleQuery = ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("roleId"), args.roleId))

    if (args.resourceType !== undefined) {
      userRoleQuery = userRoleQuery.filter((q) =>
        q.eq(q.field("resourceType"), args.resourceType)
      )
    }

    if (args.resourceId !== undefined) {
      userRoleQuery = userRoleQuery.filter((q) =>
        q.eq(q.field("resourceId"), args.resourceId)
      )
    }

    const userRole = await userRoleQuery.first()

    if (!userRole) {
      throw new Error("User role assignment not found")
    }

    const user = await ctx.db.get(args.userId)
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
      throw new Error("Access denied")
    }

    await ctx.db.delete(userRole._id)
    return { success: true }
  },
})

export const getUserRoles = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    const user = await ctx.db.get(args.userId)
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
      throw new Error("User not in organization")
    }

    const userRoles = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()

    const now = Date.now()
    const activeRoles = userRoles.filter(
      (ur) => !ur.expiresAt || ur.expiresAt > now
    )

    const rolesWithDetails = await Promise.all(
      activeRoles.map(async (ur) => {
        const role = await ctx.db.get(ur.roleId)
        return {
          ...ur,
          role,
        }
      })
    )

    return rolesWithDetails.filter(
      (r) => r.role !== null && r.role.organizationId === auth.organizationId
    )
  },
})

export const listInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    environment: v.optional(v.union(v.literal("development"), v.literal("production"))),
  },
  handler: async (ctx, args) => {
    if (args.environment) {
      return await ctx.db
        .query("roles")
        .withIndex("by_org_env", (q) => q.eq("organizationId", args.organizationId).eq("environment", args.environment!))
        .collect()
    }
    return await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect()
  },
})
