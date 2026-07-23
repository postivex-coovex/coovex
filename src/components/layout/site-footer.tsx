import Link from 'next/link'
import { BrandLogo } from './brand-logo'

const COLS = [
  {
    title: 'Product',
    links: [
      { label: 'Features',     href: '/#features' },
      { label: 'Pricing',      href: '/#pricing' },
      { label: 'Free Tools',   href: '/#free-tools' },
      { label: 'Blog & Guides',href: '/blog' },
    ],
  },
  {
    title: 'Guides',
    links: [
      { label: 'Getting Started',  href: '/blog/getting-started' },
      { label: 'Website Audit',    href: '/blog/website-audit' },
      { label: 'Content Calendar', href: '/blog/content-calendar' },
      { label: 'AI Coach Chat',    href: '/blog/ai-coach' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About',                href: '/about' },
      { label: 'Agency & White Label', href: '/blog/agency-white-label' },
      { label: 'Integrations',         href: '/blog/integrations' },
      { label: 'Contact',              href: '/contact' },
    ],
  },
]

const LEGAL = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms',   href: '/terms' },
  { label: 'Cookies', href: '/cookies' },
  { label: 'GDPR',    href: '/gdpr' },
  { label: 'Imprint', href: '/imprint' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-900 py-12 px-6 bg-slate-950">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <div className="mb-4">
              <BrandLogo iconSize="h-8" textSize="text-base" />
            </div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
              AI Business Agent platform for smart entrepreneurs and agencies worldwide.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <Link href="/contact" className="text-xs text-slate-500 hover:text-white border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                Contact us
              </Link>
              <Link href="/signup" className="text-xs text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-colors font-medium">
                Start Free Trial
              </Link>
            </div>
          </div>

          {/* Link columns */}
          {COLS.map(col => (
            <div key={col.title}>
              <p className="text-white text-sm font-medium mb-4">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map(link => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-slate-500 hover:text-slate-400 text-sm transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-900 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-sm">© 2026 CooVex. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            {LEGAL.map(link => (
              <Link key={link.href} href={link.href} className="text-slate-600 hover:text-slate-500 text-xs transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
