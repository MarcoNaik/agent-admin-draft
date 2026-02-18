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
    conversationId: v.optional(v.string()),
    parentThreadId: v.optional(v.id("threads")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_env", ["agentId", "environment"])
    .index("by_external", ["externalId"])
    .index("by_org", ["organizationId"])
    .index("by_org_env", ["organizationId", "environment"])
    .index("by_conversation", ["conversationId"]),

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
    boundToRole: v.optional(v.string()),
    userIdField: v.optional(v.string()),
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

  triggerRuns: defineTable({
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    triggerId: v.id("triggers"),
    triggerSlug: v.string(),
    entityId: v.id("entities"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("dead")
    ),
    data: v.any(),
    previousData: v.optional(v.any()),
    scheduledFor: v.number(),
    attempts: v.number(),
    maxAttempts: v.number(),
    backoffMs: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    result: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org_env_status", ["organizationId", "environment", "status"])
    .index("by_trigger", ["triggerId"])
    .index("by_trigger_entity", ["triggerId", "entityId"])
    .index("by_org_env_trigger_status", ["organizationId", "environment", "triggerId", "status"]),

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
    role: v.union(v.literal("admin"), v.literal("member")),
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
    model: v.optional(v.string()),
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

  whatsappConnections: defineTable({
    organizationId: v.id("organizations"),
    status: v.union(
      v.literal("disconnected"),
      v.literal("connecting"),
      v.literal("qr_ready"),
      v.literal("pairing_code_ready"),
      v.literal("connected")
    ),
    phoneNumber: v.optional(v.string()),
    qrCode: v.optional(v.string()),
    pairingCode: v.optional(v.string()),
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
    environment: environmentValidator,
    provider: v.union(v.literal("whatsapp"), v.literal("flow"), v.literal("google"), v.literal("zoom")),
    config: v.any(),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
    lastVerifiedAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_env", ["organizationId", "environment"])
    .index("by_org_env_provider", ["organizationId", "environment", "provider"])
    .index("by_provider", ["provider"])
    .index("by_provider_status", ["provider", "status"]),

  triggers: defineTable({
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    entityType: v.string(),
    action: v.string(),
    condition: v.optional(v.any()),
    actions: v.array(v.object({
      tool: v.string(),
      args: v.any(),
      as: v.optional(v.string()),
    })),
    schedule: v.optional(v.object({
      delay: v.optional(v.number()),
      at: v.optional(v.string()),
      offset: v.optional(v.number()),
      cancelPrevious: v.optional(v.boolean()),
    })),
    retry: v.optional(v.object({
      maxAttempts: v.optional(v.number()),
      backoffMs: v.optional(v.number()),
    })),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_env", ["organizationId", "environment"])
    .index("by_org_env_entity", ["organizationId", "environment", "entityType"])
    .index("by_org_env_slug", ["organizationId", "environment", "slug"]),

  providerConfigs: defineTable({
    organizationId: v.id("organizations"),
    provider: v.union(v.literal("anthropic"), v.literal("openai"), v.literal("google")),
    mode: v.union(v.literal("platform"), v.literal("custom")),
    apiKey: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
    lastVerifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_provider", ["organizationId", "provider"]),

  calendarConnections: defineTable({
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    provider: v.literal("google"),
    calendarId: v.string(),
    status: v.union(v.literal("connected"), v.literal("disconnected"), v.literal("error")),
    connectedAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user_org_env", ["userId", "organizationId", "environment"])
    .index("by_org_env", ["organizationId", "environment"]),

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
    judgeContext: v.optional(v.string()),
    judgePrompt: v.optional(v.string()),
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

  pendingRoleAssignments: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    roleId: v.id("roles"),
    environment: environmentValidator,
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_org_email", ["organizationId", "email"]),

  evalResults: defineTable({
    organizationId: v.id("organizations"),
    runId: v.id("evalRuns"),
    caseId: v.id("evalCases"),
    caseName: v.optional(v.string()),
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
