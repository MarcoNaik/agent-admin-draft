const pages: Record<string, string> = {
  "privacy-policy": `# Privacy Policy

Last updated: February 15, 2026

## 1. Overview

Struere ("we", "us", "our") operates the Struere platform, a permission-aware AI agent platform for small businesses. This policy describes how we collect, use, and protect your information when you use our website at struere.dev and the Struere application at app.struere.dev.

## 2. Information We Collect

### Account Information
When you create an account, we collect your name, email address, and organization details through our authentication provider, Clerk. We do not store passwords directly.

### Waitlist Information
If you join our waitlist, we collect your email address. This is transmitted to our team via a Discord webhook for internal tracking.

### Platform Data
When using the Struere platform, we store data you provide including agent configurations, entity records, conversation threads, messages, events, and job schedules. All data is scoped to your organization and environment (development or production).

### Usage Data
We track execution metrics including token usage, request duration, and agent activity for billing and performance purposes.

### WhatsApp Data
If you enable the WhatsApp integration, we process inbound and outbound messages, phone numbers, and connection state to facilitate communication between your AI agents and your customers.

## 3. How We Use Your Information

- Provide and operate the Struere platform
- Process AI agent conversations via third-party LLM providers
- Execute custom tools in sandboxed environments
- Enforce role-based access control and permission policies
- Send transactional communications (session reminders, follow-ups)
- Process payments through our payment provider
- Improve our services and debug issues

## 4. Third-Party Services

We use the following third-party services that may process your data:

- **Clerk** — Authentication and user management
- **Convex** — Real-time database and backend infrastructure
- **Anthropic** — AI language model processing for agent conversations
- **Fly.io** — Custom tool execution in sandboxed environments
- **Vercel** — Website and application hosting
- **Flow** — Payment processing

Each service operates under its own privacy policy. We only share the minimum data necessary for each service to function.

## 5. Data Security

We implement multiple layers of security including organization-level data isolation, environment separation (development/production), row-level security via scope rules, column-level security via field masks, API key authentication with SHA-256 hashing, and a deny-overrides-allow permission model. Custom tool execution occurs in sandboxed environments on Fly.io with restricted network access.

## 6. Data Retention

We retain your data for as long as your account is active. Entity deletions are soft-deletes, meaning records are marked as deleted but retained for audit purposes. You may request full data deletion by contacting us.

## 7. Your Rights

- Access the personal data we hold about you
- Request correction of inaccurate data
- Request deletion of your data
- Export your data in a machine-readable format
- Object to processing of your data

To exercise these rights, contact us at privacy@struere.dev.

## 8. Cookies

We use essential cookies for authentication and session management through Clerk. We do not use tracking or advertising cookies.

## 9. Children's Privacy

Struere is not directed at children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, contact us and we will delete it.

## 10. Changes to This Policy

We may update this policy from time to time. We will notify you of significant changes by posting a notice on our website. Continued use of the platform after changes constitutes acceptance.

## 11. Contact

For questions about this privacy policy, contact us at privacy@struere.dev.
`,
  "terms-of-service": `# Terms of Service

Last updated: February 15, 2026

## 1. Acceptance of Terms

By accessing or using the Struere platform ("Service"), operated by Struere ("we", "us", "our"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.

## 2. Description of Service

Struere is a permission-aware AI agent platform that enables businesses to build, deploy, and manage AI agents. The Service includes the web dashboard at app.struere.dev, the Struere CLI, API access, and all related infrastructure including real-time data, agent execution, and third-party integrations.

## 3. Accounts

### Registration
You must create an account to use the Service. You are responsible for maintaining the security of your account credentials and API keys. You must provide accurate and complete information during registration.

### Organizations
The Service is organized around organizations. As an organization administrator, you are responsible for managing members, roles, permissions, and all data within your organization.

### API Keys
API keys provide programmatic access to the Service. You are responsible for keeping your API keys secure and must not share them publicly. Each API key is scoped to a specific environment (development or production). Compromised keys should be revoked immediately.

## 4. Acceptable Use

You agree not to:

- Use the Service to build agents that generate harmful, illegal, or deceptive content
- Attempt to bypass permission controls, scope rules, or environment isolation
- Use custom tool handlers to access unauthorized external services beyond the sandboxed fetch allowlist
- Send spam or unsolicited messages through WhatsApp or other integrations
- Reverse engineer, decompile, or attempt to extract source code from the Service
- Use the Service in violation of any applicable laws or regulations
- Exceed reasonable usage limits or engage in activity that degrades the Service for others

## 5. Your Data

### Ownership
You retain ownership of all data you submit to the Service, including entity records, agent configurations, conversation content, and custom tool code. We do not claim ownership of your data.

### License to Us
You grant us a limited license to store, process, and transmit your data solely to provide the Service. This includes passing conversation data to third-party AI providers for agent execution and transmitting custom tool handler code to our execution infrastructure.

### Environment Isolation
The Service maintains strict isolation between development and production environments. Data, permissions, API keys, and agent configurations are separate per environment. You are responsible for managing your environment configurations appropriately.

## 6. AI Agent Conduct

AI agents you build and deploy through the Service operate under your organization's permissions and policies. You are responsible for the behavior and output of your agents, including messages sent to end users via WhatsApp or other channels. We provide role-based access control, scope rules, and field masks as tools to govern agent behavior, but the configuration and enforcement strategy is your responsibility.

## 7. Third-Party Services

The Service integrates with third-party providers including Anthropic (AI models), Clerk (authentication), Convex (database), Fly.io (tool execution), and Flow (payments). Your use of these services through our platform is subject to their respective terms. We are not liable for outages or changes in third-party services.

## 8. Custom Tools

Custom tool handler code you provide is executed in sandboxed environments on Fly.io with restricted network access. You are responsible for the code you submit and must ensure it does not contain malicious logic, credentials harvesting, or attempts to bypass sandbox restrictions. We reserve the right to disable tools that violate these terms.

## 9. Payment Terms

Certain features of the Service may require payment. Payment processing is handled by Flow. All fees are non-refundable unless otherwise stated. We reserve the right to change pricing with 30 days notice.

## 10. Availability and Support

We aim to maintain high availability but do not guarantee uninterrupted access. The Service is provided on an "as is" and "as available" basis. Scheduled maintenance will be communicated in advance when possible.

## 11. Limitation of Liability

To the maximum extent permitted by law, Struere shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising from your use of the Service. Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.

## 12. Indemnification

You agree to indemnify and hold harmless Struere from any claims, damages, or expenses arising from your use of the Service, your violation of these terms, or the actions of AI agents you deploy through the platform.

## 13. Termination

Either party may terminate at any time. We may suspend or terminate your access if you violate these terms. Upon termination, your right to use the Service ceases immediately. We will retain your data for 30 days after termination, after which it may be permanently deleted.

## 14. Changes to Terms

We may modify these terms at any time. Material changes will be communicated via email or a notice on the platform. Continued use after changes constitutes acceptance. If you disagree with changes, you must stop using the Service.

## 15. Governing Law

These terms are governed by the laws of the jurisdiction in which Struere operates. Any disputes shall be resolved through binding arbitration, except where prohibited by law.

## 16. Contact

For questions about these terms, contact us at legal@struere.dev.
`,
}

export async function GET(
  _request: Request,
  { params }: { params: { slug: string[] } }
) {
  const slug = params.slug.join("/")
  const markdown = pages[slug]

  if (!markdown) {
    return new Response("# Not Found\n\nThis page does not exist.\n", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    })
  }

  return new Response(markdown, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  })
}
