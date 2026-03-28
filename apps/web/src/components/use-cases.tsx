"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useFadeSlideUp } from "@/hooks/use-scroll-animation"
import { useCases, statusColors } from "./use-cases-data"
import type { Msg, UseCase } from "./use-cases-data"

function DataPanel({ useCase }: { useCase: UseCase }) {
  const [result, setResult] = useState<{ data: any[]; hasMore: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setResult(null)
    fetch(`/api/data/${useCase.entitySlug}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && Array.isArray(data.data)) {
          setResult(data)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [useCase.entitySlug])

  const formatValue = (value: any, column: { key: string; label: string }) => {
    if (column.key === useCase.statusField && typeof value === "boolean") {
      return value ? "In Stock" : "Out of Stock"
    }
    if (typeof value === "number" && (column.label === "Total" || column.label === "Amount" || column.label === "Price")) {
      return `$${value.toLocaleString()}`
    }
    return String(value ?? "—")
  }

  const getStatusValue = (entity: any) => {
    const val = entity.data[useCase.statusField]
    if (typeof val === "boolean") return val ? "In Stock" : "Out of Stock"
    return String(val ?? "")
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-charcoal/5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-charcoal-heading">{useCase.entityType}</span>
          <span className="text-xs text-charcoal/30">·</span>
          <span className="text-xs text-charcoal/40">{loading ? "…" : `${result?.data?.length ?? 0} records`}</span>
        </div>
        <div className="flex items-center gap-2 text-charcoal/30">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span className="text-xs text-charcoal/25">Search...</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-5 py-3">
        {loading ? (
          <div className="flex flex-col gap-3 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                {useCase.columns.map((col, j) => (
                  <div key={j} className="flex-1 h-4 rounded bg-charcoal/[0.06] animate-pulse" style={{ animationDelay: `${(i * useCase.columns.length + j) * 50}ms` }} />
                ))}
              </div>
            ))}
          </div>
        ) : result?.data?.length ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-charcoal/40 uppercase tracking-wider text-[10px]">
                {useCase.columns.map((col) => (
                  <th key={col.key} className="text-left pb-3 font-medium">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.map((entity, i) => {
                const statusDisplay = getStatusValue(entity)
                return (
                  <tr key={entity.id ?? i} className="border-b border-charcoal/5 hover:bg-charcoal/[0.03] transition-colors">
                    {useCase.columns.map((col, j) => {
                      const value = entity.data[col.key]
                      const display = formatValue(value, col)
                      const isStatusCol = col.key === useCase.statusField
                      return (
                        <td key={col.key} className={`py-3 text-charcoal/70 ${j === 0 ? "font-mono text-charcoal/50" : ""}`}>
                          {isStatusCol ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusColors[statusDisplay] || "bg-charcoal/5 text-charcoal/50"}`}>{display}</span>
                          ) : display}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-charcoal/30">No records found</div>
        )}
      </div>
    </div>
  )
}

