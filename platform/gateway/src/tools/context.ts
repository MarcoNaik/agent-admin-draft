import { eq, and, or, isNull, gt } from 'drizzle-orm'
import {
  createDb,
  toolPermissions,
  roles,
  policies,
  scopeRules,
  fieldMasks,
  userRoles
} from '../db'
import { PermissionEvaluator, FieldMasker } from '@struere/platform-shared/permissions'
import type { ActorContext, ResolvedPolicy, ScopeRule, FieldMask } from '@struere/platform-shared/permissions'
import type { Env, AgentContext } from '../types'

export type IdentityMode = 'inherit' | 'system' | 'configured'

export interface ToolContext {
  env: Env
  actor: ActorContext
  identityMode: IdentityMode
  effectiveActor: ActorContext
  permissions: {
    evaluator: PermissionEvaluator
    masker: FieldMasker
  }
  organizationId: string
  agentId: string
}

export interface ConversationActor {
  userId: string
  organizationId: string
  roles?: string[]
  attributes?: Record<string, unknown>
}

const SYSTEM_ACTOR: ActorContext = {
  userId: 'system',
  organizationId: '',
  roles: ['system'],
  attributes: { isSystem: true }
}

export async function createToolContext(
  env: Env,
  agent: AgentContext,
  toolName: string,
  conversationActor: ConversationActor
): Promise<ToolContext> {
  const db = createDb(env.DB)

  const [toolPermConfig] = await db
    .select()
    .from(toolPermissions)
    .where(and(
      eq(toolPermissions.agentId, agent.agentId),
      eq(toolPermissions.toolName, toolName)
    ))
    .limit(1)

  const identityMode: IdentityMode = (toolPermConfig?.identityMode as IdentityMode) || 'inherit'

  let effectiveActor: ActorContext

  if (identityMode === 'system') {
    effectiveActor = {
      ...SYSTEM_ACTOR,
      organizationId: agent.organizationId
    }
  } else if (identityMode === 'configured' && toolPermConfig?.configuredRoleId) {
    const [configuredRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, toolPermConfig.configuredRoleId))
      .limit(1)

    effectiveActor = {
      userId: `agent:${agent.agentId}`,
      organizationId: agent.organizationId,
      roles: configuredRole ? [configuredRole.name] : [],
      attributes: {
        isAgent: true,
        agentId: agent.agentId,
        configuredRoleId: toolPermConfig.configuredRoleId
      }
    }
  } else {
    effectiveActor = {
      userId: conversationActor.userId,
      organizationId: conversationActor.organizationId,
      roles: conversationActor.roles || [],
      attributes: conversationActor.attributes || {}
    }
  }

  const resolvedPolicies = await loadPoliciesForActor(db, effectiveActor)
  const evaluator = new PermissionEvaluator(resolvedPolicies)
  const masker = new FieldMasker()

  return {
    env,
    actor: {
      userId: conversationActor.userId,
      organizationId: conversationActor.organizationId,
      roles: conversationActor.roles || [],
      attributes: conversationActor.attributes || {}
    },
    identityMode,
    effectiveActor,
    permissions: {
      evaluator,
      masker
    },
    organizationId: agent.organizationId,
    agentId: agent.agentId
  }
}

async function loadPoliciesForActor(
  db: ReturnType<typeof createDb>,
  actor: ActorContext
): Promise<ResolvedPolicy[]> {
  if (actor.roles.includes('system')) {
    return [{
      id: 'system-policy',
      organizationId: actor.organizationId,
      roleId: 'system',
      resource: '*',
      action: '*',
      effect: 'allow',
      priority: 1000,
      scopeRules: [],
      fieldMasks: []
    }]
  }

  const now = new Date()

  const userRoleAssignments = await db
    .select({
      userRole: userRoles,
      roleName: roles.name
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(
      eq(userRoles.userId, actor.userId),
      or(
        isNull(userRoles.expiresAt),
        gt(userRoles.expiresAt, now)
      )
    ))

  const roleIds = userRoleAssignments.map(r => r.userRole.roleId)

  if (roleIds.length === 0) {
    return []
  }

  const policyRecords = await db
    .select()
    .from(policies)
    .where(and(
      eq(policies.organizationId, actor.organizationId),
      or(...roleIds.map(id => eq(policies.roleId, id)))
    ))

  const policyIds = policyRecords.map(p => p.id)

  let scopeRuleRecords: Array<typeof scopeRules.$inferSelect> = []
  let fieldMaskRecords: Array<typeof fieldMasks.$inferSelect> = []

  if (policyIds.length > 0) {
    scopeRuleRecords = await db
      .select()
      .from(scopeRules)
      .where(or(...policyIds.map(id => eq(scopeRules.policyId, id))))

    fieldMaskRecords = await db
      .select()
      .from(fieldMasks)
      .where(or(...policyIds.map(id => eq(fieldMasks.policyId, id))))
  }

  return policyRecords.map(policy => {
    const policyScopes: ScopeRule[] = scopeRuleRecords
      .filter(s => s.policyId === policy.id)
      .map(s => ({
        id: s.id,
        policyId: s.policyId,
        type: s.type as 'field' | 'relation',
        field: s.field,
        operator: s.operator as ScopeRule['operator'],
        value: s.value,
        relationPath: s.relationPath
      }))

    const policyMasks: FieldMask[] = fieldMaskRecords
      .filter(m => m.policyId === policy.id)
      .map(m => ({
        id: m.id,
        policyId: m.policyId,
        fieldPath: m.fieldPath,
        maskType: m.maskType as 'hide' | 'redact',
        config: m.maskConfig
      }))

    return {
      id: policy.id,
      organizationId: policy.organizationId,
      roleId: policy.roleId,
      resource: policy.resource,
      action: policy.action,
      effect: policy.effect as 'allow' | 'deny',
      priority: policy.priority || 0,
      scopeRules: policyScopes,
      fieldMasks: policyMasks
    }
  })
}

export function createDefaultActorContext(organizationId: string, userId?: string): ActorContext {
  return {
    userId: userId || 'anonymous',
    organizationId,
    roles: [],
    attributes: {}
  }
}
