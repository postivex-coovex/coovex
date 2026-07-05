import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'CooVex Privacy Policy — how we collect, use, and protect your data.',
}

const LAST_UPDATED = 'June 25, 2026'
const CONTACT_EMAIL = 'privacy@coovex.com'
const APP_URL = 'https://coovex.com'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="text-white font-bold text-lg">CooVex</span>
          </Link>
          <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
            Sign in →
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-wider mb-3">Legal</p>
          <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-slate-400">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-12 text-[15px] leading-7">

          <Section title="1. Introduction">
            <p>
              CooVex (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates {APP_URL} and provides an AI-powered business management
              platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when
              you use our service. Please read this policy carefully. By using CooVex, you agree to the terms described here.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <Subsection title="2.1 Information you provide directly">
              <ul className="list-disc pl-5 space-y-1">
                <li>Account information: name, email address, password</li>
                <li>Business information: business name, industry, website, description</li>
                <li>Social media profile URLs and handles you connect</li>
                <li>Content you create (posts, proposals, campaigns)</li>
                <li>Customer and lead data you import or enter</li>
                <li>Payment information (processed securely by Stripe — we do not store card details)</li>
              </ul>
            </Subsection>
            <Subsection title="2.2 Information collected automatically">
              <ul className="list-disc pl-5 space-y-1">
                <li>Usage data: pages visited, features used, actions taken</li>
                <li>Device and browser information</li>
                <li>IP address and general location</li>
                <li>Last active time and session data</li>
              </ul>
            </Subsection>
            <Subsection title="2.3 Information from third-party platforms">
              <p>When you connect your social media accounts, we may receive:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong className="text-white">Facebook / Instagram:</strong> Page name, follower count, post performance, reviews, messages (only with your explicit authorization)</li>
                <li><strong className="text-white">LinkedIn:</strong> Profile information, company page data, post analytics</li>
                <li><strong className="text-white">Google:</strong> Business listing information, reviews, website performance data</li>
              </ul>
              <p className="mt-3">We only access data that you explicitly authorize through each platform&apos;s OAuth consent screen.</p>
            </Subsection>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide, operate, and improve the CooVex platform</li>
              <li>To generate AI-powered business insights and recommendations</li>
              <li>To send transactional emails (account confirmation, password reset, feature updates)</li>
              <li>To send re-engagement and digest emails (you can unsubscribe anytime)</li>
              <li>To monitor your connected social accounts and surface relevant signals</li>
              <li>To detect and prevent fraud, abuse, and security threats</li>
              <li>To comply with legal obligations</li>
            </ul>
            <p className="mt-4">
              We do not sell your personal data to third parties. We do not use your data to train AI models without explicit consent.
            </p>
          </Section>

          <Section title="4. Data Sharing">
            <p>We share your data only with:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong className="text-white">Supabase</strong> — database and authentication infrastructure</li>
              <li><strong className="text-white">Anthropic (Claude AI)</strong> — AI processing for business insights (data is not retained by Anthropic for training)</li>
              <li><strong className="text-white">Resend</strong> — transactional email delivery</li>
              <li><strong className="text-white">Stripe</strong> — payment processing</li>
              <li><strong className="text-white">Vercel</strong> — hosting and infrastructure</li>
              <li><strong className="text-white">Google (PageSpeed API)</strong> — website performance analysis</li>
            </ul>
            <p className="mt-4">All sub-processors are contractually obligated to protect your data and use it only as directed by us.</p>
          </Section>

          <Section title="5. Facebook and Meta Platform Data">
            <p>
              When you connect your Facebook Page or Instagram account, CooVex accesses data strictly as authorized
              by you through Meta&apos;s OAuth flow. Specifically:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>We only request permissions necessary to provide the features you use</li>
              <li>We do not sell or share your Facebook/Instagram data with any third party</li>
              <li>We do not use your Facebook data for advertising purposes</li>
              <li>You can revoke access at any time from your Facebook Settings → Apps and Websites</li>
              <li>Page data (posts, insights, reviews) is stored only to display within your CooVex dashboard</li>
              <li>We comply with <a href="https://developers.facebook.com/policy/" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">Meta Platform Terms</a> and the <a href="https://developers.facebook.com/policy/developer_policies" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">Meta Platform Policy</a></li>
            </ul>
          </Section>

          <Section title="6. LinkedIn Data">
            <p>
              When you connect your LinkedIn account, CooVex accesses profile and company page data only with
              your explicit OAuth authorization. We comply with <a href="https://legal.linkedin.com/api-terms-of-use" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">LinkedIn API Terms of Use</a>.
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>LinkedIn data is used only to display insights within your CooVex account</li>
              <li>You can disconnect LinkedIn at any time from CooVex Settings</li>
              <li>We do not share LinkedIn data with third parties</li>
            </ul>
          </Section>

          <Section title="7. Data Retention">
            <ul className="list-disc pl-5 space-y-2">
              <li>Account data is retained while your account is active</li>
              <li>After account deletion, data is permanently removed within 30 days</li>
              <li>Social platform data is removed when you disconnect the integration</li>
              <li>Backup copies may persist for up to 90 days after deletion</li>
            </ul>
          </Section>

          <Section title="8. Data Security">
            <p>
              We implement industry-standard security measures including:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>All data encrypted in transit (TLS 1.2+) and at rest (AES-256)</li>
              <li>API keys and credentials stored encrypted</li>
              <li>Row-level security (RLS) policies on all database tables</li>
              <li>Regular security audits</li>
            </ul>
            <p className="mt-4">
              Despite these measures, no system is 100% secure. If you discover a security issue, please contact us at {CONTACT_EMAIL}.
            </p>
          </Section>

          <Section title="9. Your Rights">
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong className="text-white">Access</strong> — request a copy of your personal data</li>
              <li><strong className="text-white">Correction</strong> — update inaccurate information</li>
              <li><strong className="text-white">Deletion</strong> — request deletion of your account and data</li>
              <li><strong className="text-white">Portability</strong> — export your data in a machine-readable format</li>
              <li><strong className="text-white">Opt-out</strong> — unsubscribe from marketing emails at any time</li>
            </ul>
            <p className="mt-4">To exercise any of these rights, email us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:underline">{CONTACT_EMAIL}</a>.</p>
          </Section>

          <Section title="10. Cookies">
            <p>CooVex uses cookies and similar technologies for:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Authentication and session management (required)</li>
              <li>User preferences (optional)</li>
            </ul>
            <p className="mt-4">We do not use advertising or tracking cookies.</p>
          </Section>

          <Section title="11. Children's Privacy">
            <p>
              CooVex is not directed to children under 13. We do not knowingly collect personal information from
              children. If you believe a child has provided us with personal data, please contact us and we will
              delete it promptly.
            </p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by email
              or by displaying a notice within the app. Continued use of CooVex after changes constitutes acceptance
              of the updated policy.
            </p>
          </Section>

          <Section title="13. Contact Us">
            <p>For privacy-related questions or requests, contact us at:</p>
            <div className="mt-4 p-5 bg-slate-900 rounded-xl border border-slate-800">
              <p className="text-white font-semibold">CooVex</p>
              <p className="mt-1">Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:underline">{CONTACT_EMAIL}</a></p>
              <p>Website: <a href={APP_URL} className="text-blue-400 hover:underline">{APP_URL}</a></p>
            </div>
          </Section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">© 2026 CooVex. All rights reserved.</p>
          <div className="flex gap-6 text-sm">
            <Link href="/privacy-policy" className="text-blue-400">Privacy Policy</Link>
            <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-white mb-4 pb-3 border-b border-slate-800">{title}</h2>
      <div className="space-y-3 text-slate-300">{children}</div>
    </section>
  )
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <div className="text-slate-300">{children}</div>
    </div>
  )
}
