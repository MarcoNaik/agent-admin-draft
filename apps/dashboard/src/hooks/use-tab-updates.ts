"use client"

import { useRef, useState, useEffect, useCallback, useMemo } from "react"

export function useTabUpdates(dataDeps: unknown, triggerDeps: unknown, toolDeps: unknown) {
  const activeTabRef = useRef<string>("data")
  const [unseen, setUnseen] = useState<Set<string>>(new Set())
  const initialRef = useRef({ data: true, triggers: true, tools: true })

  const dataKey = useMemo(() => JSON.stringify(dataDeps ?? null), [dataDeps])
  const triggerKey = useMemo(() => JSON.stringify(triggerDeps ?? null), [triggerDeps])
  const toolKey = useMemo(() => JSON.stringify(toolDeps ?? null), [toolDeps])

  const setActiveTab = useCallback((tab: string) => {
    activeTabRef.current = tab
    setUnseen(prev => {
      if (!prev.has(tab)) return prev
      const next = new Set(prev)
      next.delete(tab)
      return next
    })
  }, [])

  useEffect(() => {
    if (initialRef.current.data) {
      initialRef.current.data = false
      return
    }
    if (activeTabRef.current !== "data") {
      setUnseen(prev => new Set(prev).add("data"))
    }
  }, [dataKey])

  useEffect(() => {
    if (initialRef.current.triggers) {
      initialRef.current.triggers = false
      return
    }
    if (activeTabRef.current !== "triggers") {
      setUnseen(prev => new Set(prev).add("triggers"))
    }
  }, [triggerKey])

  useEffect(() => {
    if (initialRef.current.tools) {
      initialRef.current.tools = false
      return
    }
    if (activeTabRef.current !== "tools") {
      setUnseen(prev => new Set(prev).add("tools"))
    }
  }, [toolKey])

  return { unseen, setActiveTab }
}
