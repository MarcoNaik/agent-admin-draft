export { installPack, uninstallPack } from './install'
export type { InstallOptions, InstallResult } from './install'

export { default as agentConfig } from './agent/config'
export { tutoringTools } from './agent/tools'

export {
  registerTutoringJobHandler,
  getTutoringJobHandler,
  tutoringJobHandlers,
  registerAllTutoringHandlers
} from './jobs/handlers'

export const packId = 'tutoring'
export const packVersion = '1.0.0'
export const packName = 'Tutoring Pack'
export const packDescription = 'Complete tutoring business management with students, teachers, sessions, payments, and entitlements'

export const entityTypes = [
  'student',
  'guardian',
  'teacher',
  'session',
  'payment',
  'entitlement'
] as const

export const roles = [
  'admin',
  'teacher',
  'guardian'
] as const

export const relationTypes = [
  'guardian_of',
  'teaches',
  'scheduled_for',
  'taught_by',
  'payment_for',
  'purchases',
  'entitles',
  'paid_by',
  'purchased_by'
] as const

export const jobTypes = [
  'send_session_reminder',
  'send_late_notice',
  'decrement_entitlement',
  'send_followup',
  'check_entitlement_expiry',
  'send_expiry_warning',
  'send_low_sessions_warning'
] as const

export const views = [
  'upcoming_sessions',
  'my_sessions',
  'pack_utilization'
] as const

export type EntityType = typeof entityTypes[number]
export type Role = typeof roles[number]
export type RelationType = typeof relationTypes[number]
export type JobType = typeof jobTypes[number]
export type View = typeof views[number]
