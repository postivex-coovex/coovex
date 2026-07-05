import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { template: '%s | Free Tools — CooVex', default: 'Free AI Business Tools' },
  description: 'Free AI-powered tools for business owners: Website Audit, Health Score, Content Generator, LinkedIn Analyzer, and more.',
}

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">P</span>
            </div>
            <span className="text-white font-semibold">CooVex</span>
            <span className="text-slate-600 text-sm ml-1">/ Free Tools</span>
          </Link>
          <Link
            href="/signup"
            className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Start Free Trial
          </Link>
        </div>
      </nav>

      {children}

      {/* Footer CTA */}
      <div className="border-t border-slate-900 py-12 px-6 text-center">
        <p className="text-slate-400 text-sm mb-4">
          Get all 27 AI features for your business with a 14-day free trial.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          Start Free — 14-Day Trial
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </Link>
      </div>
    </div>
  )
}
