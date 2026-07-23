'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, Clock, Send, Printer, X } from 'lucide-react'

interface ReportTemplate {
  id: string
  name: string
  description: string
  icon: string
  sections: string[]
  schedule: 'none' | 'weekly' | 'monthly'
  lastGenerated?: string
}

interface ComparisonMetric {
  label: string
  prev: number
  curr: number
  unit: string
  isRevenue?: boolean
  isFloat?: boolean
  noCompare?: boolean
  change: number | null
  trend: 'up' | 'down' | 'flat'
}

interface ReportPayload {
  title: string
  business_name: string
  generated_at: string
  period: { this_month: string; last_month: string }
  metrics: ComparisonMetric[]
  ai: {
    executive_summary: string
    winning: string
    needs_attention: string
    next_actions: string
  }
  data: {
    top_deals: { title: string; value: number; stage: string }[]
    recent_posts: { title: string; status: string; created_at: string }[]
    competitors: { name: string; status: string; notes: string }[]
    goals: unknown[]
    website_metrics: unknown
    open_deals_count: number
  }
}

const TEMPLATES: ReportTemplate[] = [
  {
    id: 'compare-improvement',
    name: 'Performance Comparison',
    description: 'Last month vs this month — see exactly where you improved and where you fell behind.',
    icon: '📈',
    sections: ['Executive Summary', 'Metric-by-Metric Comparison', 'What Improved', 'Needs Attention', 'Next Actions'],
    schedule: 'monthly',
  },
  {
    id: 'monthly-review',
    name: 'Monthly Business Review',
    description: 'Full performance overview — leads, revenue pipeline, content, reviews, health score.',
    icon: '📊',
    sections: ['Executive Summary', 'Health Score Trend', 'Lead Pipeline', 'Revenue Attribution', 'Content Performance', 'Review Summary', 'Next Month Targets'],
    schedule: 'monthly',
    lastGenerated: '2026-06-01',
  },
  {
    id: 'pipeline-summary',
    name: 'Pipeline Summary',
    description: 'Current deal pipeline, stage breakdown, weighted forecast, stale deals.',
    icon: '💼',
    sections: ['Pipeline Overview', 'Stage Breakdown', 'Weighted Forecast', 'Top Opportunities', 'Stale Deals Alert'],
    schedule: 'weekly',
  },
  {
    id: 'content-performance',
    name: 'Content Performance',
    description: 'Post reach, engagement trends, best performing content, upcoming schedule.',
    icon: '✍️',
    sections: ['Post Volume', 'Top Performing Posts', 'Channel Breakdown', 'Engagement Trend', 'Upcoming Content'],
    schedule: 'weekly',
    lastGenerated: '2026-06-10',
  },
  {
    id: 'nps-report',
    name: 'NPS & Review Report',
    description: 'Net Promoter Score, review sentiment, Google review performance.',
    icon: '⭐',
    sections: ['NPS Score', 'Promoter / Detractor Breakdown', 'Recent Reviews', 'Sentiment Trend', 'Action Items'],
    schedule: 'monthly',
  },
  {
    id: 'competitor-intel',
    name: 'Competitor Intelligence',
    description: 'Competitor activity feed, positioning comparison, market signals.',
    icon: '🎯',
    sections: ['Competitor Activity Summary', 'Positioning Matrix', 'Market Signals', 'Recommended Actions'],
    schedule: 'none',
  },
  {
    id: 'client-report',
    name: 'Client Portal Report',
    description: 'White-labeled summary for sharing with clients via the portal or email.',
    icon: '🏢',
    sections: ['Business Health', 'Key Metrics', 'Lead Performance', 'Content Activity', 'Recommendations'],
    schedule: 'monthly',
  },
]

const SCHEDULE_LABELS: Record<ReportTemplate['schedule'], string> = {
  none: 'On demand',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmt(value: number, unit: string, isFloat?: boolean, isRevenue?: boolean): string {
  if (isRevenue) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000)     return `$${(value / 1_000).toFixed(1)}k`
    return `$${value.toLocaleString()}`
  }
  if (isFloat) return `${value.toFixed(1)}${unit}`
  return `${value.toLocaleString()}${unit}`
}

function trendArrow(t: 'up' | 'down' | 'flat'): string {
  if (t === 'up')   return '↑'
  if (t === 'down') return '↓'
  return '–'
}


function starsBar(rating: number): string {
  const pct = Math.round((rating / 5) * 100)
  return `<div style="display:flex;align-items:center;gap:8px;">
    <div style="flex:1;height:8px;background:#1e293b;border-radius:4px;overflow:hidden;">
      <div style="width:${pct}%;height:100%;background:#64748b;border-radius:4px;"></div>
    </div>
    <span style="font-size:12px;color:#64748b;font-weight:600;">${rating.toFixed(1)}★</span>
  </div>`
}

