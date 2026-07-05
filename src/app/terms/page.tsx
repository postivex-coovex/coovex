import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'

const LAST_UPDATED = 'June 24, 2026'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">

      <nav className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-white font-bold text-lg tracking-tight">⚡ CooVex</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login"  className="text-slate-400 hover:text-white transition-colors">Login</Link>
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">Start Free</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <div className="inline-block bg-violet-900/30 border border-violet-700/40 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full mb-4">Legal</div>
          <h1 className="text-4xl font-bold text-white mb-3">Terms of Service</h1>
          <p className="text-slate-500 text-sm">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-8 text-slate-400 text-sm leading-relaxed">
          <section>
            <p>These Terms of Service ("Terms") govern your use of the CooVex platform and services ("Service"). By creating an account or using the Service, you agree to these Terms. If you are using CooVex on behalf of an organisation, you represent that you have authority to bind that organisation.</p>
          </section>

          <Section title="1. The Service">
            <p>CooVex provides AI-powered business intelligence tools including competitor monitoring, lead tracking, content analysis, forecasting, and related features. We reserve the right to modify, suspend, or discontinue any part of the Service at any time with reasonable notice.</p>
          </Section>

          <Section title="2. Account Registration">
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the security of your credentials and all activity under your account.</li>
              <li>You must be at least 18 years old and legally capable of entering into a binding contract.</li>
              <li>One person or legal entity may not maintain more than one free account.</li>
            </ul>
          </Section>

          <Section title="3. Free Trial">
            <p>Certain plans include a 14-day free trial. At the end of the trial, your account will be downgraded to the free tier or your paid subscription will begin, depending on the plan you selected. We will notify you before your trial ends.</p>
          </Section>

          <Section title="4. Subscriptions and Billing">
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Paid plans are billed monthly or annually in advance.</li>
              <li>All fees are exclusive of taxes unless stated otherwise.</li>
              <li>Subscriptions automatically renew until cancelled.</li>
              <li>You may cancel at any time; cancellation takes effect at the end of the current billing period.</li>
              <li>Refunds are issued at our discretion. We generally do not provide pro-rata refunds for partial months.</li>
              <li>We reserve the right to change pricing with 30 days' notice to existing customers.</li>
            </ul>
          </Section>

          <Section title="5. Acceptable Use">
            <p>You may not use CooVex to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Violate any applicable law or regulation</li>
              <li>Infringe intellectual property rights of third parties</li>
              <li>Transmit malware, spam, or other harmful content</li>
              <li>Attempt to reverse-engineer, copy, or resell the platform</li>
              <li>Scrape data at volumes that harm system performance</li>
              <li>Use the platform for any illegal monitoring or surveillance</li>
            </ul>
            <p className="mt-3">We may suspend or terminate accounts that violate these rules without notice.</p>
          </Section>

          <Section title="6. Your Data">
            <p>You retain ownership of all data you upload or connect to CooVex. By using the Service, you grant us a licence to process that data solely to provide the Service. See our <Link href="/privacy" className="text-violet-400 hover:text-violet-300">Privacy Policy</Link> for full details.</p>
          </Section>

          <Section title="7. AI-Generated Content">
            <p>CooVex uses AI models to generate insights, reports, and recommendations. AI output may be inaccurate, incomplete, or outdated. You are solely responsible for decisions made based on AI-generated content. Do not rely on it as professional legal, financial, or medical advice.</p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>The CooVex platform, brand, and all original content created by us are our exclusive property. Nothing in these Terms transfers any IP rights to you except the limited licence to use the Service.</p>
          </Section>

          <Section title="9. Agency and White-Label Use">
            <p>Agency plan subscribers may resell or white-label CooVex to their clients, subject to our Agency Agreement. Agencies are responsible for their clients' compliance with these Terms.</p>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <p>The Service is provided "as is" and "as available." We disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or that results will be accurate.</p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>To the maximum extent permitted by law, our total liability to you for any claim arising out of or relating to these Terms or the Service shall not exceed the amount you paid us in the 12 months preceding the claim. We are not liable for indirect, incidental, special, or consequential damages.</p>
          </Section>

          <Section title="12. Indemnification">
            <p>You agree to indemnify and hold harmless CooVex, its officers, employees, and partners from any claims, damages, or expenses (including legal fees) arising from your use of the Service or violation of these Terms.</p>
          </Section>

          <Section title="13. Governing Law">
            <p>These Terms are governed by applicable law. For users in the EU/EEA, mandatory consumer protection laws in your country of residence may also apply.</p>
          </Section>

          <Section title="14. Changes to Terms">
            <p>We may update these Terms. We will provide at least 14 days' notice of material changes via email or in-app notice. Continued use after the effective date constitutes acceptance.</p>
          </Section>

          <Section title="15. Contact">
            <p>Questions about these Terms: <strong className="text-white">legal@coovex.com</strong></p>
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
