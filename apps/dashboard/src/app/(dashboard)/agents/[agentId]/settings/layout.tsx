"use client"

import { useState } from "react"
import { SettingsSidebar, SettingsTab } from "@/components/settings-sidebar"
import { SettingsTabContext } from "@/contexts/settings-tab-context"

interface SettingsLayoutProps {
  children: React.ReactNode
  params: { agentId: string }
}

export default function SettingsLayout({ children, params }: SettingsLayoutProps) {
  const { agentId } = params
  const [activeTab, setActiveTab] = useState<SettingsTab>("edit")

  return (
    <SettingsTabContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="flex gap-8">
        <SettingsSidebar agentId={agentId} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </SettingsTabContext.Provider>
  )
}
