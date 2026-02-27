import { v, Validator } from "convex/values"
import { mutation, MutationCtx } from "../_generated/server"
import { AuthContext, getAuthContext } from "../lib/auth"

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
          const auth = await getAuthContext(ctx)
          const toolCtx: ToolContext = { ...ctx, auth: { ...auth, actorType: "agent" } }
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
  "calendar.list",
  "calendar.create",
  "calendar.update",
  "calendar.delete",
  "calendar.freeBusy",
  "whatsapp.send",
  "whatsapp.sendTemplate",
  "whatsapp.sendInteractive",
  "whatsapp.sendMedia",
  "whatsapp.listTemplates",
  "whatsapp.getConversation",
  "whatsapp.getStatus",
  "agent.chat",
  "airtable.listBases",
  "airtable.listTables",
  "airtable.listRecords",
  "airtable.getRecord",
  "airtable.createRecords",
  "airtable.updateRecords",
  "airtable.deleteRecords",
  "email.send",
  "payment.create",
  "payment.getStatus",
] as const

export type BuiltinToolName = (typeof BUILTIN_TOOLS)[number]

export function isBuiltinTool(name: string): name is BuiltinToolName {
  return BUILTIN_TOOLS.includes(name as BuiltinToolName)
}

export const INTEGRATION_TOOL_PREFIXES = [
  "calendar.",
  "whatsapp.",
  "airtable.",
  "email.",
  "payment.",
] as const

export function isIntegrationTool(name: string): boolean {
  return INTEGRATION_TOOL_PREFIXES.some(prefix => name.startsWith(prefix))
}
