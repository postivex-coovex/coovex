import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'

export default function ImprintPage() {
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
          <h1 className="text-4xl font-bold text-white mb-2">Imprint</h1>
          <p className="text-slate-500 text-sm">Mandatory disclosure pursuant to § 5 TMG (Germany) and similar regulations.</p>
        </div>

        <div className="space-y-8 text-slate-400 text-sm leading-relaxed">

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <Row label="Company"         value="CooVex" />
            <Row label="Legal form"      value="Private limited company" />
            <Row label="Registered"      value="2024" />
            <Row label="Business type"   value="AI-powered business intelligence software (SaaS)" />
            <Divider />
            <Row label="Registered address"  value="[Update with your registered company address]" />
            <Row label="City"            value="[City, Country, Postal Code]" />
            <Divider />
            <Row label="General contact" value="hello@coovex.com" />
            <Row label="Support"         value="support@coovex.com" />
            <Row label="Legal / Privacy" value="privacy@coovex.com" />
          </div>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">Responsible for content</h2>
            <p>The person responsible for the content of this website in accordance with § 55 para. 2 RStV is the CEO of CooVex. Contact via the email addresses above.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">Dispute resolution</h2>
            <p>The European Commission provides a platform for online dispute resolution (ODR): <strong className="text-white">https://ec.europa.eu/consumers/odr</strong></p>
            <p className="mt-2">We are not obliged and not willing to participate in dispute resolution proceedings before a consumer arbitration board.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">Liability for content</h2>
            <p>As a service provider, we are responsible for our own content on these pages in accordance with general laws. However, we are not obligated to monitor transmitted or stored third-party information or to investigate circumstances that indicate illegal activity.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">Liability for links</h2>
            <p>Our website contains links to external third-party websites. We have no influence over the content of those sites and therefore cannot accept any liability for that content. The respective provider or operator of the linked pages is always responsible for the content of the linked pages.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">Copyright</h2>
            <p>The content and works created on this website by the site operators are subject to copyright law. Duplication, processing, distribution, or any form of commercialisation of such material beyond the scope of copyright law requires the prior written consent of CooVex.</p>
          </section>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-slate-500 w-40 flex-shrink-0">{label}</span>
      <span className="text-slate-300">{value}</span>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-slate-800" />
}
