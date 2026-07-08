import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://coovex.com'

export const metadata: Metadata = {
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  title: { default: 'CooVex — AI Business Agent', template: '%s | CooVex' },
  description: 'CooVex is your 24/7 AI Business Agent. Monitor competitors, manage reviews, generate content, score leads, and get daily AI briefings — all in one platform.',
  keywords: [
    'AI business agent', 'AI business consultant', 'business analytics', 'lead management',
    'competitor intelligence', 'review management', 'content calendar', 'AI marketing',
    'GEO optimizer', 'llms.txt generator', 'business health score', 'daily AI briefing',
    'lead scoring', 'AI proposal builder', 'white label agency',
  ],
  authors: [{ name: 'CooVex' }],
  creator: 'CooVex',
  publisher: 'CooVex',
  metadataBase: new URL(BASE),
  alternates: {
    canonical: BASE,
    types: { 'text/plain': `${BASE}/llms.txt` },
  },
  openGraph: {
    title: 'CooVex — AI Business Agent',
    description: 'Not a dashboard. Not a tool. An AI agent that monitors competitors, manages reviews, scores leads, and grows your business — 24/7.',
    type: 'website',
    url: BASE,
    siteName: 'CooVex',
    locale: 'en_US',
    images: [
      {
        url: `${BASE}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'CooVex — AI Business Agent',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CooVex — AI Business Agent',
    description: 'Your 24/7 AI Business Agent. Competitor monitoring, review management, lead scoring, content calendar — all automated.',
    creator: '@coovex',
    images: [`${BASE}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || '',
  },
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${BASE}/#organization`,
      name: 'CooVex',
      url: BASE,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE}/logo.png`,
        width: 512,
        height: 512,
      },
      description: 'AI Business Agent SaaS platform for SMBs, founders, and agencies.',
      foundingDate: '2024',
      sameAs: [
        'https://www.linkedin.com/company/coovex',
        'https://twitter.com/coovex',
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        url: `${BASE}/contact`,
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${BASE}/#software`,
      name: 'CooVex AI Business Agent',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web Browser',
      url: BASE,
      description: '24/7 AI Business Agent. Monitors competitors, manages reviews, generates content, scores leads, and delivers daily AI briefings for growing businesses.',
      featureList: [
        'Agent Inbox with real-time AI signals',
        'Daily AI business briefing email',
        'Competitor intelligence monitoring',
        'AI review response generation',
        'Lead scoring and pipeline management',
        'AI content calendar and publishing',
        'Website SEO and GEO audit',
        'llms.txt and JSON-LD generator',
        'Revenue intelligence and forecasting',
        'White-label agency portal',
      ],
      screenshot: `${BASE}/og-image.png`,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: '14-day free trial — no credit card required',
        url: `${BASE}/pricing`,
      },
      publisher: { '@id': `${BASE}/#organization` },
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE}/#website`,
      url: BASE,
      name: 'CooVex',
      description: 'AI Business Agent that monitors, analyzes, and grows your business — 24/7.',
      publisher: { '@id': `${BASE}/#organization` },
      inLanguage: 'en-US',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${BASE}/tools/website-audit?url={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <link rel="me" href={`${BASE}/about`} />
      </head>
      <body className="min-h-full bg-background text-foreground" suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" />
          <ProgressBar
            height="2px"
            color="#7c3aed"
            options={{ showSpinner: false }}
            shallowRouting
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
