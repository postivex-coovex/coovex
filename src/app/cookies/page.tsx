import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'

const LAST_UPDATED = 'June 24, 2026'

const COOKIES = [
  {
    category: 'Strictly Necessary',
    description: 'Required for the platform to function. Cannot be disabled.',
    examples: [
      { name: 'sb-access-token',    purpose: 'Supabase authentication session',        duration: 'Session / 1 hour' },
      { name: 'sb-refresh-token',   purpose: 'Keeps you logged in between sessions',   duration: '7 days' },
      { name: '__csrf',             purpose: 'Cross-site request forgery protection',   duration: 'Session' },
    ],
  },
  {
    category: 'Functional',
    description: 'Remember your preferences to improve your experience.',
    examples: [
      { name: 'pv_theme',           purpose: 'Stores dark/light mode preference',      duration: '1 year' },
      { name: 'pv_sidebar_open',    purpose: 'Stores sidebar collapsed state',         duration: '1 year' },
    ],
  },
  {
    category: 'Analytics',
    description: 'Help us understand how the platform is used so we can improve it. Data is anonymised.',
    examples: [
      { name: '_pv_analytics',      purpose: 'Counts page views and feature usage',    duration: '1 year' },
    ],
  },
  {
    category: 'Marketing',
    description: 'Used to measure the effectiveness of campaigns. Only set if you visit via an ad link.',
    examples: [
      { name: '_fbp',               purpose: 'Facebook pixel conversion tracking',     duration: '90 days' },
      { name: '_gcl_au',            purpose: 'Google Ads conversion tracking',         duration: '90 days' },
    ],
  },
]

export default function CookiePolicyPage() {
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
          <h1 className="text-4xl font-bold text-white mb-3">Cookie Policy</h1>
          <p className="text-slate-500 text-sm">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-8 text-slate-400 text-sm leading-relaxed">

          <section>
            <p>CooVex uses cookies and similar tracking technologies to operate the platform, remember your preferences, and understand how the service is used. This policy explains what we use and how you can control it.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">What are cookies?</h2>
            <p>Cookies are small text files stored in your browser by a website. They allow the site to remember your actions and preferences across page loads and visits.</p>
          </section>

          {COOKIES.map(group => (
            <section key={group.category}>
              <h2 className="text-white font-semibold text-base mb-1">{group.category}</h2>
              <p className="mb-4">{group.description}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left text-slate-500 py-2 pr-4 font-medium">Name</th>
                      <th className="text-left text-slate-500 py-2 pr-4 font-medium">Purpose</th>
                      <th className="text-left text-slate-500 py-2 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.examples.map(c => (
                      <tr key={c.name} className="border-b border-slate-800/50">
                        <td className="py-2 pr-4 font-mono text-slate-300">{c.name}</td>
                        <td className="py-2 pr-4">{c.purpose}</td>
                        <td className="py-2 text-slate-500">{c.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <section>
            <h2 className="text-white font-semibold text-base mb-2">How to manage cookies</h2>
            <p>You can control cookies through your browser settings. Disabling strictly necessary cookies will prevent the platform from working correctly.</p>
            <ul className="list-disc pl-5 space-y-1 mt-3">
              <li>Chrome: Settings → Privacy and Security → Cookies</li>
              <li>Firefox: Settings → Privacy & Security → Cookies and Site Data</li>
              <li>Safari: Preferences → Privacy → Manage Website Data</li>
              <li>Edge: Settings → Cookies and site permissions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">Contact</h2>
            <p>Questions about cookies: <strong className="text-white">privacy@coovex.com</strong></p>
          </section>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
