import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from "@whiskeysockets/baileys"
import { createRequire } from "module"
const require = createRequire(import.meta.url)
const { proto, initAuthCreds, BufferJSON } = require("@whiskeysockets/baileys")
import Database from "better-sqlite3"
import { mkdirSync, existsSync } from "fs"
import pino from "pino"

const logger = pino({ name: "auth-state" })

export const DATA_DIR = process.env.DATA_DIR || "/data"

function getDbPath(orgId: string): string {
  const dir = `${DATA_DIR}/${orgId}`
  mkdirSync(dir, { recursive: true })
  return `${dir}/auth.db`
}

function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_creds (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_keys (
      category TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (category, id)
    )
  `)
}

export function makeSQLiteAuthState(orgId: string): {
  state: AuthenticationState
  saveCreds: () => Promise<void>
  clearState: () => void
  closeDb: () => void
} {
  const dbPath = getDbPath(orgId)
  const db = new Database(dbPath)
  initDb(db)

  const getCreds = db.prepare("SELECT data FROM auth_creds WHERE id = 'creds'")
  const upsertCreds = db.prepare(
    "INSERT OR REPLACE INTO auth_creds (id, data) VALUES ('creds', ?)"
  )
  const getKey = db.prepare("SELECT data FROM auth_keys WHERE category = ? AND id = ?")
  const upsertKey = db.prepare(
    "INSERT OR REPLACE INTO auth_keys (category, id, data) VALUES (?, ?, ?)"
  )
  const deleteKey = db.prepare("DELETE FROM auth_keys WHERE category = ? AND id = ?")

  let creds: AuthenticationCreds

  const existing = getCreds.get() as { data: string } | undefined
  if (existing) {
    creds = JSON.parse(existing.data, BufferJSON.reviver)
  } else {
    creds = initAuthCreds()
    upsertCreds.run(JSON.stringify(creds, BufferJSON.replacer))
  }

  const state: AuthenticationState = {
    creds,
    keys: {
      get: (type, ids) => {
        const data: { [id: string]: SignalDataTypeMap[typeof type] } = {}
        for (const id of ids) {
          const row = getKey.get(type, id) as { data: string } | undefined
          if (row) {
            let parsed = JSON.parse(row.data, BufferJSON.reviver)
            if (type === "app-state-sync-key" && parsed) {
              parsed = proto.Message.AppStateSyncKeyData.fromObject(parsed)
            }
            data[id] = parsed
          }
        }
        return data
      },
      set: (data) => {
        const transaction = db.transaction(() => {
          for (const category in data) {
            for (const id in data[category as keyof typeof data]) {
              const value = data[category as keyof typeof data]![id]
              if (value) {
                upsertKey.run(category, id, JSON.stringify(value, BufferJSON.replacer))
              } else {
                deleteKey.run(category, id)
              }
            }
          }
        })
        transaction()
      },
    },
  }

  return {
    state,
    saveCreds: async () => {
      upsertCreds.run(JSON.stringify(creds, BufferJSON.replacer))
    },
    clearState: () => {
      db.exec("DELETE FROM auth_creds")
      db.exec("DELETE FROM auth_keys")
      db.close()
      logger.info({ orgId }, "Auth state cleared")
    },
    closeDb: () => {
      db.close()
    },
  }
}

export function hasAuthState(orgId: string): boolean {
  const dbPath = `${DATA_DIR}/${orgId}/auth.db`
  if (!existsSync(dbPath)) return false
  try {
    const db = new Database(dbPath, { readonly: true })
    const row = db.prepare("SELECT data FROM auth_creds WHERE id = 'creds'").get()
    db.close()
    return !!row
  } catch {
    return false
  }
}
