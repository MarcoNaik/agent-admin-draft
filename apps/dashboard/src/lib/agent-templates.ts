export type AgentTemplate = {
  id: string
  title: string
  description: string
  icon: string
  prompt: string
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "customer-support",
    title: "Customer Support",
    description: "Answer questions and resolve issues",
    icon: "MessageSquare",
    prompt: "Create a customer support agent that answers product questions, looks up customer records, and escalates complex issues",
  },
  {
    id: "scheduling",
    title: "Scheduling Assistant",
    description: "Manage appointments and calendars",
    icon: "Calendar",
    prompt: "Create a scheduling assistant that helps manage appointments, check availability, and send reminders",
  },
  {
    id: "automation",
    title: "Task Automation",
    description: "Automate workflows with triggers",
    icon: "Zap",
    prompt: "Create an automation agent that sets up workflows, emits events, and manages triggers for business processes",
  },
  {
    id: "scratch",
    title: "Start from scratch",
    description: "Describe anything you want to build",
    icon: "Sparkles",
    prompt: "",
  },
]
