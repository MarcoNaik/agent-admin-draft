import { type IconComponent } from "@/lib/icons"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: IconComponent
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/30 py-20">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-secondary mb-4">
        <Icon className="h-6 w-6 text-content-tertiary" />
      </div>
      <p className="text-sm font-medium text-content-secondary">{title}</p>
      <p className="text-xs text-content-tertiary mt-1.5 max-w-[280px] text-center">
        {description}
      </p>
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
