"use client"

import { createContext, useContext } from "react"
import type { SettingsTab } from "@/components/settings-sidebar"

interface SettingsTabContextValue {
  activeTab: SettingsTab
  setActiveTab: (tab: SettingsTab) => void
}

export const SettingsTabContext = createContext<SettingsTabContextValue>({
  activeTab: "edit",
  setActiveTab: () => {},
})

export function useSettingsTab() {
  return useContext(SettingsTabContext)
}
