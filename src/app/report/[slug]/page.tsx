import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface GeoChecklist { key: string; label: string; desc: string; passed: boolean; weight: number }
interface GeoData {
  geo_score: number; ai_discoverability: string; checklist: GeoChecklist[]
  missing: string[]; llms_txt_quality: string; robots_ai_allowed: boolean
}
interface PerfData {
  scores: { performance: number; seo: number; accessibility: number; best_practices: number; mobile: number }
  issues: { severity: string; category: string; title: string; description: string }[]
}
interface IntelData {
  business_name: string; description: string; industry: string; stage: string
  services: string[]; target_market: string; pricing_model: string
  who_needs_it: string[]; pain_points: string[]; missing_elements: string[]
  ai_insights: string[]; unique_value_proposition: string
  cold_email: { subject: string; body: string }
  linkedin_message: string
}

function PerfBar({ label, score }: { label: string; score: number }) {
  const color = score >= 90 ? '#16a34a' : score >= 70 ? '#ca8a04' : score >= 50 ? '#ea580c' : '#dc2626'
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 16, color: '#475569', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 20, fontWeight: 900, color }}>{score}</span>
      </div>
      <div style={{ height: 12, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  )
}

function NumberBadge({ n, color }: { n: number; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 24, height: 24, borderRadius: '50%', background: color,
      color: '#fff', fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 2,
    }}>{n}</span>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const service = createServiceClient()
  const { data } = await service.from('promotion_reports').select('domain, report_json').eq('slug', slug).single()
  if (!data) return { title: 'Report Not Found' }
  const intel = (data.report_json as { intel?: IntelData })?.intel
  return {
    title: `AI Visibility Report — ${data.domain}`,
    description: intel?.description || `See how ${data.domain} appears in AI search and what to improve.`,
  }
}