function metricCardsHtml(metrics: ComparisonMetric[], period: ReportPayload['period']): string {
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:32px;">
    ${metrics.map(m => {
      const currFmt = fmt(m.curr, m.unit, m.isFloat, m.isRevenue)
      const prevFmt = m.noCompare ? '' : fmt(m.prev, m.unit, m.isFloat, m.isRevenue)
      const color   = m.trend === 'up' ? '#2563eb' : m.trend === 'down' ? '#ef4444' : '#64748b'
      const arrow   = trendArrow(m.trend)
      const badge   = m.change !== null
        ? `<span style="font-size:11px;font-weight:600;color:${color};">${arrow} ${m.change >= 0 ? '+' : ''}${m.change}%</span>`
        : ''
      return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">${m.label}</p>
        <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">${currFmt}</p>
        ${m.noCompare ? '' : `<p style="margin:0;font-size:11px;color:#94a3b8;">vs ${prevFmt} (${period.last_month}) ${badge}</p>`}
        ${m.noCompare ? badge : ''}
      </div>`
    }).join('')}
  </div>`
}

function dealsTableHtml(deals: ReportPayload['data']['top_deals']): string {
  if (!deals.length) return '<p style="color:#64748b;font-size:13px;">No open deals found.</p>'
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="border-bottom:2px solid #e2e8f0;">
        <th style="text-align:left;padding:8px 4px;color:#64748b;font-weight:600;">Deal</th>
        <th style="text-align:right;padding:8px 4px;color:#64748b;font-weight:600;">Value</th>
        <th style="text-align:left;padding:8px 4px;color:#64748b;font-weight:600;">Stage</th>
      </tr>
    </thead>
    <tbody>
      ${deals.map((d, i) => `
      <tr style="border-bottom:1px solid #f1f5f9;background:${i % 2 === 1 ? '#f8fafc' : 'white'};">
        <td style="padding:8px 4px;color:#0f172a;font-weight:500;">${d.title || 'Untitled'}</td>
        <td style="padding:8px 4px;text-align:right;color:#4c1d95;font-weight:600;">$${Number(d.value).toLocaleString()}</td>
        <td style="padding:8px 4px;color:#64748b;text-transform:capitalize;">${d.stage}</td>
      </tr>`).join('')}
    </tbody>
  </table>`
}

function postsTableHtml(posts: ReportPayload['data']['recent_posts']): string {
  if (!posts.length) return '<p style="color:#64748b;font-size:13px;">No recent posts found.</p>'
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="border-bottom:2px solid #e2e8f0;">
        <th style="text-align:left;padding:8px 4px;color:#64748b;font-weight:600;">Post</th>
        <th style="text-align:left;padding:8px 4px;color:#64748b;font-weight:600;">Status</th>
        <th style="text-align:right;padding:8px 4px;color:#64748b;font-weight:600;">Date</th>
      </tr>
    </thead>
    <tbody>
      ${posts.map((p, i) => `
      <tr style="border-bottom:1px solid #f1f5f9;background:${i % 2 === 1 ? '#f8fafc' : 'white'};">
        <td style="padding:8px 4px;color:#0f172a;">${p.title || 'Untitled post'}</td>
        <td style="padding:8px 4px;">
          <span style="padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;background:${p.status === 'published' ? '#dcfce7' : '#fef9c3'};color:${p.status === 'published' ? '#166534' : '#854d0e'};">
            ${p.status}
          </span>
        </td>
        <td style="padding:8px 4px;text-align:right;color:#94a3b8;">${new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
      </tr>`).join('')}
    </tbody>
  </table>`
}

function competitorsHtml(comps: ReportPayload['data']['competitors']): string {
  if (!comps.length) return '<p style="color:#64748b;font-size:13px;">No competitors tracked.</p>'
  return `<div style="display:flex;flex-direction:column;gap:8px;">
    ${comps.map(c => `
    <div style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <p style="margin:0;font-size:13px;font-weight:600;color:#0f172a;">${c.name}</p>
        ${c.notes ? `<p style="margin:4px 0 0;font-size:11px;color:#64748b;">${String(c.notes).slice(0, 80)}${String(c.notes).length > 80 ? '…' : ''}</p>` : ''}
      </div>
      <span style="padding:2px 10px;border-radius:999px;font-size:10px;font-weight:600;background:#f1f5f9;color:#475569;white-space:nowrap;">${c.status || 'tracked'}</span>
    </div>`).join('')}
  </div>`
}

function aiSection(_icon: string, _color: string, heading: string, body: string, borderColor: string): string {
  return `<div class="section">
    <h2>${heading}</h2>
    <div style="border-left:4px solid ${borderColor};padding:16px 20px;border-radius:0 8px 8px 0;background:${borderColor}11;">
      <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;white-space:pre-line;">${body}</p>
    </div>
  </div>`
}

function buildHtml(report: ReportPayload, template: ReportTemplate): string {
  const dateStr = new Date(report.generated_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  // Detect focus for each report type
  const showDeals    = ['pipeline-summary', 'monthly-review', 'compare-improvement', 'client-report'].includes(template.id)
  const showPosts    = ['content-performance', 'monthly-review', 'compare-improvement', 'client-report'].includes(template.id)
  const showCompetitors = ['competitor-intel', 'monthly-review'].includes(template.id)
  const showMetricGrid  = true // always show

  const ratingMetric = report.metrics.find(m => m.label === 'Avg Rating')
  const healthMetric = report.metrics.find(m => m.label === 'Health Score')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${report.title}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    max-width: 900px;
    margin: 0 auto;
    padding: 40px;
    color: #1e293b;
    background: white;
  }
  .header {
    background: linear-gradient(135deg, #4c1d95, #2563eb);
    color: white;
    padding: 32px;
    border-radius: 12px;
    margin-bottom: 32px;
  }
  .header h1 { margin: 0 0 4px; font-size: 24px; font-weight: 800; }
  .header p  { margin: 0; opacity: 0.8; font-size: 14px; }
  .metric-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
  }
  .improved { border-left: 4px solid #2563eb; }
  .declined { border-left: 4px solid #ef4444; }
  .section { margin-bottom: 32px; }
  .section h2 {
    color: #4c1d95;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 8px;
    margin-bottom: 16px;
    font-weight: 700;
  }
  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
  }
  .footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    text-align: center;
    color: #94a3b8;
    font-size: 11px;
  }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media print {
    body { margin: 0; padding: 20px; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div style="display:flex;align-items:center;gap:16px;">
    <div style="font-size:40px;">${template.icon}</div>
    <div>
      <h1>${report.title}</h1>
      <p>${report.business_name} &nbsp;·&nbsp; Generated ${dateStr}</p>
    </div>
  </div>
  ${healthMetric ? `<div style="margin-top:16px;display:flex;align-items:center;gap:12px;">
    <span style="font-size:13px;opacity:0.8;">Health Score</span>
    <div style="flex:1;height:8px;background:rgba(255,255,255,0.2);border-radius:4px;overflow:hidden;max-width:200px;">
      <div style="width:${healthMetric.curr}%;height:100%;background:#60a5fa;border-radius:4px;"></div>
    </div>
    <span style="font-size:16px;font-weight:700;">${healthMetric.curr}/100</span>
  </div>` : ''}
</div>

<!-- EXECUTIVE SUMMARY -->
<div class="section">
  <h2>Executive Summary</h2>
  <p style="font-size:15px;line-height:1.8;color:#334155;margin:0;">${report.ai.executive_summary}</p>
</div>

<!-- METRIC GRID -->
${showMetricGrid ? `<div class="section">
  <h2>${template.id === 'compare-improvement' ? `Metric Comparison — ${report.period.last_month} vs ${report.period.this_month}` : `Key Metrics — ${report.period.this_month}`}</h2>
  ${metricCardsHtml(report.metrics, report.period)}
</div>` : ''}

<!-- AI NARRATIVE -->
${aiSection('✅', '#2563eb', 'What\'s Working', report.ai.winning, '#2563eb')}
${aiSection('⚠️', '#64748b', 'Needs Attention', report.ai.needs_attention, '#ef4444')}

<!-- NEXT ACTIONS -->
<div class="section">
  <h2>Next Actions</h2>
  <div style="border-left:4px solid #2563eb;padding:16px 20px;border-radius:0 8px 8px 0;background:#f5f3ff;">
    <p style="margin:0;font-size:14px;line-height:2;color:#334155;white-space:pre-line;">${report.ai.next_actions}</p>
  </div>
</div>

<!-- DEALS TABLE (conditional) -->
${showDeals && report.data.top_deals.length > 0 ? `<div class="section">
  <h2>Top Open Deals (${report.data.open_deals_count} total)</h2>
  ${dealsTableHtml(report.data.top_deals)}
</div>` : ''}

<!-- POSTS TABLE (conditional) -->
${showPosts && report.data.recent_posts.length > 0 ? `<div class="section">
  <h2>Recent Content</h2>
  ${postsTableHtml(report.data.recent_posts)}
</div>` : ''}

<!-- COMPETITORS (conditional) -->
${showCompetitors && report.data.competitors.length > 0 ? `<div class="section">
  <h2>Tracked Competitors</h2>
  ${competitorsHtml(report.data.competitors)}
</div>` : ''}

<!-- RATING BAR (reviews / nps) -->
${ratingMetric && template.id === 'nps-report' ? `<div class="section">
  <h2>Review Rating</h2>
  <div style="max-width:400px;">
    <p style="font-size:12px;color:#64748b;margin:0 0 8px;">Average rating this month</p>
    ${starsBar(ratingMetric.curr)}
    ${!ratingMetric.noCompare ? `<p style="font-size:11px;color:#94a3b8;margin:8px 0 0;">vs ${ratingMetric.prev.toFixed(1)}★ last month</p>` : ''}
  </div>
</div>` : ''}

<!-- FOOTER -->
<div class="footer">
  Generated by <strong style="color:#2563eb;">CooVex</strong> AI Business Agent &nbsp;·&nbsp; ${dateStr}
</div>

</body>
</html>`
}

// ─── component ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [templates, setTemplates]     = useState<ReportTemplate[]>(TEMPLATES)
  const [businessName, setBusinessName] = useState('Your Business')
  const [generating, setGenerating]   = useState<string | null>(null)
  const [scheduleModal, setScheduleModal] = useState<string | null>(null)
  const [clientEmail, setClientEmail] = useState('')
  const [reportHtml, setReportHtml]   = useState<string | null>(null)
  const [reportTemplate, setReportTemplate] = useState<ReportTemplate | null>(null)
  const [genError, setGenError]       = useState<string | null>(null)
  const [proposalStats, setProposalStats] = useState<{ total: number; sent: number; accepted: number; declined: number } | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    fetch('/api/workspaces')
      .then(r => r.json())
      .then(d => {
        const current = (d.workspaces ?? []).find((w: { is_current: boolean; business_name: string }) => w.is_current)
        if (current?.business_name) setBusinessName(current.business_name)
      })
      .catch(() => {})

    fetch('/api/proposals')
      .then(r => r.json())
      .then(d => {
        const list: { status: string }[] = d.proposals ?? []
        setProposalStats({
          total:    list.length,
          sent:     list.filter(p => p.status === 'sent' || p.status === 'viewed').length,
          accepted: list.filter(p => p.status === 'accepted').length,
          declined: list.filter(p => p.status === 'declined').length,
        })
      })
      .catch(() => {})
  }, [])

  function closeReport() {
    setReportHtml(null)
    setReportTemplate(null)
  }

  function printReport() {
    iframeRef.current?.contentWindow?.print()
  }

  async function generate(template: ReportTemplate) {
    setGenerating(template.id)
    setGenError(null)
    try {
      const res = await fetch('/api/reports/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: template.id }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data: ReportPayload = await res.json()
      const html = buildHtml(data, template)
      setReportHtml(html)
      setReportTemplate(template)
      setTemplates(prev => prev.map(t => t.id === template.id
        ? { ...t, lastGenerated: new Date().toISOString().slice(0, 10) }
        : t
      ))
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(null)
    }
  }

  function updateSchedule(id: string, schedule: ReportTemplate['schedule']) {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, schedule } : t))
    setScheduleModal(null)
  }

  const activeScheduled = templates.filter(t => t.schedule !== 'none').length

  return (
    <>
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">Generate and schedule branded business reports</p>
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Clock className="w-4 h-4" />
          {activeScheduled} reports scheduled
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Templates', value: templates.length },
          { label: 'Scheduled',       value: activeScheduled  },
          { label: 'Generated',       value: templates.filter(t => t.lastGenerated).length },
        ].map(k => (
          <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{k.label}</p>
            <p className="text-white text-2xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Proposal stats */}
      {proposalStats !== null && (
        <div className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-semibold text-sm">Proposal Pipeline</p>
            <span className="text-slate-500 text-xs">{proposalStats.total} total</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total',    value: proposalStats.total,    color: 'text-white',         dot: 'bg-slate-500' },
              { label: 'Awaiting', value: proposalStats.sent,     color: 'text-slate-500',     dot: 'bg-slate-500' },
              { label: 'Accepted', value: proposalStats.accepted, color: 'text-blue-400',   dot: 'bg-blue-500' },
              { label: 'Declined', value: proposalStats.declined, color: 'text-red-400',       dot: 'bg-red-400' },
            ].map(s => (
              <div key={s.label} className="text-center p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                  <span className="text-slate-500 text-[10px] uppercase tracking-wide">{s.label}</span>
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
          {proposalStats.total > 0 && (
            <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="bg-slate-500 h-full transition-all" style={{ width: `${(proposalStats.sent / proposalStats.total) * 100}%` }} />
              <div className="bg-blue-500 h-full transition-all" style={{ width: `${(proposalStats.accepted / proposalStats.total) * 100}%` }} />
              <div className="bg-red-400 h-full transition-all" style={{ width: `${(proposalStats.declined / proposalStats.total) * 100}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="text-3xl">{t.icon}</div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                t.schedule === 'none'
                  ? 'bg-slate-800 text-slate-500 border-slate-700'
                  : 'bg-slate-900/40 text-blue-300 border-slate-700/40'
              }`}>
                {SCHEDULE_LABELS[t.schedule]}
              </span>
            </div>
            <h3 className="text-white font-semibold text-sm mb-1">{t.name}</h3>
            <p className="text-slate-400 text-xs leading-relaxed flex-1 mb-3">{t.description}</p>

            {/* Sections preview */}
            <div className="flex flex-wrap gap-1 mb-4">
              {t.sections.slice(0, 3).map(s => (
                <span key={s} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">{s}</span>
              ))}
              {t.sections.length > 3 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-600 rounded">+{t.sections.length - 3} more</span>
              )}
            </div>

            {t.lastGenerated && (
              <p className="text-slate-600 text-[10px] mb-3">
                Last: {new Date(t.lastGenerated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => generate(t)}
                disabled={generating === t.id}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium rounded-lg border border-slate-700/40 transition-colors disabled:opacity-50"
              >
                {generating === t.id
                  ? <><div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />Generating…</>
                  : <><Download className="w-3.5 h-3.5" />Generate PDF</>
                }
              </button>
              <button
                onClick={() => setScheduleModal(t.id)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-lg border border-slate-700 transition-colors"
                title="Schedule"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
              {t.id === 'client-report' && (
                <button
                  onClick={() => setClientEmail(businessName)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-lg border border-slate-700 transition-colors"
                  title="Send to client"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Schedule modal */}
      {scheduleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-4">Schedule Report</h3>
            <p className="text-slate-400 text-sm mb-4">{templates.find(t => t.id === scheduleModal)?.name}</p>
            <div className="space-y-2">
              {(['none', 'weekly', 'monthly'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => updateSchedule(scheduleModal, s)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                    templates.find(t => t.id === scheduleModal)?.schedule === s
                      ? 'bg-blue-600/20 border-slate-700/40 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {SCHEDULE_LABELS[s]}
                  {s === 'weekly'  && <span className="text-slate-500 text-xs ml-2">Every Monday</span>}
                  {s === 'monthly' && <span className="text-slate-500 text-xs ml-2">1st of month</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => setScheduleModal(null)}
              className="mt-4 text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Client email modal */}
      {clientEmail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-4">Send Client Report</h3>
            <label className="block text-xs text-slate-400 mb-1.5">Client Email</label>
            <input
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              placeholder="client@company.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors mb-4"
            />
            <p className="text-slate-500 text-xs mb-4">Email delivery requires Resend setup. Share the portal link as an alternative.</p>
            <div className="flex gap-2">
              <button onClick={() => setClientEmail('')} className="flex-1 py-2 bg-slate-800 text-slate-300 text-sm rounded-xl border border-slate-700">Cancel</button>
              <button onClick={() => setClientEmail('')} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors">Send</button>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {genError && (
        <div className="fixed bottom-6 right-6 z-50 bg-red-950 border border-red-800 rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl">
          <span className="text-red-400 text-sm">{genError}</span>
          <button onClick={() => setGenError(null)} className="text-red-600 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>

    {/* ── Report Preview Modal (full-screen, popup-blocker proof) ── */}

    {reportHtml && (
      <div className="fixed inset-0 z-[60] flex flex-col bg-black">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg">{reportTemplate?.icon}</span>
            <div>
              <p className="text-white font-semibold text-sm">{reportTemplate?.name}</p>
              <p className="text-slate-500 text-xs">{businessName} · Preview</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={printReport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={closeReport}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
        </div>

        {/* iframe renders the report — no popup blocker issue */}
        <iframe
          ref={iframeRef}
          srcDoc={reportHtml}
          className="flex-1 w-full border-0"
          title="Report Preview"
        />
      </div>
    )}
    </>
  )
}
