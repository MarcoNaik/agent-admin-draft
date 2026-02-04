"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Database,
  Search,
  Layers,
  Calendar,
  GraduationCap,
  UserCheck,
  CreditCard,
  Shield,
  Users,
  ChevronRight,
  Loader2,
  LucideIcon,
} from "lucide-react"
import { useEntityTypes } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Doc } from "@convex/_generated/dataModel"

const entityTypeIcons: Record<string, LucideIcon> = {
  student: GraduationCap,
  teacher: UserCheck,
  guardian: Users,
  session: Calendar,
  payment: CreditCard,
  entitlement: Shield,
}

function getEntityTypeIcon(slug: string): LucideIcon {
  return entityTypeIcons[slug] || Layers
}

export default function EntitiesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { environment } = useEnvironment()
  const entityTypes = useEntityTypes(environment)
  const [search, setSearch] = useState("")

  const filteredEntityTypes = entityTypes
    ? entityTypes.filter((et: Doc<"entityTypes">) =>
        et.name.toLowerCase().includes(search.toLowerCase()) ||
        et.slug.toLowerCase().includes(search.toLowerCase())
      )
    : []

  const currentTypeSlug = pathname.split("/")[2]

  return (
    <div className="flex h-[calc(100vh-49px)]">
      <aside className="w-64 border-r bg-background-secondary flex flex-col shrink-0">
        <div className="p-3 border-b">
          <h2 className="text-sm font-semibold text-content-primary mb-2">Entities</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search entities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm bg-background"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {entityTypes === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEntityTypes.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <Database className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {search ? "No matches found" : "No entity types"}
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filteredEntityTypes.map((entityType: Doc<"entityTypes">) => {
                const Icon = getEntityTypeIcon(entityType.slug)
                const isActive = currentTypeSlug === entityType.slug
                return (
                  <li key={entityType._id}>
                    <Link
                      href={`/entities/${entityType.slug}`}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-content-secondary hover:text-content-primary hover:bg-background-tertiary"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{entityType.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