export default async function PublicReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const service = createServiceClient()

  const { data: report } = await service
    .from('promotion_reports').select('*').eq('slug', slug).single()

  if (!report) notFound()

  service.from('promotion_reports').update({ views: (report.views ?? 0) + 1 }).eq('slug', slug).then(() => {})

  const reportJson = report.report_json as { geo?: GeoData; perf?: PerfData; intel?: IntelData } | null
  const geo = reportJson?.geo
  const perf = reportJson?.perf
  const intel = reportJson?.intel
  if (!geo || !perf || !intel) notFound()

  const domain = report.domain as string
  const signupUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.coovex.com'}/signup`

  const geoColor = geo.geo_score >= 65 ? '#16a34a' : geo.geo_score >= 35 ? '#d97706' : '#dc2626'
  const passed = geo.checklist.filter(c => c.passed).length
  const total = geo.checklist.length
  const purple = '#6d28d9'
  const navy = '#0c1225'
  const maxW = 1040

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', minHeight: '100vh', background: '#f1f5f9', color: '#0f172a' }}>

      {/* ── STICKY HEADER ─────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.96)',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      }}>
        <div style={{ maxWidth: maxW, margin: '0 auto', padding: '13px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="CooVex" style={{ height: 34, objectFit: 'contain' }} />
            <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em' }}>
              <span style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Coo</span>
              <span style={{ background: 'linear-gradient(135deg, #22c55e, #84cc16)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Vex</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>AI Visibility Report · {domain}</span>
            <a href={signupUrl} style={{
              background: purple, color: '#fff', padding: '11px 26px', borderRadius: 10,
              fontSize: 14, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 2px 14px rgba(109,40,217,0.35)',
            }}>
              Claim your free audit →
            </a>
          </div>
        </div>
      </div>

      {/* ── ANNOUNCEMENT BAR ─────────────────────────── */}
      <div style={{
        background: '#4c1d95',
        borderBottom: '1px solid #6d28d9',
        padding: '12px 24px', textAlign: 'center',
      }}>
        <span style={{ fontSize: 14, color: '#fff', fontWeight: 700, letterSpacing: '0.01em' }}>
          📋 This AI Visibility Report was prepared exclusively for{' '}
          <span style={{ color: '#fde68a', fontWeight: 900 }}>{domain}</span>
          {' '}by CooVex
        </span>
      </div>

      {/* ── HERO (full-viewport dark) ─────────────────── */}
      <div style={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        background: navy,
        backgroundImage: 'radial-gradient(rgba(109,40,217,0.18) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        padding: '72px 24px 64px',
        position: 'relative',
      }}>
        {/* Top gradient glow */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 300,
          background: 'radial-gradient(ellipse at top, rgba(109,40,217,0.35) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>

          {/* Badge */}
          <div style={{ marginBottom: 32 }}>
            <span style={{
              display: 'inline-block',
              background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.35)',
              color: '#a78bfa', fontSize: 11, fontWeight: 800, letterSpacing: '0.14em',
              padding: '8px 24px', borderRadius: 99,
            }}>
              ✦ &nbsp;AI VISIBILITY AUDIT · POWERED BY COOVEX&nbsp; ✦
            </span>
          </div>

          {/* Main headline */}
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: '#94a3b8',
            margin: '0 0 10px', letterSpacing: '0.01em',
          }}>
            We analyzed
          </h1>
          <div style={{
            fontSize: 72, fontWeight: 900, lineHeight: 1.0,
            letterSpacing: '-0.04em', margin: '0 0 28px',
            background: 'linear-gradient(135deg, #f1f5f9 30%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {domain}
          </div>
          <p style={{
            fontSize: 20, color: '#64748b', maxWidth: 560,
            margin: '0 auto 56px', lineHeight: 1.65,
          }}>
            Here&apos;s what we found — and why it matters for your growth.
          </p>

          {/* Big score centerpiece */}
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.04)',
            border: `2px solid ${geoColor}50`,
            borderRadius: 28, padding: '36px 56px', marginBottom: 40,
            boxShadow: `0 0 60px ${geoColor}20`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: '#475569', marginBottom: 12 }}>
              AI VISIBILITY SCORE
            </div>
            <div style={{
              fontSize: 100, fontWeight: 900, color: geoColor,
              lineHeight: 1, letterSpacing: '-0.05em',
            }}>
              {geo.geo_score}
            </div>
            <div style={{ fontSize: 18, color: '#475569', fontWeight: 600, marginTop: 4 }}>/100</div>
            <div style={{
              marginTop: 16, fontSize: 15, fontWeight: 800, color: geoColor,
              background: `${geoColor}15`, border: `1px solid ${geoColor}30`,
              padding: '8px 20px', borderRadius: 99, display: 'inline-block',
            }}>
              {geo.ai_discoverability === 'high' ? '✓ AI Ready' : geo.ai_discoverability === 'medium' ? '⚠ Partially Visible to AI' : '✕ Not Visible to AI'}
            </div>
          </div>

          {/* 3 chips */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 52 }}>
            {[
              { icon: '🔍', label: `${total} signals analyzed` },
              { icon: '⚠', label: `${total - passed} gaps identified` },
              { icon: '📊', label: `SEO score: ${perf.scores.seo}/100` },
            ].map(chip => (
              <div key={chip.label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 99, padding: '10px 20px',
                fontSize: 14, color: '#94a3b8', fontWeight: 600,
              }}>
                <span>{chip.icon}</span> {chip.label}
              </div>
            ))}
          </div>

          {/* Scroll CTA */}
          <a href="#report-body" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: '#6366f1', fontSize: 14, fontWeight: 700,
            textDecoration: 'none', letterSpacing: '0.04em',
          }}>
            VIEW FULL REPORT &nbsp;↓
          </a>
        </div>
      </div>

      {/* Anchor for scroll */}
      <div id="report-body" />

      {/* ── SECTION: BUSINESS PROFILE (white) ────────── */}
      <div style={{ background: '#fff', padding: '80px 24px' }}>
        <div style={{ maxWidth: maxW, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: purple, marginBottom: 12 }}>BUSINESS INTELLIGENCE</div>
          <h2 style={{ fontSize: 42, fontWeight: 900, margin: '0 0 44px', letterSpacing: '-0.025em', color: '#0f172a', lineHeight: 1.15 }}>
            Here&apos;s what we learned<br />about your business
          </h2>

          {/* UVP quote */}
          <div style={{
            borderLeft: `5px solid ${purple}`, padding: '24px 32px',
            background: `linear-gradient(90deg, ${purple}06, transparent)`,
            borderRadius: '0 14px 14px 0', marginBottom: 44,
          }}>
            <p style={{ fontSize: 22, color: '#1e1b4b', lineHeight: 1.65, margin: 0, fontStyle: 'italic', fontWeight: 500 }}>
              &ldquo;{intel.unique_value_proposition}&rdquo;
            </p>
          </div>

          {/* 3-col info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 28 }}>

            {/* Services */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 16 }}>CORE SERVICES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {intel.services.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    fontSize: 15, color: '#334155', padding: '12px 16px',
                    background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0',
                  }}>
                    <span style={{ color: purple, fontWeight: 800, fontSize: 16 }}>✓</span> {s}
                  </div>
                ))}
              </div>
            </div>

            {/* Col 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'INDUSTRY', value: intel.industry },
                { label: 'COMPANY STAGE', value: intel.stage },
              ].map(item => (
                <div key={item.label} style={{ padding: '20px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 8 }}>{item.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Col 3 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'TARGET MARKET', value: intel.target_market },
                { label: 'PRICING MODEL', value: intel.pricing_model },
              ].map(item => (
                <div key={item.label} style={{ padding: '20px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 8 }}>{item.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#334155', textTransform: 'capitalize', lineHeight: 1.4 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION: AI READINESS (light slate) ──────── */}
      <div style={{ background: '#f8fafc', padding: '80px 24px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: maxW, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: geoColor, marginBottom: 12 }}>AI DISCOVERABILITY</div>

          {/* Score + headline row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 40, marginBottom: 52, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <h2 style={{ fontSize: 42, fontWeight: 900, margin: '0 0 16px', letterSpacing: '-0.025em', color: '#0f172a', lineHeight: 1.15 }}>
                AI Search Visibility:<br />
                <span style={{ color: geoColor }}>{geo.geo_score} / 100</span>
              </h2>
              <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.7, margin: 0, maxWidth: 480 }}>
                This score measures how visible your website is to AI models like ChatGPT, Claude, and Perplexity.
                A low score means AI tools can&apos;t find or understand your business — you&apos;re invisible to the fastest-growing search channel.
              </p>
            </div>
            <div style={{
              background: geo.ai_discoverability === 'high' ? '#f0fdf4' : geo.ai_discoverability === 'medium' ? '#fffbeb' : '#fef2f2',
              border: `2px solid ${geoColor}35`, borderRadius: 24,
              padding: '28px 36px', textAlign: 'center', flexShrink: 0,
            }}>
              <div style={{ fontSize: 72, fontWeight: 900, color: geoColor, lineHeight: 1, letterSpacing: '-0.04em' }}>{geo.geo_score}</div>
              <div style={{ fontSize: 16, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>/100</div>
              <div style={{ marginTop: 12, fontSize: 15, color: geoColor, fontWeight: 800 }}>
                {geo.ai_discoverability === 'high' ? '✓ AI Ready' : geo.ai_discoverability === 'medium' ? '⚠ Partially Visible' : '✕ Not Visible to AI'}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{passed}/{total} checks passed</div>
            </div>
          </div>

          {/* Checklist grid — 3 cols */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {geo.checklist.map(item => (
              <div key={item.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px', borderRadius: 16,
                background: item.passed ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${item.passed ? '#bbf7d0' : '#fecaca'}`,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{item.passed ? '✅' : '❌'}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: item.passed ? '#15803d' : '#dc2626', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.45 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {!geo.robots_ai_allowed && (
            <div style={{
              marginTop: 16, padding: '14px 20px', borderRadius: 12,
              background: '#fffbeb', border: '1px solid #fde68a',
              fontSize: 14, color: '#92400e', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>⚠</span>
              <span>robots.txt found but AI crawlers (GPTBot, ClaudeBot, PerplexityBot) are not explicitly allowed — they may skip your site.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION: PERFORMANCE (white) ─────────────── */}
      <div style={{ background: '#fff', padding: '80px 24px' }}>
        <div style={{ maxWidth: maxW, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#2563eb', marginBottom: 12 }}>TECHNICAL PERFORMANCE</div>
          <h2 style={{ fontSize: 42, fontWeight: 900, margin: '0 0 52px', letterSpacing: '-0.025em', color: '#0f172a', lineHeight: 1.15 }}>
            How your site performs
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56 }}>
            {/* Score bars */}
            <div>
              <PerfBar label="SEO" score={perf.scores.seo} />
              <PerfBar label="Performance" score={perf.scores.performance} />
              <PerfBar label="Mobile" score={perf.scores.mobile} />
              <PerfBar label="Accessibility" score={perf.scores.accessibility} />
            </div>

            {/* Issues */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 20 }}>ISSUES FOUND</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {perf.issues.map((issue, i) => {
                  const bg     = issue.severity === 'critical' ? '#fef2f2' : issue.severity === 'warning' ? '#fffbeb' : '#eff6ff'
                  const bdr    = issue.severity === 'critical' ? '#fecaca' : issue.severity === 'warning' ? '#fde68a' : '#bfdbfe'
                  const clr    = issue.severity === 'critical' ? '#dc2626' : issue.severity === 'warning' ? '#d97706' : '#2563eb'
                  const icon   = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : 'ℹ️'
                  return (
                    <div key={i} style={{ padding: '16px 20px', borderRadius: 14, background: bg, border: `1px solid ${bdr}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{icon}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: clr }}>{issue.title}</span>
                      </div>
                      <p style={{ fontSize: 14, color: '#475569', margin: 0, lineHeight: 1.6 }}>{issue.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION: GROWTH GAPS (amber) ──────────────── */}
      {(intel.missing_elements.length > 0 || intel.ai_insights.length > 0) && (
        <div style={{ background: '#fffbeb', padding: '80px 24px', borderTop: '1px solid #fde68a', borderBottom: '1px solid #fde68a' }}>
          <div style={{ maxWidth: maxW, margin: '0 auto' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#d97706', marginBottom: 12 }}>GROWTH GAPS</div>
            <h2 style={{ fontSize: 42, fontWeight: 900, margin: '0 0 52px', letterSpacing: '-0.025em', color: '#0f172a', lineHeight: 1.15 }}>
              What&apos;s missing from<br />your website
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
              {intel.missing_elements.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#92400e', marginBottom: 20 }}>MISSING PAGES &amp; CONTENT</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {intel.missing_elements.map((m, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px',
                        background: '#fff', borderRadius: 12, border: '1px solid #fde68a',
                      }}>
                        <span style={{ color: '#d97706', fontSize: 20, flexShrink: 0, marginTop: 1 }}>⚠</span>
                        <span style={{ fontSize: 15, color: '#78350f', fontWeight: 500, lineHeight: 1.5 }}>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {intel.ai_insights.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#92400e', marginBottom: 20 }}>AI-POWERED INSIGHTS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {intel.ai_insights.map((insight, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: '#d97706', color: '#fff', fontSize: 13, fontWeight: 800,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
                        }}>{i + 1}</span>
                        <span style={{ fontSize: 15, color: '#713f12', lineHeight: 1.7 }}>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION: ICP (white) ──────────────────────── */}
      <div style={{ background: '#fff', padding: '80px 24px' }}>
        <div style={{ maxWidth: maxW, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: purple, marginBottom: 12 }}>MARKET INTELLIGENCE</div>
          <h2 style={{ fontSize: 42, fontWeight: 900, margin: '0 0 52px', letterSpacing: '-0.025em', color: '#0f172a', lineHeight: 1.15 }}>
            Your ideal customer profile
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* WHO NEEDS IT */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 22, padding: '36px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1d4ed8', marginBottom: 24, letterSpacing: '0.03em' }}>
                👤 WHO NEEDS YOUR PRODUCT
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {intel.who_needs_it.map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <NumberBadge n={i + 1} color="#1d4ed8" />
                    <span style={{ fontSize: 15, color: '#1e40af', lineHeight: 1.6, fontWeight: 500 }}>{w}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PAIN POINTS */}
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 22, padding: '36px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626', marginBottom: 24, letterSpacing: '0.03em' }}>
                🔥 WHY THEY URGENTLY NEED IT
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {intel.pain_points.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <NumberBadge n={i + 1} color="#dc2626" />
                    <span style={{ fontSize: 15, color: '#991b1b', lineHeight: 1.6, fontWeight: 500 }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA (dark gradient) ───────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${purple} 0%, #4338ca 50%, #1e1b4b 100%)`,
        padding: '96px 24px',
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
            READY TO FIX THIS?
          </div>
          <h2 style={{ fontSize: 52, fontWeight: 900, color: '#fff', margin: '0 0 18px', letterSpacing: '-0.03em', lineHeight: 1.08 }}>
            Get your full AI audit —<br />free
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.68)', maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.7 }}>
            CooVex scans your website, checks if AI mentions you today, and gives you a step-by-step fix plan. Start in minutes.
          </p>
          <a href={signupUrl} style={{
            display: 'inline-block', background: '#fff', color: purple,
            padding: '20px 52px', borderRadius: 16, fontSize: 18, fontWeight: 800,
            textDecoration: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
            letterSpacing: '-0.01em',
          }}>
            Claim your free audit →
          </a>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 20 }}>
            14-day free trial · No credit card required
          </p>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────── */}
      <div style={{ background: navy, padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: '#334155', margin: 0 }}>
          Report generated by{' '}
          <a href="https://coovex.com" style={{ color: '#a78bfa', textDecoration: 'none', fontWeight: 600 }}>CooVex</a>
          {' '}— AI Business Agent for SaaS founders &amp; agencies
        </p>
      </div>
    </div>
  )
}
