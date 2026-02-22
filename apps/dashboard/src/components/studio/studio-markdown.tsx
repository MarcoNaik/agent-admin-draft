"use client"

import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { StudioCodeBlock } from "./studio-code-block"

interface StudioMarkdownProps {
  content: string
  isStreaming?: boolean
}

export const StudioMarkdown = memo(function StudioMarkdown({ content, isStreaming }: StudioMarkdownProps) {
  if (!content) return null

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-pre:my-2 prose-pre:bg-background-tertiary prose-pre:border prose-pre:border-border prose-pre:rounded-md prose-code:text-amber prose-code:before:content-none prose-code:after:content-none prose-a:text-ocean prose-a:no-underline hover:prose-a:underline prose-strong:text-content-primary prose-headings:text-content-primary prose-p:text-content-primary prose-li:text-content-primary prose-td:text-content-primary prose-th:text-content-primary prose-blockquote:border-border prose-blockquote:text-content-secondary prose-hr:border-border">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre({ children }) {
            return (
              <pre className="overflow-x-auto">{children}</pre>
            )
          },
          code({ className, children, ...props }) {
            const isInline = !className
            if (isInline) {
              return (
                <code className="px-1 py-0.5 rounded bg-background-tertiary text-xs font-mono" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <StudioCodeBlock className={className} {...props}>
                {children}
              </StudioCodeBlock>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-content-primary opacity-50 animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  )
})
