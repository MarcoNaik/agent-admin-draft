import type { TriggerConfig } from '../types'

const VALID_ACTIONS = ['created', 'updated', 'deleted']

export function defineTrigger(config: TriggerConfig): TriggerConfig {
  if (!config.name) {
    throw new Error('Trigger name is required')
  }
  if (!config.slug) {
    throw new Error('Trigger slug is required')
  }
  if (!config.on) {
    throw new Error('Trigger "on" configuration is required')
  }
  if (!config.on.entityType) {
    throw new Error('Trigger entityType is required')
  }
  if (!config.on.action || !VALID_ACTIONS.includes(config.on.action)) {
    throw new Error(`Trigger action must be one of: ${VALID_ACTIONS.join(', ')}`)
  }
  if (!config.actions || config.actions.length === 0) {
    throw new Error('Trigger must have at least one action')
  }

  for (const action of config.actions) {
    if (!action.tool) {
      throw new Error('Trigger action tool is required')
    }
    if (!action.args || typeof action.args !== 'object') {
      throw new Error('Trigger action args must be an object')
    }
  }

  if (config.schedule) {
    const { delay, at } = config.schedule
    if (delay !== undefined && at !== undefined) {
      throw new Error('Trigger schedule cannot have both "delay" and "at"')
    }
    if (delay !== undefined && (typeof delay !== 'number' || delay <= 0)) {
      throw new Error('Trigger schedule.delay must be a positive number')
    }
    if (at !== undefined && typeof at !== 'string') {
      throw new Error('Trigger schedule.at must be a string template expression')
    }
  }

  if (config.retry) {
    const { maxAttempts, backoffMs } = config.retry
    if (maxAttempts !== undefined && (typeof maxAttempts !== 'number' || maxAttempts < 1)) {
      throw new Error('Trigger retry.maxAttempts must be >= 1')
    }
    if (backoffMs !== undefined && (typeof backoffMs !== 'number' || backoffMs <= 0)) {
      throw new Error('Trigger retry.backoffMs must be a positive number')
    }
  }

  return config
}
