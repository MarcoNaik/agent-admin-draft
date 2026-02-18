import type { BaileysEventMap, WASocket, ConnectionState } from "@whiskeysockets/baileys"
import { createRequire } from "module"
const require = createRequire(import.meta.url)
const { makeWASocket, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys")
import { Boom } from "@hapi/boom"
import pino from "pino"
import { makeSQLiteAuthState, hasAuthState, DATA_DIR } from "./auth-state.js"
import { handleMessages } from "./message-handler.js"
import { sendQRToConvex, sendStatusToConvex, sendPairingCodeToConvex } from "./convex-client.js"
import { readdirSync } from "fs"

const logger = pino({ name: "connection-manager" })

type ConnectionMethod = "qr" | "pairing_code"

interface Connection {
  socket: WASocket
  status: "connecting" | "qr_ready" | "pairing_code_ready" | "connected" | "disconnected"
  phoneNumber?: string
  method: ConnectionMethod
  closeDb: () => void
}

const connections = new Map<string, Connection>()
const connectingOrgs = new Set<string>()

export function getStatus(orgId: string): {
  status: string
  phoneNumber?: string
} {
  const conn = connections.get(orgId)
  if (!conn) {
    return { status: "disconnected" }
  }
  return { status: conn.status, phoneNumber: conn.phoneNumber }
}

export async function connect(orgId: string, method: ConnectionMethod = "qr", phoneNumber?: string): Promise<void> {
  if (connectingOrgs.has(orgId)) {
    logger.info({ orgId }, "Connection attempt already in progress")
    return
  }

  const existing = connections.get(orgId)
  if (existing && (existing.status === "connected" || existing.status === "connecting" || existing.status === "qr_ready" || existing.status === "pairing_code_ready")) {
    logger.info({ orgId, status: existing.status }, "Connection already in progress or established")
    return
  }

  if (existing) {
    try {
      existing.socket.ev.removeAllListeners("creds.update")
      existing.socket.ev.removeAllListeners("connection.update")
      existing.socket.ev.removeAllListeners("messages.upsert")
      existing.socket.end(undefined)
    } catch {}
    try { existing.closeDb() } catch {}
    connections.delete(orgId)
  }

  connectingOrgs.add(orgId)
  try {
    await sendStatusToConvex(orgId, "connecting")
    await startSocket(orgId, method, phoneNumber)
  } finally {
    connectingOrgs.delete(orgId)
  }
}

export async function disconnect(orgId: string): Promise<void> {
  const conn = connections.get(orgId)
  if (conn) {
    conn.socket.ev.removeAllListeners("creds.update")
    conn.socket.ev.removeAllListeners("connection.update")
    conn.socket.ev.removeAllListeners("messages.upsert")
    connections.delete(orgId)
    try {
      await conn.socket.logout()
    } catch {}
    try {
      conn.socket.end(undefined)
    } catch {}
    try { conn.closeDb() } catch {}
  }
  await sendStatusToConvex(orgId, "disconnected")
}

export async function send(
  orgId: string,
  to: string,
  text: string
): Promise<{ messageId: string }> {
  const conn = connections.get(orgId)
  if (!conn || conn.status !== "connected") {
    throw new Error(`WhatsApp not connected for org ${orgId}`)
  }

  const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`
  logger.info({ orgId, to, jid, textLength: text.length }, "Sending message via Baileys")
  try {
    const result = await conn.socket.sendMessage(jid, { text })
    logger.info({ orgId, jid, messageId: result?.key?.id }, "sendMessage result")
    return { messageId: result?.key?.id || `${Date.now()}` }
  } catch (err) {
    logger.error({ orgId, jid, err }, "sendMessage failed")
    throw err
  }
}

export async function reconnectAll(): Promise<void> {
  try {
    const dirs = readdirSync(DATA_DIR, { withFileTypes: true })
    for (const dir of dirs) {
      if (dir.isDirectory() && hasAuthState(dir.name)) {
        logger.info({ orgId: dir.name }, "Reconnecting stored session")
        await sendStatusToConvex(dir.name, "connecting")
        await startSocket(dir.name)
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to reconnect stored sessions")
  }
}

async function startSocket(orgId: string, method: ConnectionMethod = "qr", phoneNumber?: string): Promise<void> {
  const { version } = await fetchLatestBaileysVersion()
  const { state, saveCreds, clearState, closeDb } = makeSQLiteAuthState(orgId)

  const baileysLogger = logger.child({ module: "baileys" })
  baileysLogger.level = "warn"

  const socket = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
    },
    logger: baileysLogger,
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false,
  })

  const conn: Connection = {
    socket,
    status: "connecting",
    method,
    closeDb,
  }
  connections.set(orgId, conn)

  if (method === "pairing_code" && phoneNumber && !state.creds.registered) {
    try {
      const code = await socket.requestPairingCode(phoneNumber)
      logger.info({ orgId, code }, "Pairing code generated")
      conn.status = "pairing_code_ready"
      await sendPairingCodeToConvex(orgId, code)
      await sendStatusToConvex(orgId, "pairing_code_ready")
    } catch (err) {
      logger.error({ orgId, err }, "Failed to request pairing code")
    }
  }

  socket.ev.on("creds.update", saveCreds)

  socket.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && conn.method !== "pairing_code") {
      conn.status = "qr_ready"
      logger.info({ orgId }, "QR code generated")
      await sendQRToConvex(orgId, qr)
      await sendStatusToConvex(orgId, "qr_ready")
    }

    if (connection === "open") {
      const normalizedJid = socket.user?.id ? jidNormalizedUser(socket.user.id) : undefined
      const phoneNumber = normalizedJid?.split("@")[0]

      if (phoneNumber) {
        for (const [existingOrgId, existingConn] of connections.entries()) {
          if (existingOrgId !== orgId && existingConn.phoneNumber === phoneNumber && existingConn.status === "connected") {
            logger.info({ orgId: existingOrgId, phoneNumber }, "Disconnecting duplicate phone connection")
            existingConn.socket.ev.removeAllListeners("creds.update")
            existingConn.socket.ev.removeAllListeners("connection.update")
            existingConn.socket.ev.removeAllListeners("messages.upsert")
            connections.delete(existingOrgId)
            try { existingConn.socket.end(undefined) } catch {}
            try { existingConn.closeDb() } catch {}
            await sendStatusToConvex(existingOrgId, "disconnected")
          }
        }
      }

      conn.status = "connected"
      conn.phoneNumber = phoneNumber
      logger.info({ orgId, phoneNumber }, "Connected")
      await sendStatusToConvex(orgId, "connected", phoneNumber)
    }

    if (connection === "close") {
      conn.status = "disconnected"
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      logger.info({ orgId, statusCode, shouldReconnect }, "Connection closed")

      socket.ev.removeAllListeners("creds.update")
      socket.ev.removeAllListeners("connection.update")
      socket.ev.removeAllListeners("messages.upsert")
      connections.delete(orgId)

      if (shouldReconnect) {
        closeDb()
        connectingOrgs.add(orgId)
        try {
          await startSocket(orgId)
        } finally {
          connectingOrgs.delete(orgId)
        }
      } else {
        clearState()
        await sendStatusToConvex(orgId, "disconnected")
      }
    }
  })

  socket.ev.on("messages.upsert", (event: BaileysEventMap["messages.upsert"]) => {
    handleMessages(orgId, event)
  })
}
