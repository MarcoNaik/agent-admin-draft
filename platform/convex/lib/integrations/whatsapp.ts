import { MutationCtx, QueryCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"

interface WhatsAppConfig {
  phoneNumberId: string
  accessToken: string
  businessAccountId: string
}

interface SendTemplateParams {
  organizationId: Id<"organizations">
  toPhoneNumber: string
  templateName: string
  languageCode: string
  variables: Record<string, string>
}

interface SendTemplateResult {
  messageId: string
}

export async function getWhatsAppConfig(
  ctx: QueryCtx,
  organizationId: Id<"organizations">
): Promise<WhatsAppConfig> {
  const config = await ctx.db
    .query("integrationConfigs")
    .withIndex("by_org_provider", (q) =>
      q.eq("organizationId", organizationId).eq("provider", "whatsapp")
    )
    .first()

  if (!config || config.status !== "active") {
    throw new Error("WhatsApp integration not configured or inactive")
  }

  const configData = config.config as WhatsAppConfig
  if (!configData.phoneNumberId || !configData.accessToken) {
    throw new Error("WhatsApp configuration is incomplete")
  }

  return configData
}

export async function sendTemplateMessage(
  ctx: MutationCtx,
  params: SendTemplateParams
): Promise<SendTemplateResult> {
  const { organizationId, toPhoneNumber, templateName, languageCode, variables } = params

  const template = await ctx.db
    .query("whatsappTemplates")
    .withIndex("by_org_name", (q) =>
      q.eq("organizationId", organizationId).eq("name", templateName)
    )
    .first()

  if (!template || template.status !== "approved") {
    throw new Error(`Template ${templateName} is not approved`)
  }

  const config = await getWhatsAppConfig(ctx, organizationId)

  const variableValues = template.components.body.variables.map(
    (varName) => variables[varName] || ""
  )

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhoneNumber,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: variableValues.map((v) => ({ type: "text", text: v })),
            },
          ],
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`WhatsApp API error: ${error}`)
  }

  const result = await response.json() as { messages: Array<{ id: string }> }

  await ctx.db.insert("whatsappMessages", {
    organizationId,
    direction: "outbound",
    phoneNumber: toPhoneNumber,
    templateName,
    messageId: result.messages[0].id,
    status: "sent",
    createdAt: Date.now(),
  })

  await updateConversationOutbound(ctx, organizationId, toPhoneNumber)

  return { messageId: result.messages[0].id }
}

export async function canSendFreeform(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  phoneNumber: string
): Promise<boolean> {
  const conversation = await ctx.db
    .query("whatsappConversations")
    .withIndex("by_org_phone", (q) =>
      q.eq("organizationId", organizationId).eq("phoneNumber", phoneNumber)
    )
    .first()

  if (!conversation || !conversation.windowExpiresAt) {
    return false
  }

  return conversation.windowExpiresAt > Date.now()
}

export async function updateConversationOutbound(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  phoneNumber: string
): Promise<void> {
  const conversation = await ctx.db
    .query("whatsappConversations")
    .withIndex("by_org_phone", (q) =>
      q.eq("organizationId", organizationId).eq("phoneNumber", phoneNumber)
    )
    .first()

  const now = Date.now()

  if (conversation) {
    await ctx.db.patch(conversation._id, {
      lastOutboundAt: now,
      updatedAt: now,
    })
  } else {
    await ctx.db.insert("whatsappConversations", {
      organizationId,
      phoneNumber,
      whatsappId: phoneNumber,
      entityType: null,
      entityId: null,
      lastInboundAt: null,
      lastOutboundAt: now,
      windowExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    })
  }
}

export async function sendFreeformMessage(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  toPhoneNumber: string,
  text: string
): Promise<SendTemplateResult> {
  const canSend = await canSendFreeform(ctx, organizationId, toPhoneNumber)
  if (!canSend) {
    throw new Error("Cannot send freeform message: 24-hour window has expired or never opened")
  }

  const config = await getWhatsAppConfig(ctx, organizationId)

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhoneNumber,
        type: "text",
        text: { body: text },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`WhatsApp API error: ${error}`)
  }

  const result = await response.json() as { messages: Array<{ id: string }> }

  await ctx.db.insert("whatsappMessages", {
    organizationId,
    direction: "outbound",
    phoneNumber: toPhoneNumber,
    messageId: result.messages[0].id,
    type: "text",
    text,
    status: "sent",
    createdAt: Date.now(),
  })

  await updateConversationOutbound(ctx, organizationId, toPhoneNumber)

  return { messageId: result.messages[0].id }
}
