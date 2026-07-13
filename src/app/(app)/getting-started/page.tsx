import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Getting Started — CooVex' }

const STEPS = [
  {
    id: 'setup',
    icon: '🏢',
    title: 'Set up your business',
    desc: 'Add your business name, website URL, and industry so CooVex AI knows who you are.',
    detail: 'CooVex personalizes every feature — leads, content, audits, and reports — based on your business profile.',
    link: '/settings',
    linkLabel: 'Edit Business Profile',
    doneKey: 'hasBusiness' as const,
    alwaysUnlocked: true,
  },
  {
    id: 'audit',
    icon: '🔍',
    title: 'Run Website Audit',
    desc: 'AI scans your website for SEO, GEO, performance, and AI discoverability issues.',
    detail: 'The audit is the foundation — it tells CooVex your current health score, GEO gaps, and what to improve. It costs 10 credits and takes ~30 seconds.',
    link: '/audit',
    linkLabel: 'Run Audit Now',
    doneKey: 'hasAudit' as const,
    alwaysUnlocked: true,
  },
  {
    id: 'gtm',
    icon: '🚀',
    title: 'Run GTM Autopilot',
    desc: 'One click — AI finds leads, checks your Gemini AI visibility, and generates your weekly action plan.',
    detail: 'GTM Autopilot is your main AI agent. It automatically detects which platforms you\'re listed on, finds real company leads for your ICP, and gives you 3 prioritized GTM tasks. Costs 30 credits.',
    link: '/gtm-agent',
    linkLabel: 'Run GTM Autopilot',
    doneKey: 'hasGtm' as const,
    alwaysUnlocked: false,
  },
  {
    id: 'geo',
    icon: '🧠',
    title: 'Run GEO Optimizer',
    desc: 'Check how visible you are in AI search (Gemini, ChatGPT, Perplexity) and find content gaps.',
    detail: 'GEO stands for Generative Engine Optimization. Unlike SEO, GEO makes sure AI models like Gemini and ChatGPT mention your business when people ask relevant questions. Run this to see your AI visibility score.',
    link: '/geo',
    linkLabel: 'Open GEO Optimizer',
    doneKey: 'hasGeo' as const,
    alwaysUnlocked: false,
  },
  {
    id: 'leads',
    icon: '👥',
    title: 'Build your lead pipeline',
    desc: 'AI Lead Finder discovers real companies that match your ICP and adds them to your pipeline.',
    detail: 'Your pipeline shows hot leads (score ≥ 70), allows you to track stages (New → Contacted → Qualified → Won), and integrates with email campaigns. GTM Autopilot also auto-adds leads here.',
    link: '/leads',
    linkLabel: 'View Leads',
    doneKey: 'hasLeads' as const,
    alwaysUnlocked: false,
  },
  {
    id: 'competitors',
    icon: '🕵️',
    title: 'Track competitors',
    desc: 'AI monitors competitor websites, pricing, and content changes — then alerts you.',
    detail: 'Add 1–3 main competitors. CooVex scans them daily and sends you signals when something changes (new pricing, new features, new content). You get competitive intelligence without manual research.',
    link: '/competitors',
    linkLabel: 'Add Competitors',
    doneKey: 'hasCompetitors' as const,
    alwaysUnlocked: false,
  },
  {
    id: 'content',
    icon: '✍️',
    title: 'Create AI content',
    desc: 'Generate blog posts, social posts, and GEO-optimized articles that rank in AI search.',
    detail: 'Content Generator uses your audit data, GEO gaps, and ICP to create content that\'s optimized for AI search engines. The Content Ideas page (GEO Optimizer) shows exactly which topics will improve your Gemini visibility.',
    link: '/content',
    linkLabel: 'Create Content',
    doneKey: 'hasContent' as const,
    alwaysUnlocked: false,
  },
  {
    id: 'platform',
    icon: '🚢',
    title: 'Launch on key platforms',
    desc: 'Product Hunt, Indie Hackers, G2, Capterra, LinkedIn — GTM auto-detects where you\'re listed.',
    detail: 'Platform presence boosts SEO authority, generates backlinks, and drives early adopters. GTM Autopilot auto-detects which platforms already list your product. For the rest, click to launch from the GTM dashboard.',
    link: '/gtm-agent',
    linkLabel: 'View Platform Tracker',
    doneKey: 'hasPlatform' as const,
    alwaysUnlocked: false,
  },
]

