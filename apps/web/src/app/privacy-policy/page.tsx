"use client"

import Link from "next/link"

export default function PrivacyPolicy() {
  return (
    <div
      className="min-h-screen font-source"
      style={{ backgroundColor: "#F5F1E8", color: "#1B4332" }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(27, 67, 50, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 67, 50, 0.06) 1px, transparent 1px),
            linear-gradient(rgba(27, 67, 50, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 67, 50, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px, 80px 80px, 16px 16px, 16px 16px",
        }}
      />

      <div className="relative mx-auto max-w-2xl px-6 md:px-8 py-16">
        <nav className="mb-16">
          <Link
            href="/"
            className="text-[10px] tracking-[0.3em] uppercase opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: "#2D5A45" }}
          >
            &larr; Struere
          </Link>
        </nav>

        <h1 className="text-sm tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-[10px] tracking-wider opacity-50 mb-16">
          Last updated: February 15, 2026
        </p>

        <div className="space-y-12">
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
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-none space-y-2">
              <li>— Provide and operate the Struere platform</li>
              <li>— Process AI agent conversations via third-party LLM providers</li>
              <li>— Execute custom tools in sandboxed environments</li>
              <li>— Enforce role-based access control and permission policies</li>
              <li>— Send transactional communications (session reminders, follow-ups)</li>
              <li>— Process payments through our payment provider</li>
              <li>— Improve our services and debug issues</li>
            </ul>
          </Section>

          <Section title="4. Third-Party Services">
            <p className="mb-4">
              We use the following third-party services that may process your
              data:
            </p>
            <ul className="list-none space-y-2">
              <li>
                <strong>Clerk</strong> — Authentication and user management
              </li>
              <li>
                <strong>Convex</strong> — Real-time database and backend
                infrastructure
              </li>
              <li>
                <strong>Anthropic</strong> — AI language model processing for
                agent conversations
              </li>
              <li>
                <strong>Cloudflare</strong> — Custom tool execution in sandboxed
                workers
              </li>
              <li>
                <strong>Vercel</strong> — Website and application hosting
              </li>
              <li>
                <strong>Flow</strong> — Payment processing
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
              in sandboxed Cloudflare Workers with restricted network access.
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
            <ul className="list-none space-y-2">
              <li>— Access the personal data we hold about you</li>
              <li>— Request correction of inaccurate data</li>
              <li>— Request deletion of your data</li>
              <li>— Export your data in a machine-readable format</li>
              <li>— Object to processing of your data</li>
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

        <footer className="mt-20 pt-8 border-t" style={{ borderColor: "rgba(45, 90, 69, 0.2)" }}>
          <div className="flex justify-between items-center">
            <p className="text-[10px] opacity-50">
              &copy; {new Date().getFullYear()} Struere
            </p>
            <Link
              href="/terms-of-service"
              className="text-[10px] opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: "#2D5A45" }}
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
      <h2 className="text-xs tracking-wide mb-4" style={{ color: "#1B4332" }}>
        {title}
      </h2>
      <div
        className="text-[11px] leading-relaxed space-y-3"
        style={{ color: "#2D5A45" }}
      >
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
      <h3 className="text-[11px] font-medium mb-1" style={{ color: "#1B4332" }}>
        {title}
      </h3>
      {children}
    </div>
  )
}
