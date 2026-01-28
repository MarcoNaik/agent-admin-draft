import { Code } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AgentFunctionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Functions</h2>
        <p className="text-muted-foreground">View your agent&apos;s registered functions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Registered Functions
          </CardTitle>
          <CardDescription>Functions available in your agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Code className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-medium">No functions registered</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Functions will appear here after deployment
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