const FEATURE_MAP = [
  { section: 'Setup', items: [
    { icon: '🔍', name: 'Website Audit', href: '/audit', what: 'Health score, SEO, GEO, performance — 10 credits' },
    { icon: '🧠', name: 'GEO Optimizer', href: '/geo', what: 'AI search visibility, Gemini/ChatGPT checks, content gaps' },
    { icon: '🎯', name: 'Goals', href: '/goals', what: 'Set business targets — AI tracks and adjusts recommendations' },
    { icon: '📦', name: 'Products', href: '/products', what: 'Add your products/services so AI can personalize everything' },
  ]},
  { section: 'Growth', items: [
    { icon: '🚀', name: 'GTM Autopilot', href: '/gtm-agent', what: 'Full go-to-market sweep — leads + GEO + action plan in one click' },
    { icon: '👥', name: 'Leads', href: '/leads', what: 'Pipeline: New → Contacted → Qualified → Won. AI-scored.' },
    { icon: '❄️', name: 'Cold Leads', href: '/leads/cold', what: 'Find cold outreach targets from keyword + location search' },
    { icon: '📧', name: 'Campaigns', href: '/campaigns', what: 'Email campaigns — connect your SMTP, AI writes the copy' },
  ]},
  { section: 'Intelligence', items: [
    { icon: '🕵️', name: 'Competitors', href: '/competitors', what: 'Monitor rivals daily — pricing, content, feature changes' },
    { icon: '📈', name: 'Trends', href: '/trends', what: 'Industry keyword trends, search volume, and topic ideas' },
    { icon: '📊', name: 'Analytics', href: '/analytics', what: 'Traffic, conversions, lead attribution — connect GA4' },
  ]},
  { section: 'Engagement', items: [
    { icon: '✍️', name: 'Content', href: '/content', what: 'Draft and schedule blog posts, LinkedIn posts, newsletters' },
    { icon: '💡', name: 'GEO Ideas', href: '/content/ideas', what: 'AI-generated content ideas from your GEO gaps' },
    { icon: '⭐', name: 'Reviews', href: '/reviews', what: 'Monitor Google/Trustpilot reviews, AI writes responses' },
  ]},
  { section: 'AI Agents', items: [
    { icon: '🤖', name: 'Agent Inbox', href: '/agent/inbox', what: 'All AI signals — opportunities, warnings, completed tasks' },
    { icon: '📋', name: 'Progress Report', href: '/agent/report', what: 'Weekly/monthly comparison: what improved, what CooVex did' },
    { icon: '💬', name: 'AI Coach', href: '/chat', what: 'Chat with your business AI — ask anything, get instant analysis' },
  ]},
]

export default async function GettingStartedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = profile?.current_workspace_id
    ? await supabase.from('businesses').select('id, name, website_url').eq('workspace_id', profile.current_workspace_id).maybeSingle()
    : { data: null }

  if (!business) redirect('/dashboard')

  const service = createServiceClient()

  const [
    { count: auditCount },
    { count: leadCount },
    { count: competitorCount },
    { count: postCount },
    { data: gtmMem },
    { data: geoMem },
    { data: launchPlatforms },
  ] = await Promise.all([
    supabase.from('audits').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('competitors').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
    service.from('agent_memory').select('value_text').eq('business_id', business.id).eq('key', 'gtm_last_run').maybeSingle(),
    service.from('agent_memory').select('value_text').eq('business_id', business.id).eq('key', 'geo_intelligence').maybeSingle(),
    supabase.from('launch_tracker_platforms').select('status').eq('business_id', business.id).in('status', ['done', 'live']),
  ])

  const completedMap: Record<string, boolean> = {
    hasBusiness:    !!(business.name && business.website_url),
    hasAudit:       (auditCount ?? 0) > 0,
    hasGtm:         !!gtmMem?.value_text,
    hasGeo:         !!geoMem?.value_text,
    hasLeads:       (leadCount ?? 0) > 0,
    hasCompetitors: (competitorCount ?? 0) > 0,
    hasContent:     (postCount ?? 0) > 0,
    hasPlatform:    (launchPlatforms?.length ?? 0) > 0,
  }

  const steps = STEPS.map(s => ({ ...s, done: completedMap[s.doneKey] ?? false }))
  const doneCount = steps.filter(s => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)
  const nextStep = steps.find(s => !s.done)

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Getting Started with CooVex</h1>
        <p className="text-slate-400 text-sm">Follow these steps to get the most out of your AI business agent.</p>
      </div>

      {/* Progress */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Setup Progress</p>
            <p className="text-2xl font-bold text-white mt-0.5">{pct}% <span className="text-sm font-normal text-slate-500">complete</span></p>
          </div>
          <p className="text-xs text-slate-500">{doneCount}/{steps.length} steps done</p>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct >= 75 ? '#10b981' : pct >= 40 ? '#8b5cf6' : '#f59e0b' }}
          />
        </div>
      </div>

      {/* Next Step Banner */}
      {nextStep && (
        <div className="bg-violet-950/30 border border-violet-700/40 rounded-2xl p-5">
          <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider mb-2">Your next step</p>
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{nextStep.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-white mb-0.5">{nextStep.title}</p>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">{nextStep.detail}</p>
              <Link
                href={nextStep.link}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {nextStep.linkLabel} →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Checklist */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Setup Checklist</h2>
        </div>
        <div className="divide-y divide-slate-800/50">
          {steps.map((step, i) => {
            const locked = !step.alwaysUnlocked && !completedMap.hasAudit && !step.done
            return (
              <div key={step.id} className={`flex items-start gap-4 px-5 py-4 ${step.done ? 'opacity-70' : ''}`}>
                {/* Step number / check */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${step.done ? 'bg-emerald-500 text-white' : locked ? 'bg-slate-800 text-slate-600' : 'bg-violet-600/20 text-violet-400 border border-violet-600/30'}`}>
                  {step.done ? '✓' : locked ? '🔒' : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-base">{step.icon}</span>
                    <p className={`text-sm font-semibold ${step.done ? 'text-slate-400 line-through decoration-slate-600' : 'text-white'}`}>{step.title}</p>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
                {!step.done && !locked && (
                  <Link
                    href={step.link}
                    className="flex-shrink-0 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {step.linkLabel}
                  </Link>
                )}
                {step.done && (
                  <span className="flex-shrink-0 text-xs text-emerald-400 font-medium">Done ✓</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Feature Map */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">All CooVex Features</h2>
        <div className="space-y-4">
          {FEATURE_MAP.map(section => (
            <div key={section.section} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-800/50 border-b border-slate-800">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{section.section}</p>
              </div>
              <div className="divide-y divide-slate-800/30">
                {section.items.map(item => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors group"
                  >
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-300 group-hover:text-white">{item.name}</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{item.what}</p>
                    </div>
                    <span className="text-slate-700 group-hover:text-slate-400 text-xs flex-shrink-0">→</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
