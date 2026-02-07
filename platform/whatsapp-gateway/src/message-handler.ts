import { type BaileysEventMap } from "@whiskeysockets/baileys"
import { sendInboundToConvex } from "./convex-client.js"
import pino from "pino"

const logger = pino({ name: "message-handler" })

export function handleMessages(
  orgId: string,
  event: BaileysEventMap["messages.upsert"]
): void {
  if (event.type !== "notify") return

  for (const msg of event.messages) {
    if (msg.key.fromMe) continue
    if (!msg.message) continue

    const remoteJid = msg.key.remoteJid
    if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid.endsWith("@lid")) continue

    const from = remoteJid.split("@")[0]
    const messageId = msg.key.id || `${Date.now()}`
    const rawTs = Number(msg.messageTimestamp)
    const timestamp = rawTs > 0 ? rawTs * 1000 : Date.now()

    let type = "text"
    let text: string | undefined

    if (msg.message.conversation) {
      text = msg.message.conversation
    } else if (msg.message.extendedTextMessage?.text) {
      text = msg.message.extendedTextMessage.text
    } else if (msg.message.imageMessage) {
      type = "image"
      text = msg.message.imageMessage.caption || undefined
    } else if (msg.message.videoMessage) {
      type = "video"
      text = msg.message.videoMessage.caption || undefined
    } else if (msg.message.documentMessage) {
      type = "document"
      text = msg.message.documentMessage.fileName || undefined
    } else if (msg.message.audioMessage) {
      type = "audio"
    } else if (msg.message.stickerMessage) {
      type = "sticker"
    } else if (msg.message.contactMessage) {
      type = "contact"
      text = msg.message.contactMessage.displayName || undefined
    } else if (msg.message.locationMessage) {
      type = "location"
      const loc = msg.message.locationMessage
      text = `${loc.degreesLatitude},${loc.degreesLongitude}`
    }

    logger.info({ orgId, from, type, messageId }, "Inbound message")

    sendInboundToConvex(orgId, from, messageId, type, text, timestamp).catch(
      (err) => logger.error({ err, orgId, messageId }, "Failed to forward to Convex")
    )
  }
}
