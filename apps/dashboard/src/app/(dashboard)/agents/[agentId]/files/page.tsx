import { FileText } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AgentFilesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Files</h2>
        <p className="text-muted-foreground">View your agent&apos;s file storage</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            File Storage
          </CardTitle>
          <CardDescription>Files stored by your agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-medium">No files stored</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Files will appear here when your agent stores them
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
