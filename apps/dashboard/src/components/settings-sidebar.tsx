"use client"

import { cn } from "@/lib/utils"

export type SettingsTab = "edit" | "api-keys" | "delete"

interface SettingsSidebarProps {
  agentId: string
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}

const navItems: { label: string; tab: SettingsTab; variant?: "destructive" }[] = [
  { label: "Edit Agent", tab: "edit" },
  { label: "API Keys", tab: "api-keys" },
  { label: "Delete Agent", tab: "delete", variant: "destructive" },
]

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <nav className="w-56 flex-shrink-0 space-y-1">
      {navItems.map((item) => (
        <button
          key={item.tab}
          type="button"
          onClick={() => onTabChange(item.tab)}
          className={cn(
            "block w-full text-left rounded-md px-3 py-2 text-sm transition-colors cursor-pointer",
            item.variant === "destructive"
              ? activeTab === item.tab
                ? "bg-destructive/10 text-destructive font-medium"
                : "text-destructive hover:bg-destructive/10"
              : activeTab === item.tab
                ? "bg-background-tertiary text-content-primary font-medium"
                : "text-content-secondary hover:bg-background-tertiary hover:text-content-primary"
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
