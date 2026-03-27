import type { Metadata } from "next"
import { ContactContent } from "./contact-content"

export const metadata: Metadata = {
  title: "Contact — Struere",
  description: "Get in touch with the Struere team. We'd love to hear about your project, answer questions, or explore partnerships.",
}

export default function ContactPage() {
  return <ContactContent />
}
