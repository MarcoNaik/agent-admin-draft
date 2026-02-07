import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

const environmentValidator = v.union(v.literal("development"), v.literal("production"))

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
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_email", ["email"]),

  agents: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("deleted")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_slug", ["organizationId", "slug"]),

  agentConfigs: defineTable({
    agentId: v.id("agents"),
    version: v.string(),
    environment: environmentValidator,
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
    environment: environmentValidator,
    userId: v.optional(v.id("users")),
    externalId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_env", ["agentId", "environment"])
    .index("by_external", ["externalId"])
    .index("by_org", ["organizationId"])
    .index("by_org_env", ["organizationId", "environment"]),

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
    environment: environmentValidator,
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
    .index("by_org_slug", ["organizationId", "slug"])
    .index("by_org_env", ["organizationId", "environment"])
    .index("by_org_env_slug", ["organizationId", "environment", "slug"])
    .index("by_slug", ["slug"]),

  entities: defineTable({
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    entityTypeId: v.id("entityTypes"),
    status: v.string(),
    data: v.any(),
    searchText: v.optional(v.string()),
    providerReference: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org_type", ["organizationId", "entityTypeId"])
    .index("by_org_type_status", ["organizationId", "entityTypeId", "status"])
    .index("by_org_env_type", ["organizationId", "environment", "entityTypeId"])
    .index("by_org_env_type_status", ["organizationId", "environment", "entityTypeId", "status"])
    .index("by_provider_reference", ["providerReference"])
    .searchIndex("search_text", { searchField: "searchText" }),

  entityRelations: defineTable({
    organizationId: v.id("organizations"),
    environment: environmentValidator,
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
    environment: environmentValidator,
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
    .index("by_org_timestamp", ["organizationId", "timestamp"])
    .index("by_org_env_timestamp", ["organizationId", "environment", "timestamp"])
    .index("by_org_env_type", ["organizationId", "environment", "eventType"]),

  jobs: defineTable({
    organizationId: v.id("organizations"),
    environment: environmentValidator,
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
    actorContext: v.optional(
      v.object({
        actorType: v.string(),
        actorId: v.string(),
        roleIds: v.array(v.string()),
      })
    ),
  })
    .index("by_org_status", ["organizationId", "status"])
    .index("by_org_env_status", ["organizationId", "environment", "status"])
    .index("by_idempotency", ["organizationId", "idempotencyKey"])
    .index("by_pending", ["status", "scheduledFor", "priority"])
    .index("by_entity", ["entityId"])
    .index("by_type", ["jobType"]),

  roles: defineTable({
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    name: v.string(),
    description: v.optional(v.string()),
    isSystem: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_name", ["organizationId", "name"])
    .index("by_org_env", ["organizationId", "environment"])
    .index("by_org_env_name", ["organizationId", "environment", "name"])
    .index("by_org_isSystem", ["organizationId", "isSystem"]),

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

  userOrganizations: defineTable({
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    clerkMembershipId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["organizationId"])
    .index("by_user_org", ["userId", "organizationId"])
    .index("by_clerk_membership", ["clerkMembershipId"]),

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
    environment: environmentValidator,
    name: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(),
    permissions: v.array(v.string()),
    expiresAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_env", ["organizationId", "environment"])
    .index("by_prefix", ["keyPrefix"])
    .index("by_hash", ["keyHash"]),

  executions: defineTable({
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    agentId: v.id("agents"),
    threadId: v.optional(v.id("threads")),
    versionId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    inputMessage: v.optional(v.string()),
    outputMessage: v.optional(v.string()),
    toolCalls: v.optional(v.array(v.object({
      name: v.string(),
      arguments: v.any(),
      result: v.optional(v.any()),
    }))),
    inputTokens: v.number(),
    outputTokens: v.number(),
    durationMs: v.number(),
    status: v.union(v.literal("success"), v.literal("error"), v.literal("timeout")),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_env", ["organizationId", "environment"])
    .index("by_agent", ["agentId"])
    .index("by_agent_env", ["agentId", "environment"])
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
    environment: environmentValidator,
    packId: v.string(),
    version: v.string(),
    installedAt: v.number(),
    installedBy: v.optional(v.id("users")),
    entityTypeIds: v.array(v.id("entityTypes")),
    roleIds: v.array(v.id("roles")),
    status: v.optional(v.union(v.literal("active"), v.literal("upgrading"), v.literal("failed"))),
    customizations: v.optional(v.object({
      entityTypes: v.array(v.string()),
      roles: v.array(v.string()),
      policies: v.array(v.string()),
    })),
    lastUpgradedAt: v.optional(v.number()),
    lastUpgradedBy: v.optional(v.id("users")),
    upgradeHistory: v.optional(v.array(v.object({
      fromVersion: v.string(),
      toVersion: v.string(),
      upgradedAt: v.number(),
      upgradedBy: v.optional(v.id("users")),
    }))),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_pack", ["organizationId", "packId"])
    .index("by_org_env", ["organizationId", "environment"])
    .index("by_org_env_pack", ["organizationId", "environment", "packId"]),

  whatsappConnections: defineTable({
    organizationId: v.id("organizations"),
    status: v.union(
      v.literal("disconnected"),
      v.literal("connecting"),
      v.literal("qr_ready"),
      v.literal("connected")
    ),
    phoneNumber: v.optional(v.string()),
    qrCode: v.optional(v.string()),
    agentId: v.optional(v.id("agents")),
    environment: environmentValidator,
    lastConnectedAt: v.optional(v.number()),
    lastDisconnectedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_env", ["organizationId", "environment"]),

  whatsappMessages: defineTable({
    organizationId: v.id("organizations"),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    phoneNumber: v.string(),
    messageId: v.string(),
    type: v.optional(v.string()),
    text: v.optional(v.string()),
    threadId: v.optional(v.id("threads")),
    status: v.union(v.literal("sent"), v.literal("delivered"), v.literal("read"), v.literal("failed"), v.literal("received")),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_phone", ["organizationId", "phoneNumber"])
    .index("by_message_id", ["messageId"]),

  integrationConfigs: defineTable({
    organizationId: v.id("organizations"),
    provider: v.union(v.literal("whatsapp"), v.literal("flow"), v.literal("google"), v.literal("zoom")),
    config: v.any(),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
    lastVerifiedAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_provider", ["organizationId", "provider"])
    .index("by_provider", ["provider"])
    .index("by_provider_status", ["provider", "status"]),

  evalSuites: defineTable({
    organizationId: v.id("organizations"),
    agentId: v.id("agents"),
    environment: environmentValidator,
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    judgeModel: v.optional(v.object({
      provider: v.string(),
      name: v.string(),
    })),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_env", ["organizationId", "environment"])
    .index("by_agent_env", ["agentId", "environment"])
    .index("by_org_env_slug", ["organizationId", "environment", "slug"]),

  evalCases: defineTable({
    organizationId: v.id("organizations"),
    suiteId: v.id("evalSuites"),
    name: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    turns: v.array(v.object({
      userMessage: v.string(),
      assertions: v.optional(v.array(v.object({
        type: v.union(
          v.literal("llm_judge"),
          v.literal("contains"),
          v.literal("matches"),
          v.literal("tool_called"),
          v.literal("tool_not_called")
        ),
        criteria: v.optional(v.string()),
        value: v.optional(v.string()),
        weight: v.optional(v.number()),
      }))),
    })),
    finalAssertions: v.optional(v.array(v.object({
      type: v.union(
        v.literal("llm_judge"),
        v.literal("contains"),
        v.literal("matches"),
        v.literal("tool_called"),
        v.literal("tool_not_called")
      ),
      criteria: v.optional(v.string()),
      value: v.optional(v.string()),
      weight: v.optional(v.number()),
    }))),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_suite", ["suiteId"])
    .index("by_suite_order", ["suiteId", "order"]),

  evalRuns: defineTable({
    organizationId: v.id("organizations"),
    suiteId: v.id("evalSuites"),
    agentId: v.id("agents"),
    environment: environmentValidator,
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    triggeredBy: v.optional(v.id("users")),
    triggerSource: v.union(v.literal("dashboard"), v.literal("cli")),
    agentConfigSnapshot: v.optional(v.any()),
    totalCases: v.number(),
    completedCases: v.number(),
    passedCases: v.number(),
    failedCases: v.number(),
    overallScore: v.optional(v.number()),
    totalTokens: v.optional(v.object({
      agent: v.number(),
      judge: v.number(),
    })),
    totalDurationMs: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_suite", ["suiteId"])
    .index("by_agent_env", ["agentId", "environment"])
    .index("by_org_env", ["organizationId", "environment"]),

  evalResults: defineTable({
    organizationId: v.id("organizations"),
    runId: v.id("evalRuns"),
    caseId: v.id("evalCases"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("passed"),
      v.literal("failed"),
      v.literal("error")
    ),
    threadId: v.optional(v.id("threads")),
    turnResults: v.optional(v.array(v.object({
      turnIndex: v.number(),
      userMessage: v.string(),
      assistantResponse: v.string(),
      toolCalls: v.optional(v.array(v.object({
        name: v.string(),
        arguments: v.any(),
        result: v.optional(v.any()),
      }))),
      assertionResults: v.optional(v.array(v.object({
        type: v.string(),
        passed: v.boolean(),
        score: v.optional(v.number()),
        reason: v.optional(v.string()),
        criteria: v.optional(v.string()),
      }))),
      durationMs: v.number(),
      agentTokens: v.optional(v.object({
        input: v.number(),
        output: v.number(),
      })),
    }))),
    finalAssertionResults: v.optional(v.array(v.object({
      type: v.string(),
      passed: v.boolean(),
      score: v.optional(v.number()),
      reason: v.optional(v.string()),
      criteria: v.optional(v.string()),
    }))),
    overallPassed: v.boolean(),
    overallScore: v.optional(v.number()),
    totalDurationMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    judgeTokens: v.optional(v.object({
      input: v.number(),
      output: v.number(),
    })),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_run", ["runId"])
    .index("by_run_case", ["runId", "caseId"]),
})
