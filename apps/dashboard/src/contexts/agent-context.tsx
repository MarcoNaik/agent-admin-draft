"use client"

import { createContext, useContext, useState, ReactNode, useCallback } from "react"

interface AgentInfo {
  id: string
  name: string
  slug: string
}

interface AgentContextValue {
  agent: AgentInfo | null
  setAgent: (agent: AgentInfo | null) => void
}

const AgentContext = createContext<AgentContextValue | null>(null)

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agent, setAgentState] = useState<AgentInfo | null>(null)

  const setAgent = useCallback((agent: AgentInfo | null) => {
    setAgentState(agent)
  }, [])

  return (
    <AgentContext.Provider value={{ agent, setAgent }}>
      {children}
    </AgentContext.Provider>
  )
}

export function useAgentContext() {
  const context = useContext(AgentContext)
  if (!context) {
    return { agent: null, setAgent: () => {} }
  }
  return context
}
