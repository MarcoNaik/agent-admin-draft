import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service — Struere",
  description: "Terms and conditions for using the Struere platform.",
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-stone-base">
      <div className="mx-auto max-w-3xl px-6 md:px-12 py-20 md:py-28">
        <nav className="mb-12">
          <Link
            href="/"
            className="text-sm text-charcoal/50 hover:text-charcoal transition-colors"
          >
            &larr; Struere
          </Link>
        </nav>

        <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-charcoal-heading mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-charcoal/40 mb-16">
          Last updated: March 20, 2026
        </p>

        <div className="space-y-16">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using the Struere platform (&ldquo;Service&rdquo;),
              operated by Struere (&ldquo;we&rdquo;, &ldquo;us&rdquo;,
              &ldquo;our&rdquo;), you agree to be bound by these Terms of
              Service. If you do not agree, do not use the Service.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              Struere is a permission-aware AI agent platform that enables
              businesses to build, deploy, and manage AI agents. The Service
              includes the web dashboard at app.struere.dev, the Struere CLI,
              API access, and all related infrastructure including real-time
              data, agent execution, and third-party integrations.
            </p>
          </Section>

          <Section title="3. Accounts">
            <Subsection title="Registration">
              <p>
                You must create an account to use the Service. You are
                responsible for maintaining the security of your account
                credentials and API keys. You must provide accurate and complete
                information during registration.
              </p>
            </Subsection>

            <Subsection title="Organizations">
              <p>
                The Service is organized around organizations. As an organization
                administrator, you are responsible for managing members, roles,
                permissions, and all data within your organization.
              </p>
            </Subsection>

            <Subsection title="API Keys">
              <p>
                API keys provide programmatic access to the Service. You are
                responsible for keeping your API keys secure and must not share
                them publicly. Each API key is scoped to a specific environment
                (development or production). Compromised keys should be revoked
                immediately.
              </p>
            </Subsection>
          </Section>

          <Section title="4. Acceptable Use">
            <p className="mb-3">You agree not to:</p>
            <ul className="list-none space-y-3">
              <li className="text-charcoal/70">
                — Use the Service to build agents that generate harmful, illegal,
                or deceptive content
              </li>
              <li className="text-charcoal/70">
                — Attempt to bypass permission controls, scope rules, or
                environment isolation
              </li>
              <li className="text-charcoal/70">
                — Use custom tool handlers to access unauthorized external
                services beyond the sandboxed fetch allowlist
              </li>
              <li className="text-charcoal/70">
                — Send spam or unsolicited messages through WhatsApp or other
                integrations
              </li>
              <li className="text-charcoal/70">
                — Reverse engineer, decompile, or attempt to extract source code
                from the Service
              </li>
              <li className="text-charcoal/70">
                — Use the Service in violation of any applicable laws or
                regulations
              </li>
              <li className="text-charcoal/70">
                — Exceed reasonable usage limits or engage in activity that
                degrades the Service for others
              </li>
            </ul>
          </Section>

          <Section title="5. Your Data">
            <Subsection title="Ownership">
              <p>
                You retain ownership of all data you submit to the Service,
                including entity records, agent configurations, conversation
                content, and custom tool code. We do not claim ownership of your
                data.
              </p>
            </Subsection>

            <Subsection title="License to Us">
              <p>
                You grant us a limited license to store, process, and transmit
                your data solely to provide the Service. This includes passing
                conversation data to third-party AI providers for agent
                execution and transmitting custom tool handler code to our
                execution infrastructure.
              </p>
            </Subsection>

            <Subsection title="Environment Isolation">
              <p>
                The Service maintains strict isolation between development and
                production environments. Data, permissions, API keys, and agent
                configurations are separate per environment. You are responsible
                for managing your environment configurations appropriately.
              </p>
            </Subsection>
          </Section>

          <Section title="6. AI Agent Conduct">
            <p>
              AI agents you build and deploy through the Service operate under
              your organization&rsquo;s permissions and policies. You are
              responsible for the behavior and output of your agents, including
              messages sent to end users via WhatsApp or other channels. We
              provide role-based access control, scope rules, and field masks as
              tools to govern agent behavior, but the configuration and
              enforcement strategy is your responsibility.
            </p>
          </Section>

          <Section title="7. Third-Party Services">
            <p>
              The Service integrates with third-party providers including
              Google (Calendar API), Anthropic (AI models), Clerk
              (authentication), Convex (database), Fly.io (tool execution),
              and Flow (payments). Your use of these services through our
              platform is subject to their respective terms. We are not liable
              for outages or changes in third-party services.
            </p>
          </Section>

          <Section title="7a. Google API Services">
            <p>
              When you connect Google Calendar through the Service, you
              authorize Struere to access your Google Calendar data via
              OAuth 2.0. Struere&rsquo;s use and transfer of information
              received from Google APIs to any other app adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ocean hover:text-ocean-light underline transition-colors"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. You may revoke access
              at any time through the Struere dashboard or your Google Account
              permissions.
            </p>
          </Section>

          <Section title="8. Custom Tools">
            <p>
              Custom tool handler code you provide is executed in sandboxed
              environments on Fly.io with restricted network access. You are
              responsible for the code you submit and must ensure it does not
              contain malicious logic, credentials harvesting, or attempts to
              bypass sandbox restrictions. We reserve the right to disable tools
              that violate these terms.
            </p>
          </Section>

          <Section title="9. Payment Terms">
            <p>
              Certain features of the Service may require payment. Payment
              processing is handled by Flow. All fees are non-refundable unless
              otherwise stated. We reserve the right to change pricing with 30
              days notice.
            </p>
          </Section>

          <Section title="10. Availability and Support">
            <p>
              We aim to maintain high availability but do not guarantee
              uninterrupted access. The Service is provided on an &ldquo;as
              is&rdquo; and &ldquo;as available&rdquo; basis. Scheduled
              maintenance will be communicated in advance when possible.
            </p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Struere shall not be
              liable for any indirect, incidental, special, consequential, or
              punitive damages, including loss of profits, data, or business
              opportunities, arising from your use of the Service. Our total
              liability shall not exceed the amount you paid us in the 12 months
              preceding the claim.
            </p>
          </Section>

          <Section title="12. Indemnification">
            <p>
              You agree to indemnify and hold harmless Struere from any claims,
              damages, or expenses arising from your use of the Service, your
              violation of these terms, or the actions of AI agents you deploy
              through the platform.
            </p>
          </Section>

          <Section title="13. Termination">
            <p>
              Either party may terminate at any time. We may suspend or
              terminate your access if you violate these terms. Upon
              termination, your right to use the Service ceases immediately. We
              will retain your data for 30 days after termination, after which
              it may be permanently deleted.
            </p>
          </Section>

          <Section title="14. Changes to Terms">
            <p>
              We may modify these terms at any time. Material changes will be
              communicated via email or a notice on the platform. Continued use
              after changes constitutes acceptance. If you disagree with
              changes, you must stop using the Service.
            </p>
          </Section>

          <Section title="15. Governing Law">
            <p>
              These terms are governed by the laws of the jurisdiction in which
              Struere operates. Any disputes shall be resolved through binding
              arbitration, except where prohibited by law.
            </p>
          </Section>

          <Section title="16. Contact">
            <p>
              For questions about these terms, contact us at legal@struere.dev.
            </p>
          </Section>
        </div>

        <footer className="mt-20 pt-8 border-t border-charcoal/5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-charcoal/40">
              &copy; {new Date().getFullYear()} Struere
            </p>
            <Link
              href="/privacy-policy"
              className="text-sm text-charcoal/50 hover:text-charcoal transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="font-display text-lg md:text-xl font-medium text-charcoal-heading mb-4">
        {title}
      </h2>
      <div className="font-sans text-base leading-relaxed text-charcoal/80 space-y-3">
        {children}
      </div>
    </section>
  )
}

function Subsection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-charcoal-heading mb-1">
        {title}
      </h3>
      {children}
    </div>
  )
}
