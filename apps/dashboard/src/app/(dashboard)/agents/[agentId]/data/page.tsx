import { Database } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AgentDataPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Data</h2>
        <p className="text-muted-foreground">View and manage your agent&apos;s data</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Storage
          </CardTitle>
          <CardDescription>Browse and manage stored data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-medium">No data stored</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Data will appear here when your agent stores information
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
