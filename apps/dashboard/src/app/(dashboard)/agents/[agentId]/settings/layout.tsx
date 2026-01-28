import { SettingsSidebar } from "@/components/settings-sidebar"

interface SettingsLayoutProps {
  children: React.ReactNode
  params: Promise<{ agentId: string }>
}

export default async function SettingsLayout({ children, params }: SettingsLayoutProps) {
  const { agentId } = await params

  return (
    <div className="flex gap-8">
      <SettingsSidebar agentId={agentId} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
