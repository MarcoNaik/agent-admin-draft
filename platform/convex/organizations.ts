import { v } from "convex/values"
import { query, mutation, internalMutation, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { getAuthContext, requireAuth } from "./lib/auth"
import { Id } from "./_generated/dataModel"

export const get = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    if (auth.organizationId !== args.id) {
      throw new Error("Access denied")
    }
    return await ctx.db.get(args.id)
  },
})

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first()
  },
})

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx)
    return await ctx.db.get(auth.organizationId)
  },
})

export const listMyOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user) {
      throw new Error(`User not found for subject: ${identity.subject}`)
    }

    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()

    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.organizationId)
        return org
          ? {
              id: org._id,
              name: org.name,
              slug: org.slug,
              role: m.role,
            }
          : null
      })
    )

    return orgs.filter((o): o is NonNullable<typeof o> => o !== null)
  },
})

export const debugListOrgsForUser = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    if (!user) {
      return { error: "User not found", clerkUserId: args.clerkUserId }
    }

    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()

    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.organizationId)
        return org ? { id: org._id, name: org.name, slug: org.slug, role: m.role } : null
      })
    )

    return {
      user: { id: user._id, email: user.email, name: user.name, clerkUserId: user.clerkUserId },
      memberships: memberships.length,
      orgs: orgs.filter(Boolean),
    }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    clerkOrgId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first()

    if (existing) {
      throw new Error("Organization slug already exists")
    }

    const now = Date.now()
    return await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      clerkOrgId: args.clerkOrgId,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    if (auth.organizationId !== args.id) {
      throw new Error("Access denied")
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name

    await ctx.db.patch(args.id, updates)
    return await ctx.db.get(args.id)
  },
})

export const remove = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    if (auth.organizationId !== args.id) {
      throw new Error("Access denied")
    }
    const identity = await ctx.auth.getUserIdentity() as { org_role?: string } | null
    const orgRole = identity?.org_role
    if (orgRole !== "org:admin" && orgRole !== "org:owner") {
      throw new Error("Only admins can delete organizations")
    }
    await ctx.scheduler.runAfter(0, internal.organizations.deleteAllOrgData, {
      organizationId: args.id,
    })
  },
})

