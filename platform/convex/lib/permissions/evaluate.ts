import { QueryCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"
import { ActorContext, Action, PermissionResult, PermissionError } from "./types"

function logPermissionDenied(
  actor: ActorContext,
  action: Action,
  resource: string,
  reason?: string
): void {
  console.warn("Permission denied", {
    organizationId: actor.organizationId,
    actorId: actor.actorId,
    actorType: actor.actorType,
    roleIds: actor.roleIds,
    action,
    resource,
    reason,
    timestamp: new Date().toISOString(),
  })
}

export async function canPerform(
  ctx: QueryCtx,
  actor: ActorContext,
  action: Action,
  resource: string,
  record?: Record<string, unknown>
): Promise<PermissionResult> {
  if (actor.isOrgAdmin) {
    return { allowed: true, reason: "Organization admin has full access" }
  }

  if (actor.roleIds.length === 0) {
    if (actor.actorType === "system") {
      return { allowed: true, reason: "System actor has implicit access" }
    }
    const result = {
      allowed: false,
      reason: "Actor has no roles assigned",
      evaluatedPolicies: 0,
    }
    logPermissionDenied(actor, action, resource, result.reason)
    return result
  }

  const policies = await ctx.db
    .query("policies")
    .withIndex("by_org_resource", (q) => q.eq("organizationId", actor.organizationId))
    .collect()

  const applicablePolicies = policies.filter(
    (p) =>
      actor.roleIds.includes(p.roleId) &&
      (p.resource === resource || p.resource === "*") &&
      (p.action === action || p.action === "*")
  )

  let hasAllow = false
  let allowPolicy: Id<"policies"> | undefined

  for (const policy of applicablePolicies) {
    if (policy.effect === "deny") {
      const result = {
        allowed: false,
        reason: `Denied by policy: ${policy._id}`,
        matchedPolicy: policy._id,
        evaluatedPolicies: applicablePolicies.length,
      }
      logPermissionDenied(actor, action, resource, result.reason)
      return result
    }
    if (policy.effect === "allow") {
      hasAllow = true
      allowPolicy = policy._id
    }
  }

  if (hasAllow) {
    return {
      allowed: true,
      matchedPolicy: allowPolicy,
      evaluatedPolicies: applicablePolicies.length,
    }
  }

  const result = {
    allowed: false,
    reason: `No policy grants ${action} on ${resource}`,
    evaluatedPolicies: applicablePolicies.length,
  }
  logPermissionDenied(actor, action, resource, result.reason)
  return result
}

export async function assertCanPerform(
  ctx: QueryCtx,
  actor: ActorContext,
  action: Action,
  resource: string,
  record?: Record<string, unknown>
): Promise<void> {
  const result = await canPerform(ctx, actor, action, resource, record)
  if (!result.allowed) {
    throw new PermissionError(result.reason || "Permission denied", actor, action, resource)
  }
}
