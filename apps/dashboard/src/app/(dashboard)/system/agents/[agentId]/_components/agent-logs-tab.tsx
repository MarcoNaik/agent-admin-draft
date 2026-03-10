"use client"

import { useState } from "react"
import { Loader2, ChevronDown, ChevronRight, User, Bot, Wrench } from "@/lib/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Doc } from "@convex/_generated/dataModel"
import { Id } from "@convex/_generated/dataModel"
import { useExecutionsPaginated } from "@/hooks/use-executions"
import { formatDuration } from "@/lib/format"

function formatTokens(tokens: number): string {
  if (tokens < 1000) return tokens.toString()
  return `${(tokens / 1000).toFixed(1)}k`
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

interface ToolCallData {
  name: string
  arguments: unknown
  result?: unknown
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user"
  const Icon = isUser ? User : Bot
  const borderColor = isUser ? "border-primary/20" : "border-border"
  const bgColor = isUser ? "bg-primary/5" : "bg-background-tertiary"

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
      <div className="flex items-start gap-2">
        <Icon className="h-3.5 w-3.5 mt-0.5 text-content-tertiary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-content-tertiary mb-1 uppercase tracking-wider">{role}</div>
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
    <div className="rounded-lg border border-amber/20 bg-amber/5 p-2.5">
      <div className="flex items-center gap-2">
        <Wrench className="h-3.5 w-3.5 text-amber shrink-0" />
        <span className="text-xs font-mono text-amber">{toolCall.name}</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-content-tertiary hover:text-content-secondary ml-auto"
        >
          {expanded ? "hide" : "show"}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2">
          <div>
            <div className="text-[10px] text-content-tertiary mb-1 uppercase tracking-wider">Arguments</div>
            <pre className="text-xs bg-background-tertiary rounded p-2 overflow-x-auto">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
          {toolCall.result !== undefined && (
            <div>
              <div className="text-[10px] text-content-tertiary mb-1 uppercase tracking-wider">Result</div>
              <pre className="text-xs bg-background-tertiary rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                {truncateText(JSON.stringify(toolCall.result, null, 2), 500)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExecutionDetails({ execution }: { execution: Doc<"executions"> & { inputMessage?: string; outputMessage?: string; toolCalls?: ToolCallData[] } }) {
  const isError = execution.status === "error"
  const hasConversation = execution.inputMessage || execution.outputMessage

  return (
    <div className="space-y-4">
      {isError && execution.errorMessage && (
        <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive font-mono">
          {execution.errorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <div className="text-content-tertiary">Execution ID</div>
          <div className="font-mono text-content-secondary truncate">{execution._id}</div>
        </div>
        <div>
          <div className="text-content-tertiary">Thread ID</div>
          <div className="font-mono text-content-secondary truncate">{execution.threadId || "\u2014"}</div>
        </div>
        <div>
          <div className="text-content-tertiary">Total Tokens</div>
          <div className="font-mono text-content-secondary">
            {(execution.inputTokens + execution.outputTokens).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-content-tertiary">Created</div>
          <div className="text-content-secondary">
            {new Date(execution.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      {hasConversation && (
        <div className="space-y-2">
          {execution.inputMessage && (
            <MessageBubble role="user" content={execution.inputMessage} />
          )}
          {execution.toolCalls && execution.toolCalls.length > 0 && (
            <div className="pl-4 border-l-2 border-amber/30 space-y-2">
              {execution.toolCalls.slice(0, 5).map((tc: any, i: number) => (
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
  const statusVariant = execution.status === "error" ? "destructive" : execution.status === "timeout" ? "amber" : "success"

  return (
    <>
      <tr
        className="border-b hover:bg-background-secondary cursor-pointer transition-colors ease-out-soft group"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-2.5 w-6">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-content-tertiary" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-content-tertiary" />
          )}
        </td>
        <td className="px-3 py-2.5">
          <Badge variant={statusVariant} className="text-[10px] font-normal px-1.5 py-0">
            {execution.status}
          </Badge>
        </td>
        <td className="px-3 py-2.5 text-xs text-content-primary font-mono">
          {formatTimestamp(execution.createdAt)}
        </td>
        <td className="px-3 py-2.5 text-xs text-content-secondary text-right font-mono">
          {formatDuration(execution.durationMs)}
        </td>
        <td className="px-3 py-2.5 text-xs text-content-secondary text-right font-mono">
          {formatTokens(execution.inputTokens + execution.outputTokens)}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-background-secondary/50">
          <td colSpan={5} className="px-4 py-4">
            <ExecutionDetails execution={execution} />
          </td>
        </tr>
      )}
    </>
  )
}

interface AgentLogsTabProps {
  agentId: string
  environment: string
  totalExecutions: number
}

export function AgentLogsTab({ agentId, environment, totalExecutions }: AgentLogsTabProps) {
  const { results: executions, status: paginationStatus, loadMore } = useExecutionsPaginated(
    agentId as Id<"agents">,
    environment as "development" | "production"
  )

  const isLoadingMore = paginationStatus === "LoadingMore"
  const canLoadMore = paginationStatus !== "Exhausted"

  if (executions === undefined || (executions.length === 0 && paginationStatus === "LoadingFirstPage")) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-content-secondary mx-auto" />
      </div>
    )
  }

  if (executions.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center text-sm text-content-secondary">
        No executions yet. Logs will appear here when your agent receives requests.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-background-secondary/50 border-b">
            <tr>
              <th className="px-3 py-2.5 w-6" />
              <th className="px-3 py-2.5 text-left text-[10px] font-medium text-content-tertiary uppercase tracking-wider">
                Status
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-medium text-content-tertiary uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-medium text-content-tertiary uppercase tracking-wider">
                Duration
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-medium text-content-tertiary uppercase tracking-wider">
                Tokens
              </th>
            </tr>
          </thead>
          <tbody>
            {executions.map((execution: any) => (
              <LogRow key={execution._id} execution={execution} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t flex items-center justify-between">
        <span className="text-xs text-content-tertiary">
          Showing {executions.length}{totalExecutions > 0 ? ` of ${totalExecutions}` : ""} executions
        </span>
        {canLoadMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadMore(25)}
            disabled={isLoadingMore}
            className="h-7 text-xs"
          >
            {isLoadingMore ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Load more
          </Button>
        )}
      </div>
    </div>
  )
}
