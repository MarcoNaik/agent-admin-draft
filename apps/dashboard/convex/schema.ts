import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    clerkOrgId: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_clerk_org", ["clerkOrgId"]),

  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    clerkUserId: v.string(),
    organizationId: v.id("organizations"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_org", ["organizationId"])
    .index("by_email", ["email"]),

  agents: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    developmentConfigId: v.optional(v.id("agentConfigs")),
    productionConfigId: v.optional(v.id("agentConfigs")),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("deleted")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_slug", ["organizationId", "slug"]),

  agentConfigs: defineTable({
    agentId: v.id("agents"),
    version: v.string(),
    environment: v.union(v.literal("development"), v.literal("production")),
    name: v.string(),
    systemPrompt: v.string(),
    model: v.object({
      provider: v.string(),
      name: v.string(),
      temperature: v.optional(v.number()),
      maxTokens: v.optional(v.number()),
    }),
    tools: v.array(
      v.object({
        name: v.string(),
        description: v.string(),
        parameters: v.any(),
        handlerCode: v.optional(v.string()),
        isBuiltin: v.boolean(),
      })
    ),
    createdAt: v.number(),
    deployedBy: v.optional(v.id("users")),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_env", ["agentId", "environment"]),

  threads: defineTable({
    organizationId: v.id("organizations"),
    agentId: v.id("agents"),
    userId: v.optional(v.id("users")),
    externalId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_external", ["externalId"])
    .index("by_org", ["organizationId"]),

  messages: defineTable({
    threadId: v.id("threads"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool")
    ),
    content: v.string(),
    toolCalls: v.optional(v.array(v.any())),
    toolCallId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_thread", ["threadId"]),

  entityTypes: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    schema: v.any(),
    indexMapping: v.optional(v.any()),
    searchFields: v.optional(v.array(v.string())),
    displayConfig: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_slug", ["organizationId", "slug"]),

  entities: defineTable({
    organizationId: v.id("organizations"),
    entityTypeId: v.id("entityTypes"),
    status: v.string(),
    data: v.any(),
    searchText: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org_type", ["organizationId", "entityTypeId"])
    .index("by_org_type_status", ["organizationId", "entityTypeId", "status"])
    .searchIndex("search_text", { searchField: "searchText" }),

  entityRelations: defineTable({
    organizationId: v.id("organizations"),
    fromEntityId: v.id("entities"),
    toEntityId: v.id("entities"),
    relationType: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_from", ["fromEntityId", "relationType"])
    .index("by_to", ["toEntityId", "relationType"]),

  events: defineTable({
    organizationId: v.id("organizations"),
    entityId: v.optional(v.id("entities")),
    entityTypeSlug: v.optional(v.string()),
    eventType: v.string(),
    schemaVersion: v.number(),
    actorId: v.optional(v.string()),
    actorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
      v.literal("webhook")
    ),
    payload: v.any(),
    timestamp: v.number(),
  })
    .index("by_entity", ["entityId"])
    .index("by_org_type", ["organizationId", "eventType"])
    .index("by_org_timestamp", ["organizationId", "timestamp"]),

  jobs: defineTable({
    organizationId: v.id("organizations"),
    entityId: v.optional(v.id("entities")),
    jobType: v.string(),
    idempotencyKey: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("claimed"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("dead")
    ),
    priority: v.number(),
    payload: v.any(),
    result: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    attempts: v.number(),
    maxAttempts: v.number(),
    claimedBy: v.optional(v.string()),
    claimedAt: v.optional(v.number()),
    scheduledFor: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org_status", ["organizationId", "status"])
    .index("by_idempotency", ["organizationId", "idempotencyKey"])
    .index("by_pending", ["status", "scheduledFor", "priority"])
    .index("by_entity", ["entityId"])
    .index("by_type", ["jobType"]),

  roles: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    isSystem: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_name", ["organizationId", "name"]),

  policies: defineTable({
    organizationId: v.id("organizations"),
    roleId: v.id("roles"),
    resource: v.string(),
    action: v.string(),
    effect: v.union(v.literal("allow"), v.literal("deny")),
    priority: v.number(),
    createdAt: v.number(),
  })
    .index("by_role", ["roleId"])
    .index("by_org_resource", ["organizationId", "resource"]),

  scopeRules: defineTable({
    policyId: v.id("policies"),
    type: v.union(v.literal("field"), v.literal("relation")),
    field: v.optional(v.string()),
    operator: v.optional(v.string()),
    value: v.optional(v.string()),
    relationPath: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_policy", ["policyId"]),

  fieldMasks: defineTable({
    policyId: v.id("policies"),
    fieldPath: v.string(),
    maskType: v.union(v.literal("hide"), v.literal("redact")),
    maskConfig: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_policy", ["policyId"]),

  userRoles: defineTable({
    userId: v.id("users"),
    roleId: v.id("roles"),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    grantedBy: v.optional(v.id("users")),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_role", ["roleId"]),

  apiKeys: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(),
    permissions: v.array(v.string()),
    expiresAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_prefix", ["keyPrefix"])
    .index("by_hash", ["keyHash"]),

  executions: defineTable({
    organizationId: v.id("organizations"),
    agentId: v.id("agents"),
    threadId: v.optional(v.id("threads")),
    versionId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    durationMs: v.number(),
    status: v.union(v.literal("success"), v.literal("error"), v.literal("timeout")),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_agent", ["agentId"])
    .index("by_timestamp", ["createdAt"]),

  toolPermissions: defineTable({
    agentId: v.id("agents"),
    toolName: v.string(),
    identityMode: v.union(
      v.literal("inherit"),
      v.literal("system"),
      v.literal("configured")
    ),
    configuredRoleId: v.optional(v.id("roles")),
    allowedActions: v.optional(v.array(v.string())),
    deniedFields: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_tool", ["agentId", "toolName"]),

  installedPacks: defineTable({
    organizationId: v.id("organizations"),
    packId: v.string(),
    version: v.string(),
    installedAt: v.number(),
    installedBy: v.optional(v.id("users")),
    entityTypeIds: v.array(v.id("entityTypes")),
    roleIds: v.array(v.id("roles")),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_pack", ["organizationId", "packId"]),
})
