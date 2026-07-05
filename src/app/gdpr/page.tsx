import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'

const LAST_UPDATED = 'June 24, 2026'

export default function GdprPage() {
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
          <h1 className="text-4xl font-bold text-white mb-3">GDPR Compliance</h1>
          <p className="text-slate-500 text-sm">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-8 text-slate-400 text-sm leading-relaxed">

          <section>
            <p>CooVex is committed to compliance with the General Data Protection Regulation (EU) 2016/679 ("GDPR") and the UK GDPR. This page explains how we apply GDPR principles and how you can exercise your rights.</p>
          </section>

          <Section title="Our Role">
            <p>When you use CooVex to manage your own business data, CooVex acts as a <strong className="text-white">data processor</strong> on your behalf and you are the <strong className="text-white">data controller</strong>.</p>
            <p className="mt-2">When CooVex collects data about you as a user (account data, usage analytics), CooVex acts as the <strong className="text-white">data controller</strong>.</p>
          </Section>

          <Section title="Lawful Basis for Processing">
            <div className="space-y-3 mt-3">
              <Row label="Account creation & service delivery" value="Contract performance (Art. 6(1)(b))" />
              <Row label="Security and fraud prevention"       value="Legitimate interests (Art. 6(1)(f))" />
              <Row label="Product analytics"                  value="Legitimate interests (Art. 6(1)(f))" />
              <Row label="Marketing emails"                   value="Consent (Art. 6(1)(a)) or Legitimate interests" />
              <Row label="Legal & tax record keeping"         value="Legal obligation (Art. 6(1)(c))" />
            </div>
          </Section>

          <Section title="Data Subject Rights">
            <p>Under GDPR, individuals whose personal data we process have the following rights. To exercise any of them, email <strong className="text-white">privacy@coovex.com</strong>. We will respond within 30 days.</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong className="text-white">Right of access (Art. 15):</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-white">Right to rectification (Art. 16):</strong> Request correction of inaccurate data.</li>
              <li><strong className="text-white">Right to erasure (Art. 17):</strong> Request deletion of your personal data where it is no longer necessary or where you withdraw consent.</li>
              <li><strong className="text-white">Right to restrict processing (Art. 18):</strong> Ask us to limit how we use your data in certain circumstances.</li>
              <li><strong className="text-white">Right to data portability (Art. 20):</strong> Receive your data in a machine-readable format.</li>
              <li><strong className="text-white">Right to object (Art. 21):</strong> Object to processing based on legitimate interests or for direct marketing at any time.</li>
              <li><strong className="text-white">Rights related to automated decisions (Art. 22):</strong> Request human review of automated decisions that significantly affect you.</li>
            </ul>
          </Section>

          <Section title="International Data Transfers">
            <p>CooVex uses infrastructure providers based in the United States and other countries. Where we transfer personal data outside the European Economic Area or UK, we rely on:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
              <li>Providers with EU-US Data Privacy Framework certification where applicable</li>
            </ul>
          </Section>

          <Section title="Data Processing Agreement (DPA)">
            <p>If you use CooVex to process personal data of your own customers or employees (e.g. via CRM features or lead management), you may require a Data Processing Agreement (DPA) with CooVex.</p>
            <p className="mt-2">Request a DPA by emailing <strong className="text-white">privacy@coovex.com</strong>. We will provide our standard DPA within 5 business days.</p>
          </Section>

          <Section title="Data Security">
            <p>We implement appropriate technical and organisational measures to protect personal data, including:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Data encrypted at rest (AES-256) and in transit (TLS 1.3)</li>
              <li>Row-level security (RLS) in our database — users can only access their own data</li>
              <li>Access controls limiting employee access to production data</li>
              <li>Regular security reviews</li>
            </ul>
          </Section>

          <Section title="Data Breach Notification">
            <p>In the event of a personal data breach that is likely to result in a risk to your rights, we will notify the relevant supervisory authority within 72 hours and affected users without undue delay, in accordance with Art. 33–34 GDPR.</p>
          </Section>

          <Section title="Data Retention">
            <p>We retain personal data only for as long as necessary. See our <Link href="/privacy" className="text-violet-400 hover:text-violet-300">Privacy Policy</Link> for specific retention periods.</p>
          </Section>

          <Section title="Supervisory Authority">
            <p>If you believe we have not handled your personal data in accordance with GDPR, you have the right to lodge a complaint with your local data protection supervisory authority.</p>
          </Section>

          <Section title="Contact">
            <p>GDPR enquiries and DPA requests: <strong className="text-white">privacy@coovex.com</strong></p>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-800/50">
      <span className="text-slate-300 flex-1">{label}</span>
      <span className="text-violet-400 text-xs text-right">{value}</span>
    </div>
  )
}
