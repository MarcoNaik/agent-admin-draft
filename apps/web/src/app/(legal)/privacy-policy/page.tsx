import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy — Struere",
  description: "How Struere collects, uses, and protects your information.",
}

export default function PrivacyPolicy() {
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
          Privacy Policy
        </h1>
        <p className="text-sm text-charcoal/40 mb-16">
          Last updated: March 20, 2026
        </p>

        <div className="space-y-16">
          <Section title="1. Overview">
            <p>
              Struere (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
              operates the Struere platform, a permission-aware AI agent platform
              for small businesses. This policy describes how we collect, use,
              and protect your information when you use our website at
              struere.dev and the Struere application at app.struere.dev.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <Subsection title="Account Information">
              <p>
                When you create an account, we collect your name, email address,
                and organization details through our authentication provider,
                Clerk. We do not store passwords directly.
              </p>
            </Subsection>

            <Subsection title="Waitlist Information">
              <p>
                If you join our waitlist, we collect your email address. This is
                transmitted to our team via a Discord webhook for internal
                tracking.
              </p>
            </Subsection>

            <Subsection title="Platform Data">
              <p>
                When using the Struere platform, we store data you provide
                including agent configurations, entity records, conversation
                threads, messages, events, and job schedules. All data is scoped
                to your organization and environment (development or production).
              </p>
            </Subsection>

            <Subsection title="Usage Data">
              <p>
                We track execution metrics including token usage, request
                duration, and agent activity for billing and performance
                purposes.
              </p>
            </Subsection>

            <Subsection title="WhatsApp Data">
              <p>
                If you enable the WhatsApp integration, we process inbound and
                outbound messages, phone numbers, and connection state to
                facilitate communication between your AI agents and your
                customers.
              </p>
            </Subsection>

            <Subsection title="Google Calendar Data">
              <p>
                If you connect Google Calendar, we request access to the
                following OAuth scopes via Google&rsquo;s authorization flow:
              </p>
              <ul className="list-none space-y-3 mt-3">
                <li className="text-charcoal/70">
                  — <strong>https://www.googleapis.com/auth/calendar.calendarlist.readonly</strong> —
                  Read-only access to the list of Google calendars you&rsquo;re subscribed to
                </li>
                <li className="text-charcoal/70">
                  — <strong>https://www.googleapis.com/auth/calendar.events</strong> —
                  Read and write access to calendar events
                </li>
              </ul>
              <p className="mt-3">
                This data is used exclusively to enable your AI agents to list,
                create, update, and delete calendar events and check free/busy
                availability on your behalf. We store a reference to your
                connected calendar (calendar ID and connection state) in our
                database, scoped to your organization and environment. OAuth
                tokens are managed by Clerk and are not stored directly by
                Struere. We do not access calendars beyond the specific account
                you authorize, and we do not use your calendar data for
                advertising, profiling, or any purpose unrelated to providing
                the Struere platform.
              </p>
              <p className="mt-3">
                You can revoke Struere&rsquo;s access to your Google Calendar at
                any time by disconnecting the integration in the Struere
                dashboard or by removing access in your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ocean hover:text-ocean-light underline transition-colors"
                >
                  Google Account permissions
                </a>
                . Struere&rsquo;s use and transfer of information received from
                Google APIs adheres to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ocean hover:text-ocean-light underline transition-colors"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
            </Subsection>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-none space-y-3">
              <li className="text-charcoal/70">— Provide and operate the Struere platform</li>
              <li className="text-charcoal/70">— Process AI agent conversations via third-party LLM providers</li>
              <li className="text-charcoal/70">— Execute custom tools in sandboxed environments</li>
              <li className="text-charcoal/70">— Enforce role-based access control and permission policies</li>
              <li className="text-charcoal/70">— Send transactional communications (session reminders, follow-ups)</li>
              <li className="text-charcoal/70">— Process payments through our payment provider</li>
              <li className="text-charcoal/70">— Improve our services and debug issues</li>
            </ul>
          </Section>

          <Section title="4. Third-Party Services">
            <p className="mb-4">
              We use the following third-party services that may process your
              data:
            </p>
            <ul className="list-none space-y-3">
              <li className="text-charcoal/70">
                <strong className="text-charcoal">Clerk</strong> — Authentication and user management
              </li>
              <li className="text-charcoal/70">
                <strong className="text-charcoal">Convex</strong> — Real-time database and backend
                infrastructure
              </li>
              <li className="text-charcoal/70">
                <strong className="text-charcoal">Anthropic</strong> — AI language model processing for
                agent conversations
              </li>
              <li className="text-charcoal/70">
                <strong className="text-charcoal">Google</strong> — Calendar integration via Google
                Calendar API (OAuth 2.0)
              </li>
              <li className="text-charcoal/70">
                <strong className="text-charcoal">Fly.io</strong> — Custom tool execution in sandboxed
                environments
              </li>
              <li className="text-charcoal/70">
                <strong className="text-charcoal">Vercel</strong> — Website and application hosting
              </li>
              <li className="text-charcoal/70">
                <strong className="text-charcoal">Flow</strong> — Payment processing
              </li>
            </ul>
            <p className="mt-4">
              Each service operates under its own privacy policy. We only share
              the minimum data necessary for each service to function.
            </p>
          </Section>

          <Section title="5. Data Security">
            <p>
              We implement multiple layers of security including organization-level
              data isolation, environment separation (development/production),
              row-level security via scope rules, column-level security via field
              masks, API key authentication with SHA-256 hashing, and a
              deny-overrides-allow permission model. Custom tool execution occurs
              in sandboxed environments on Fly.io with restricted network access.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your data for as long as your account is active. Entity
              deletions are soft-deletes, meaning records are marked as deleted
              but retained for audit purposes. You may request full data deletion
              by contacting us.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <ul className="list-none space-y-3">
              <li className="text-charcoal/70">— Access the personal data we hold about you</li>
              <li className="text-charcoal/70">— Request correction of inaccurate data</li>
              <li className="text-charcoal/70">— Request deletion of your data</li>
              <li className="text-charcoal/70">— Export your data in a machine-readable format</li>
              <li className="text-charcoal/70">— Object to processing of your data</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, contact us at privacy@struere.dev.
            </p>
          </Section>

          <Section title="8. Cookies">
            <p>
              We use essential cookies for authentication and session management
              through Clerk. We do not use tracking or advertising cookies.
            </p>
          </Section>

          <Section title="9. Children&rsquo;s Privacy">
            <p>
              Struere is not directed at children under 13. We do not knowingly
              collect personal information from children. If you believe a child
              has provided us with personal data, contact us and we will delete
              it.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this policy from time to time. We will notify you of
              significant changes by posting a notice on our website. Continued
              use of the platform after changes constitutes acceptance.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              For questions about this privacy policy, contact us at
              privacy@struere.dev.
            </p>
          </Section>
        </div>

        <footer className="mt-20 pt-8 border-t border-charcoal/5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-charcoal/40">
              &copy; {new Date().getFullYear()} Struere
            </p>
            <Link
              href="/terms-of-service"
              className="text-sm text-charcoal/50 hover:text-charcoal transition-colors"
            >
              Terms of Service
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
