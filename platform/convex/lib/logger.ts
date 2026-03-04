type LogLevel = "info" | "warn" | "error"

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  [key: string]: unknown
}

function formatEntry(level: LogLevel, message: string, context?: LogContext): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  if (level === "error" && context?.error instanceof Error) {
    entry.error = {
      name: context.error.name,
      message: context.error.message,
      stack: context.error.stack,
    }
  }

  return JSON.stringify(entry)
}

function info(message: string, context?: LogContext): void {
  console.log(formatEntry("info", message, context))
}

function warn(message: string, context?: LogContext): void {
  console.warn(formatEntry("warn", message, context))
}

function error(message: string, context?: LogContext): void {
  console.error(formatEntry("error", message, context))
}

function withOrg(organizationId: string): LogContext {
  return { organizationId }
}

function withAgent(agentId: string): LogContext {
  return { agentId }
}

function withRequest(requestId: string): LogContext {
  return { requestId }
}

export const log = {
  info,
  warn,
  error,
  withOrg,
  withAgent,
  withRequest,
}