export const deleteAllOrgData = internalMutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId)
    if (!org) return

    const orgId = args.organizationId

    const agents = await ctx.db.query("agents").withIndex("by_org", (q) => q.eq("organizationId", orgId)).collect()
    const threads = await ctx.db.query("threads").withIndex("by_org", (q) => q.eq("organizationId", orgId)).collect()
    const roles = await ctx.db.query("roles").withIndex("by_org", (q) => q.eq("organizationId", orgId)).collect()
    const policies = await ctx.db.query("policies").withIndex("by_org_resource", (q) => q.eq("organizationId", orgId)).collect()
    const evalSuites = await ctx.db.query("evalSuites").withIndex("by_org_env", (q) => q.eq("organizationId", orgId)).collect()
    const evalRuns = await ctx.db.query("evalRuns").withIndex("by_org_env", (q) => q.eq("organizationId", orgId)).collect()
    const sandboxSessions = await ctx.db.query("sandboxSessions").withIndex("by_org_env_status", (q) => q.eq("organizationId", orgId)).collect()
    const entities = await ctx.db.query("entities").withIndex("by_org_type", (q) => q.eq("organizationId", orgId)).collect()

    for (const session of sandboxSessions) {
      const events = await ctx.db.query("sandboxEvents").withIndex("by_session", (q) => q.eq("sessionId", session._id)).collect()
      for (const event of events) await ctx.db.delete(event._id)
    }

    for (const thread of threads) {
      const messages = await ctx.db.query("messages").withIndex("by_thread", (q) => q.eq("threadId", thread._id)).collect()
      for (const msg of messages) await ctx.db.delete(msg._id)
    }

    for (const policy of policies) {
      const scopeRules = await ctx.db.query("scopeRules").withIndex("by_policy", (q) => q.eq("policyId", policy._id)).collect()
      for (const rule of scopeRules) await ctx.db.delete(rule._id)
      const fieldMasks = await ctx.db.query("fieldMasks").withIndex("by_policy", (q) => q.eq("policyId", policy._id)).collect()
      for (const mask of fieldMasks) await ctx.db.delete(mask._id)
    }

    for (const role of roles) {
      const userRoles = await ctx.db.query("userRoles").withIndex("by_role", (q) => q.eq("roleId", role._id)).collect()
      for (const ur of userRoles) await ctx.db.delete(ur._id)
    }

    for (const agent of agents) {
      const toolPerms = await ctx.db.query("toolPermissions").withIndex("by_agent", (q) => q.eq("agentId", agent._id)).collect()
      for (const perm of toolPerms) await ctx.db.delete(perm._id)
      const configs = await ctx.db.query("agentConfigs").withIndex("by_agent", (q) => q.eq("agentId", agent._id)).collect()
      for (const config of configs) await ctx.db.delete(config._id)
    }

    for (const run of evalRuns) {
      const results = await ctx.db.query("evalResults").withIndex("by_run", (q) => q.eq("runId", run._id)).collect()
      for (const result of results) await ctx.db.delete(result._id)
    }

    for (const suite of evalSuites) {
      const cases = await ctx.db.query("evalCases").withIndex("by_suite", (q) => q.eq("suiteId", suite._id)).collect()
      for (const c of cases) await ctx.db.delete(c._id)
    }

    for (const entity of entities) {
      const fromRels = await ctx.db.query("entityRelations").withIndex("by_from", (q) => q.eq("fromEntityId", entity._id)).collect()
      for (const rel of fromRels) await ctx.db.delete(rel._id)
      const toRels = await ctx.db.query("entityRelations").withIndex("by_to", (q) => q.eq("toEntityId", entity._id)).collect()
      for (const rel of toRels) await ctx.db.delete(rel._id)
    }

    for (const thread of threads) await ctx.db.delete(thread._id)
    for (const entity of entities) await ctx.db.delete(entity._id)

    const events = await ctx.db.query("events").withIndex("by_org_timestamp", (q) => q.eq("organizationId", orgId)).collect()
    for (const event of events) await ctx.db.delete(event._id)

    const executions = await ctx.db.query("executions").withIndex("by_org", (q) => q.eq("organizationId", orgId)).collect()
    for (const exec of executions) await ctx.db.delete(exec._id)

    const triggers = await ctx.db.query("triggers").withIndex("by_org_env", (q) => q.eq("organizationId", orgId)).collect()
    const triggerRuns = await ctx.db.query("triggerRuns").withIndex("by_org_env_status", (q) => q.eq("organizationId", orgId)).collect()
    for (const tr of triggerRuns) await ctx.db.delete(tr._id)
    for (const trigger of triggers) await ctx.db.delete(trigger._id)

    for (const run of evalRuns) await ctx.db.delete(run._id)
    for (const suite of evalSuites) await ctx.db.delete(suite._id)
    for (const agent of agents) await ctx.db.delete(agent._id)
    for (const policy of policies) await ctx.db.delete(policy._id)
    for (const role of roles) await ctx.db.delete(role._id)

    const entityTypes = await ctx.db.query("entityTypes").withIndex("by_org", (q) => q.eq("organizationId", orgId)).collect()
    for (const et of entityTypes) await ctx.db.delete(et._id)

    const apiKeys = await ctx.db.query("apiKeys").withIndex("by_org", (q) => q.eq("organizationId", orgId)).collect()
    for (const key of apiKeys) await ctx.db.delete(key._id)

    const integrationConfigs = await ctx.db.query("integrationConfigs").withIndex("by_org_env", (q) => q.eq("organizationId", orgId)).collect()
    for (const ic of integrationConfigs) await ctx.db.delete(ic._id)

    const providerConfigs = await ctx.db.query("providerConfigs").withIndex("by_org", (q) => q.eq("organizationId", orgId)).collect()
    for (const pc of providerConfigs) await ctx.db.delete(pc._id)

    const calendarConnections = await ctx.db.query("calendarConnections").withIndex("by_org_env", (q) => q.eq("organizationId", orgId)).collect()
    for (const cc of calendarConnections) await ctx.db.delete(cc._id)

    const whatsappConnections = await ctx.db.query("whatsappConnections").withIndex("by_org", (q) => q.eq("organizationId", orgId)).collect()
    for (const wc of whatsappConnections) await ctx.db.delete(wc._id)

    const whatsappMessages = await ctx.db.query("whatsappMessages").withIndex("by_org", (q) => q.eq("organizationId", orgId)).collect()
    for (const wm of whatsappMessages) await ctx.db.delete(wm._id)

    const emailMessages = await ctx.db.query("emailMessages").withIndex("by_org_env", (q) => q.eq("organizationId", orgId)).collect()
    for (const em of emailMessages) await ctx.db.delete(em._id)

    const pendingRoleAssignments = await ctx.db.query("pendingRoleAssignments").withIndex("by_org_email", (q) => q.eq("organizationId", orgId)).collect()
    for (const pra of pendingRoleAssignments) await ctx.db.delete(pra._id)

    const creditBalances = await ctx.db.query("creditBalances").withIndex("by_org", (q) => q.eq("organizationId", orgId)).collect()
    for (const cb of creditBalances) await ctx.db.delete(cb._id)

    const creditTransactions = await ctx.db.query("creditTransactions").withIndex("by_org", (q) => q.eq("organizationId", orgId)).collect()
    for (const ct of creditTransactions) await ctx.db.delete(ct._id)

    for (const session of sandboxSessions) await ctx.db.delete(session._id)

    const fixtures = await ctx.db.query("fixtures").withIndex("by_org_env", (q) => q.eq("organizationId", orgId)).collect()
    for (const f of fixtures) await ctx.db.delete(f._id)

    const memberships = await ctx.db.query("userOrganizations").withIndex("by_org", (q) => q.eq("organizationId", orgId)).collect()
    for (const m of memberships) await ctx.db.delete(m._id)

    await ctx.db.delete(orgId)
  },
})