function AutomationsPanel({ useCase }: { useCase: UseCase }) {
  const [expanded, setExpanded] = useState(0)

  return (
    <div className="flex flex-col h-full overflow-auto px-4 py-3">
      {useCase.automations.map((auto, i) => (
        <button
          key={i}
          onClick={() => setExpanded(expanded === i ? -1 : i)}
          className="cursor-pointer text-left py-3 border-b border-charcoal/[0.06] last:border-0"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${auto.status === "active" ? "bg-emerald-500" : "bg-charcoal/20"}`} />
              <span className="text-sm font-medium text-charcoal-heading">{auto.name}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-charcoal/30">
              <span>{auto.runs} runs</span>
              <span>{auto.lastRun}</span>
            </div>
          </div>
          <p className="text-[11px] text-charcoal/35 mt-0.5 ml-[16px]">{auto.trigger}</p>
          {expanded === i && (
            <div className="mt-2 ml-[16px] flex flex-col gap-1">
              {auto.steps.map((step, si) => (
                <div key={si} className="flex items-center gap-2 text-[11px]">
                  <span className="text-charcoal/20 font-mono text-[10px]">{si + 1}.</span>
                  <span className="font-mono text-charcoal/45">{step.tool}</span>
                  <span className="text-charcoal/30">{step.description}</span>
                </div>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

function ToolsPanel({ useCase }: { useCase: UseCase }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-full overflow-auto px-4 py-3">
      {useCase.tools.map((t) => (
        <div
          key={t.name}
          onClick={() => setExpanded(expanded === t.name ? null : t.name)}
          className="cursor-pointer py-3 border-b border-charcoal/[0.06] last:border-0"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[13px] font-medium text-charcoal/70">{t.name}</span>
              <span className="text-[11px] text-charcoal/30">{t.desc}</span>
            </div>
            <svg className={`w-3 h-3 text-charcoal/15 transition-transform duration-150 ${expanded === t.name ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
          {expanded === t.name && (
            <div className="mt-2 ml-0.5 flex flex-col gap-1 text-[11px]">
              <div className="flex items-start gap-2">
                <span className="text-charcoal/25 min-w-[45px]">params</span>
                <span className="font-mono text-charcoal/40">{t.params.join(", ")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-charcoal/25 min-w-[45px]">returns</span>
                <span className="font-mono text-charcoal/40">{t.returns}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ChatWindow({ useCase }: { useCase: UseCase }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])
  useEffect(() => { setMessages([]); setThreadId(null); setInput(""); setLoading(false) }, [useCase.slug])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    setMessages((p) => [...p, { from: "user", text: text.trim() }])
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), agentSlug: useCase.slug, threadId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages((p) => [...p, { from: "agent", text: data.message }])
        if (data.threadId) setThreadId(data.threadId)
      } else {
        setMessages((p) => [...p, { from: "agent", text: "Something went wrong. Try again." }])
      }
    } catch {
      setMessages((p) => [...p, { from: "agent", text: "Something went wrong. Try again." }])
    } finally {
      setLoading(false)
    }
  }, [loading, threadId, useCase.slug])

  const showPrefill = messages.length === 0 && !loading
  const displayMessages = showPrefill ? useCase.prefill : messages

  return (
    <div className="flex flex-col h-full bg-white/90 rounded-b-2xl">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-charcoal/5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-medium text-charcoal-heading">{useCase.agentName}</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {displayMessages.map((m, i) => (
          <div key={i} className={`flex mb-2.5 ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`text-[12px] leading-relaxed px-3.5 py-2 max-w-[85%] ${m.from === "user" ? "bg-ocean text-white rounded-2xl rounded-br-md" : "bg-stone-deep text-charcoal rounded-2xl rounded-bl-md"}`}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start mb-2.5">
            <div className="bg-stone-deep rounded-2xl rounded-bl-md px-3.5 py-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-charcoal/30 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-charcoal/30 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-charcoal/30 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        {showPrefill && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-3">
            {useCase.suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="cursor-pointer px-3 py-1.5 text-[11px] text-charcoal/60 bg-charcoal/3 border border-charcoal/8 rounded-full hover:bg-charcoal/6 transition-colors">{s}</button>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 pb-3 pt-1">
        <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex items-end gap-2 rounded-xl border border-charcoal/8 bg-white/60 px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs text-charcoal placeholder:text-charcoal/25 focus:outline-none"
          />
          <button type="submit" disabled={!input.trim() || loading} className="text-charcoal/30 hover:text-ocean disabled:opacity-30 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

const rightTabs = ["Automations", "Data", "Tools"] as const

export function UseCases() {
  const [active, setActive] = useState(0)
  const [rightTab, setRightTab] = useState<(typeof rightTabs)[number]>("Automations")
  const { ref, opacity, y } = useFadeSlideUp()

  const uc = useCases[active]

  return (
    <section id="use-cases" className="bg-stone-deep py-20 md:py-28">
      <motion.div ref={ref} style={{ opacity, y, willChange: "transform, opacity" }} className="mx-auto max-w-7xl px-6 md:px-12">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-charcoal/40 mb-3">
          What you can build
        </p>
        <h2 className="text-center text-2xl md:text-3xl font-display text-charcoal-heading mb-14">
          One platform, endless use cases
        </h2>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:flex-1 flex flex-col gap-1 justify-center">
            {useCases.map((u, i) => (
              <button
                key={u.slug}
                onClick={() => setActive(i)}
                className={`cursor-pointer text-right px-4 py-2.5 rounded-lg transition-all duration-200 ${active === i ? "bg-white/60 text-charcoal-heading" : "text-charcoal/40 hover:text-charcoal/70 hover:bg-white/30"}`}
              >
                <span className="font-display text-[15px] font-medium">{u.label}</span>
              </button>
            ))}
          </div>

          <div className="md:w-[440px] md:flex-shrink-0">
            <div className="rounded-2xl  bg-white/90 overflow-hidden h-[560px] flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col h-full"
              >
                <ChatWindow useCase={uc} />
              </motion.div>
            </AnimatePresence>
            </div>
          </div>

          <div className="md:flex-1 flex flex-col min-w-0">
            <div className="overflow-hidden h-[560px] flex flex-col rounded-2xl  bg-white/90">
              <div className="flex gap-1 px-1 py-2.5">
                {rightTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className={`cursor-pointer px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${rightTab === tab ? "bg-charcoal/8 text-charcoal-heading" : "text-charcoal/35 hover:text-charcoal/60"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${active}-${rightTab}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="flex-1 flex flex-col min-h-0"
                  >
                    {rightTab === "Data" && <DataPanel useCase={uc} />}
                    {rightTab === "Automations" && <AutomationsPanel useCase={uc} />}
                    {rightTab === "Tools" && <ToolsPanel useCase={uc} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-4">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-emerald-600/60">Live demo — try it</span>
        </div>
      </motion.div>
    </section>
  )
}
