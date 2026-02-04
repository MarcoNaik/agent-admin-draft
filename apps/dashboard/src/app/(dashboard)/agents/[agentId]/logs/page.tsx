"use client"

import { Loader2, ChevronDown, ChevronRight, User, Bot, Wrench } from "lucide-react"
import { useState } from "react"
import { useRecentExecutions } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Badge } from "@/components/ui/badge"
import { Id, Doc } from "@convex/_generated/dataModel"

interface AgentLogsPageProps {
  params: { agentId: string }
}

interface ToolCallData {
  name: string
  arguments: unknown
  result?: unknown
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "..."
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user"

  const Icon = isUser ? User : Bot
  const bgColor = isUser ? "bg-primary/10" : "bg-background-tertiary"
  const borderColor = isUser ? "border-primary/20" : "border-border"

  return (
    <div className={`rounded-md border ${borderColor} ${bgColor} p-3`}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 text-content-tertiary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-content-secondary mb-1 capitalize">{role}</div>
          <div className="text-sm text-content-primary whitespace-pre-wrap break-words">
            {content || "[Empty]"}
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolCallBubble({ toolCall }: { toolCall: ToolCallData }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3">
      <div className="flex items-start gap-2">
        <Wrench className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-amber-600">{toolCall.name}</span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-content-tertiary hover:text-content-secondary"
            >
              {expanded ? "Hide details" : "Show details"}
            </button>
          </div>
          {expanded && (
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-xs text-content-tertiary mb-1">Arguments</div>
                <pre className="text-xs bg-background-tertiary rounded p-2 overflow-x-auto">
                  {JSON.stringify(toolCall.arguments, null, 2)}
                </pre>
              </div>
              {toolCall.result !== undefined && (
                <div>
                  <div className="text-xs text-content-tertiary mb-1">Result</div>
                  <pre className="text-xs bg-background-tertiary rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                    {truncateText(JSON.stringify(toolCall.result, null, 2), 500)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ExecutionDetails({ execution }: { execution: Doc<"executions"> & { inputMessage?: string; outputMessage?: string; toolCalls?: ToolCallData[] } }) {
  const isError = execution.status === "error"
  const hasConversation = execution.inputMessage || execution.outputMessage

  return (
    <div className="space-y-4">
      {isError && execution.errorMessage && (
        <div>
          <div className="text-xs font-medium text-content-secondary mb-1">Error Message</div>
          <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive font-mono">
            {execution.errorMessage}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-xs text-content-tertiary">Execution ID</div>
          <div className="font-mono text-content-secondary truncate">{execution._id}</div>
        </div>
        <div>
          <div className="text-xs text-content-tertiary">Thread ID</div>
          <div className="font-mono text-content-secondary truncate">{execution.threadId || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-content-tertiary">Total Tokens</div>
          <div className="font-mono text-content-secondary">
            {(execution.inputTokens + execution.outputTokens).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-content-tertiary">Created</div>
          <div className="text-content-secondary">
            {new Date(execution.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      {hasConversation && (
        <div className="space-y-3">
          <div className="text-xs font-medium text-content-secondary">Request / Response</div>
          <div className="space-y-2">
            {execution.inputMessage && (
              <MessageBubble role="user" content={execution.inputMessage} />
            )}
            {execution.toolCalls && execution.toolCalls.length > 0 && (
              <div className="pl-4 border-l-2 border-amber-500/30 space-y-2">
                {execution.toolCalls.slice(0, 5).map((tc, i) => (
                  <ToolCallBubble key={i} toolCall={tc} />
                ))}
                {execution.toolCalls.length > 5 && (
                  <div className="text-xs text-content-tertiary">+{execution.toolCalls.length - 5} more tool calls</div>
                )}
              </div>
            )}
            {execution.outputMessage && (
              <MessageBubble role="assistant" content={execution.outputMessage} />
            )}
          </div>
        </div>
      )}

      {!hasConversation && (
        <div className="text-sm text-content-tertiary">
          No message data available for this execution.
        </div>
      )}
    </div>
  )
}

function LogRow({ execution }: { execution: Doc<"executions"> }) {
  const [expanded, setExpanded] = useState(false)
  const isError = execution.status === "error"

  return (
    <>
      <tr
        className="border-b hover:bg-background-secondary cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 w-8">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-content-tertiary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-content-tertiary" />
          )}
        </td>
        <td className="px-4 py-3">
          <Badge variant={isError ? "destructive" : "success"} className="text-xs font-normal">
            {isError ? "error" : "success"}
          </Badge>
        </td>
        <td className="px-4 py-3 text-sm text-content-primary font-mono">
          {formatTimestamp(execution.createdAt)}
        </td>
        <td className="px-4 py-3 text-sm text-content-secondary text-right font-mono">
          {formatDuration(execution.durationMs)}
        </td>
        <td className="px-4 py-3 text-sm text-content-secondary text-right font-mono">
          {execution.inputTokens.toLocaleString()}
        </td>
        <td className="px-4 py-3 text-sm text-content-secondary text-right font-mono">
          {execution.outputTokens.toLocaleString()}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-background-secondary">
          <td colSpan={6} className="px-4 py-4">
            <ExecutionDetails execution={execution} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function AgentLogsPage({ params }: AgentLogsPageProps) {
  const { agentId } = params
  const { environment } = useEnvironment()
  const executions = useRecentExecutions(agentId as Id<"agents">, environment, 100)

  if (executions === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-content-primary">Logs</h2>
        <p className="text-sm text-content-secondary mt-0.5">Execution history and performance metrics</p>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        {executions.length === 0 ? (
          <div className="p-12 text-center text-sm text-content-secondary">
            No executions yet. Logs will appear here when your agent receives requests.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-secondary border-b">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Input
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                    Output
                  </th>
                </tr>
              </thead>
              <tbody>
                {executions.map((execution: Doc<"executions">) => (
                  <LogRow key={execution._id} execution={execution} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {executions.length > 0 && (
        <div className="text-xs text-content-tertiary text-right">
          Showing {executions.length} most recent executions
        </div>
      )}
    </div>
  )
}