export const getByClerkOrgId = internalQuery({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first()
  },
})

export const getOrCreateFromClerk = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        updatedAt: Date.now(),
      })
      return existing._id
    }

    let slug = args.slug
    let counter = 0
    while (true) {
      const slugCheck = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()
      if (!slugCheck) break
      counter++
      slug = `${args.slug}-${counter}`
    }

    const now = Date.now()
    return await ctx.db.insert("organizations", {
      name: args.name,
      slug,
      clerkOrgId: args.clerkOrgId,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const markAsDeleted = internalMutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first()

    if (!org) return

    await ctx.scheduler.runAfter(0, internal.organizations.deleteAllOrgData, {
      organizationId: org._id,
    })
  },
})

export const syncMembership = internalMutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    clerkMembershipId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first()

    if (!org) {
      throw new Error(`Organization not found for clerkOrgId: ${args.clerkOrgId}`)
    }

    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    const now = Date.now()

    if (!user) {
      const userId = await ctx.db.insert("users", {
        email: args.userEmail ?? `${args.clerkUserId}@unknown.com`,
        name: args.userName,
        clerkUserId: args.clerkUserId,
        createdAt: now,
        updatedAt: now,
      })
      user = await ctx.db.get(userId)
    }

    if (!user) {
      throw new Error("Failed to create user")
    }

    const existing = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", org._id)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        clerkMembershipId: args.clerkMembershipId,
        updatedAt: now,
      })
      return existing._id
    }

    const membershipId = await ctx.db.insert("userOrganizations", {
      userId: user._id,
      organizationId: org._id,
      role: args.role,
      clerkMembershipId: args.clerkMembershipId,
      createdAt: now,
      updatedAt: now,
    })

    if (args.role === "member") {
      const userEmail = (args.userEmail ?? user.email).toLowerCase().trim()
      const pending = await ctx.db
        .query("pendingRoleAssignments")
        .withIndex("by_org_email", (q) =>
          q.eq("organizationId", org._id).eq("email", userEmail)
        )
        .first()

      if (pending) {
        const role = await ctx.db.get(pending.roleId)
        if (role && role.organizationId === org._id) {
          const existingUserRoles = await ctx.db
            .query("userRoles")
            .withIndex("by_user", (q) => q.eq("userId", user!._id))
            .collect()
          for (const ur of existingUserRoles) {
            await ctx.db.delete(ur._id)
          }

          await ctx.db.insert("userRoles", {
            userId: user!._id,
            roleId: pending.roleId,
            grantedBy: pending.createdBy,
            createdAt: now,
          })

          const boundEntityType = await ctx.db
            .query("entityTypes")
            .withIndex("by_org_env", (q) =>
              q.eq("organizationId", org._id).eq("environment", pending.environment)
            )
            .filter((q) => q.eq(q.field("boundToRole"), role.name))
            .first()

          if (boundEntityType) {
            const userIdField = boundEntityType.userIdField || "userId"
            const schema = boundEntityType.schema as { properties?: Record<string, unknown> } | undefined
            const properties = schema?.properties || {}
            const data: Record<string, unknown> = {
              [userIdField]: user!.clerkUserId,
            }
            if ("name" in properties && user!.name) {
              data.name = user!.name
            }
            if ("email" in properties && user!.email) {
              data.email = user!.email
            }

            await ctx.db.insert("entities", {
              organizationId: org._id,
              environment: pending.environment,
              entityTypeId: boundEntityType._id,
              status: "active",
              data,
              createdAt: now,
              updatedAt: now,
            })
          }
        }

        await ctx.db.delete(pending._id)
      }
    }

    return membershipId
  },
})

export const removeMembership = internalMutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first()

    if (!org) return

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    if (!user) return

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", org._id)
      )
      .first()

    if (membership) {
      await ctx.db.delete(membership._id)

      const userRoles = await ctx.db
        .query("userRoles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect()

      for (const ur of userRoles) {
        await ctx.db.delete(ur._id)
      }
    }
  },
})

export const getUserMembership = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId)
      )
      .first()
  },
})

export const getInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.organizationId)
  },
})
