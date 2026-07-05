import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'

const LAST_UPDATED = 'June 24, 2026'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Nav */}
      <nav className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-white font-bold text-lg tracking-tight">⚡ CooVex</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-slate-400 hover:text-white transition-colors">Login</Link>
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">Start Free</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <div className="inline-block bg-violet-900/30 border border-violet-700/40 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full mb-4">Legal</div>
          <h1 className="text-4xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className="text-slate-500 text-sm">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-slate-400 text-sm leading-relaxed">

          <section>
            <p>CooVex ("we", "our", or "us") is committed to protecting the privacy of businesses and individuals who use our platform. This Privacy Policy explains what data we collect, how we use it, and your rights under applicable law.</p>
            <p className="mt-3">By using CooVex, you agree to the practices described in this policy. If you do not agree, please stop using our services.</p>
          </section>

          <Section title="1. Who We Are">
            <p>CooVex is an AI-powered business intelligence platform. Our registered contact for privacy matters is: <strong className="text-white">privacy@coovex.com</strong></p>
          </Section>

          <Section title="2. Information We Collect">
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong className="text-white">Account data:</strong> Name, work email address, and password when you create an account.</li>
              <li><strong className="text-white">Business data you provide:</strong> Company name, website URL, competitors, products, and any content you upload or connect via integrations.</li>
              <li><strong className="text-white">Integration data:</strong> Data from third-party services you authorise (Google Analytics, social platforms, review sites, etc.).</li>
              <li><strong className="text-white">Usage data:</strong> Pages visited, features used, button clicks, session duration, and device/browser info.</li>
              <li><strong className="text-white">Communication data:</strong> Messages sent to our support team or through in-app chat.</li>
              <li><strong className="text-white">Billing data:</strong> Payment information processed by our payment provider (Stripe). We do not store full card numbers.</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Provide, maintain, and improve the CooVex platform</li>
              <li>Generate AI-powered insights, reports, and recommendations for your business</li>
              <li>Send transactional emails (account confirmation, billing receipts, alerts)</li>
              <li>Send product updates and marketing communications (you can opt out at any time)</li>
              <li>Detect and prevent fraud, abuse, or security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
          </Section>

          <Section title="4. Legal Basis for Processing (GDPR)">
            <p>For users in the European Economic Area, UK, or other jurisdictions requiring a legal basis:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong className="text-white">Contract performance:</strong> Processing necessary to deliver the service you signed up for.</li>
              <li><strong className="text-white">Legitimate interests:</strong> Security, fraud prevention, product improvement, and analytics.</li>
              <li><strong className="text-white">Consent:</strong> Marketing communications where required by law.</li>
              <li><strong className="text-white">Legal obligation:</strong> Compliance with applicable laws.</li>
            </ul>
          </Section>

          <Section title="5. Data Sharing">
            <p>We do not sell your data. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong className="text-white">Service providers:</strong> Supabase (database), Stripe (payments), Anthropic (AI processing), Vercel (hosting), Resend (email). These providers are contractually bound to protect your data.</li>
              <li><strong className="text-white">Agency white-label customers:</strong> If your account is managed by an agency on CooVex, that agency may access your workspace data.</li>
              <li><strong className="text-white">Legal requirements:</strong> When required by law, court order, or to protect our rights.</li>
            </ul>
          </Section>

          <Section title="6. Data Retention">
            <p>We retain your data for as long as your account is active. After account deletion:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Active workspace data is deleted within 30 days</li>
              <li>Billing records are retained for 7 years (legal requirement)</li>
              <li>Anonymised, aggregated analytics may be retained indefinitely</li>
            </ul>
          </Section>

          <Section title="7. Cookies">
            <p>We use cookies and similar technologies for authentication (session tokens), preferences, and analytics. You can manage cookies through your browser settings or our <Link href="/cookies" className="text-violet-400 hover:text-violet-300">Cookie Policy</Link>.</p>
          </Section>

          <Section title="8. International Transfers">
            <p>CooVex operates globally. Your data may be processed in countries outside your own. Where we transfer data outside the EEA, we use Standard Contractual Clauses or equivalent safeguards.</p>
          </Section>

          <Section title="9. Your Rights">
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion ("right to be forgotten")</li>
              <li>Restrict or object to processing</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="mt-3">To exercise any right, email <strong className="text-white">privacy@coovex.com</strong>. We will respond within 30 days.</p>
          </Section>

          <Section title="10. Children">
            <p>CooVex is designed for businesses and professionals. We do not knowingly collect data from individuals under 16. If you believe a minor has provided us data, contact us immediately.</p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>We may update this policy. Material changes will be communicated by email or in-app notice at least 14 days before they take effect. Continued use after the effective date constitutes acceptance.</p>
          </Section>

          <Section title="12. Contact">
            <p>Questions or requests regarding this policy: <strong className="text-white">privacy@coovex.com</strong></p>
          </Section>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-white font-semibold text-base mb-2">{title}</h2>
      {children}
    </section>
  )
}
