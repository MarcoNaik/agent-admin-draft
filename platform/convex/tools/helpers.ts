import { v, Validator } from "convex/values"
import { mutation, MutationCtx } from "../_generated/server"
import { AuthContext } from "../lib/auth"

export interface ToolContext extends Omit<MutationCtx, "auth"> {
  auth: AuthContext
}

export interface ToolDefinition<Args extends Record<string, unknown>> {
  name: string
  description: string
  args: { [K in keyof Args]: Validator<Args[K], "required", string> }
  handler: (
    ctx: ToolContext,
    args: Args
  ) => Promise<unknown>
}

export function createTool<Args extends Record<string, unknown>>(
  definition: ToolDefinition<Args>
) {
  return {
    ...definition,
    toConvexMutation: () =>
      mutation({
        args: definition.args as Record<string, Validator<unknown, "required", string>>,
        handler: async (ctx, args) => {
          const identity = await ctx.auth.getUserIdentity()
          if (!identity) {
            throw new Error("Not authenticated")
          }

          const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user", (q) =>
              q.eq("clerkUserId", identity.subject)
            )
            .first()

          if (!user) {
            throw new Error("User not found")
          }

          const auth: AuthContext = {
            userId: user._id,
            organizationId: user.organizationId,
            clerkUserId: identity.subject,
            actorType: "agent",
          }

          const toolCtx: ToolContext = { ...ctx, auth }
          return await definition.handler(
            toolCtx,
            args as Args
          )
        },
      }),
  }
}

export const BUILTIN_TOOLS = [
  "entity.create",
  "entity.get",
  "entity.query",
  "entity.update",
  "entity.delete",
  "entity.link",
  "entity.unlink",
  "event.emit",
  "event.query",
  "job.enqueue",
  "job.status",
] as const

export type BuiltinToolName = (typeof BUILTIN_TOOLS)[number]

export function isBuiltinTool(name: string): name is BuiltinToolName {
  return BUILTIN_TOOLS.includes(name as BuiltinToolName)
}
