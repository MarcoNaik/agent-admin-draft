"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import rehypeSlug from "rehype-slug"
import { CodeBlock } from "./code-block"

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={{
          pre({ children, ...props }) {
            return <CodeBlock {...props}>{children}</CodeBlock>
          },
          code({ className, children, ...props }) {
            const isBlock = className?.startsWith("language-") || className?.startsWith("hljs")
            if (isBlock) {
              return <code className={className} {...props}>{children}</code>
            }
            return <code {...props}>{children}</code>
          },
          a({ href, children }) {
            const isExternal = href?.startsWith("http")
            return (
              <a
                href={href}
                {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {children}
              </a>
            )
          },
        }}
      />
    </div>
  )
}
