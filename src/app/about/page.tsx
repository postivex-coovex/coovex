import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

type Stat      = { label: string; value: string }
type Value     = { icon: string; title: string; description: string }
type Member    = { name: string; role: string; bio: string; avatar: string }
type Milestone = { year: string; event: string }

type AboutData = {
  hero: { badge: string; title: string; subtitle: string }
  story: string
  mission: string
  vision: string
  stats: Stat[]
  values: Value[]
  team: Member[]
  milestones: Milestone[]
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getAbout(): Promise<AboutData | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('site_content')
    .select('value')
    .eq('key', 'about')
    .maybeSingle()
  return (data?.value as AboutData) ?? null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AboutPage() {
  const about = await getAbout()

  if (!about) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-500">About page content not found. Run migration 006_site_content.sql in Supabase.</p>
      </div>
    )
  }

  const { hero, story, mission, vision, stats, values, team, milestones } = about

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Nav */}
      <nav className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-white font-bold text-lg tracking-tight">
            ⚡ CooVex
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/blog" className="text-slate-400 hover:text-white transition-colors">Guides</Link>
            <Link href="/login" className="text-slate-400 hover:text-white transition-colors">Login</Link>
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-block bg-violet-900/30 border border-violet-700/40 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          {hero.badge || 'Our Mission'}
        </div>
        <h1 className="text-5xl font-bold text-white leading-tight mb-6">
          {hero.title || 'Building the future of AI business intelligence'}
        </h1>
        <p className="text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
          {hero.subtitle}
        </p>
      </section>

      {/* Stats */}
      {stats.length > 0 && (
        <section className="border-y border-slate-800/60 bg-slate-900/40">
          <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((s, i) => (
              <div key={i}>
                <div className="text-3xl font-bold text-violet-400 mb-1">{s.value}</div>
                <div className="text-sm text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Story */}
      {story && (
        <section className="max-w-3xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-violet-600/20 border border-violet-600/40 rounded-lg flex items-center justify-center text-violet-400 text-sm">📖</div>
            <h2 className="text-2xl font-bold text-white">Our Story</h2>
          </div>
          <div className="text-slate-400 leading-relaxed text-base whitespace-pre-line">
            {story}
          </div>
        </section>
      )}

      {/* Mission / Vision */}
      {(mission || vision) && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <div className="grid md:grid-cols-2 gap-6">
            {mission && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="text-violet-400 text-2xl mb-3">🎯</div>
                <h3 className="text-white font-semibold mb-2">Mission</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{mission}</p>
              </div>
            )}
            {vision && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="text-violet-400 text-2xl mb-3">🔭</div>
                <h3 className="text-white font-semibold mb-2">Vision</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{vision}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Values */}
      {values.length > 0 && (
        <section className="bg-slate-900/40 border-y border-slate-800/60">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-white text-center mb-12">What we stand for</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {values.map((v, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <div className="text-3xl mb-3">{v.icon}</div>
                  <h3 className="text-white font-semibold mb-2">{v.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{v.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Team */}
      {team.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-white text-center mb-12">The team behind CooVex</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {team.map((m, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
                <div className="w-16 h-16 bg-violet-600/20 border border-violet-600/40 rounded-full flex items-center justify-center text-violet-300 font-bold text-lg mx-auto mb-4">
                  {m.avatar}
                </div>
                <h3 className="text-white font-semibold">{m.name}</h3>
                <p className="text-violet-400 text-xs font-medium mt-0.5 mb-3">{m.role}</p>
                <p className="text-slate-400 text-sm leading-relaxed">{m.bio}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <section className="bg-slate-900/40 border-y border-slate-800/60">
          <div className="max-w-3xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-white text-center mb-12">Our journey</h2>
            <div className="relative pl-6 border-l border-slate-800">
              {milestones.map((ms, i) => (
                <div key={i} className="mb-8 last:mb-0 relative">
                  <div className="absolute -left-[29px] top-1 w-4 h-4 bg-violet-600 border-2 border-slate-950 rounded-full" />
                  <div className="text-violet-400 text-xs font-bold mb-1 tracking-wide">{ms.year}</div>
                  <div className="text-slate-300 text-sm leading-relaxed">{ms.event}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to join us?</h2>
        <p className="text-slate-400 mb-8">Give your business its own AI agent — free for 14 days.</p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors">
            Start Free Trial
          </Link>
          <Link href="/blog" className="border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white px-8 py-3 rounded-xl transition-colors">
            Read the Guides
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
