import Link from 'next/link'
import { notFound } from 'next/navigation'
import { POSTS } from '../content'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { SiteFooter } from '@/components/layout/site-footer'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type DbStep = { title: string; content: string; tip?: string; warning?: string; image?: string }
type DbPost = {
  id: string; slug: string; title: string; subtitle: string; category: string;
  icon: string; read_time: number; description: string; tags: string[];
  content: DbStep[]; published: boolean;
}

async function getDbPost(slug: string): Promise<DbPost | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle()
    return data ?? null
  } catch {
    return null
  }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const dbPost = await getDbPost(slug)
  if (dbPost) return { title: dbPost.title, description: dbPost.description }
  const post = POSTS.find(p => p.slug === slug)
  if (!post) return {}
  return { title: post.title, description: post.description }
}

export function generateStaticParams() {
  return POSTS.map(p => ({ slug: p.slug }))
}

// ─── UI Mockup components ─────────────────────────────────────────────────────

function MockupFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-xl shadow-black/40 my-6">
      <div className="bg-slate-800 h-9 flex items-center px-4 gap-2 border-b border-slate-700">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
          <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
          <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
        </div>
        <span className="flex-1 text-center text-slate-500 text-xs">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-violet-950/40 border border-violet-800/30 rounded-xl p-4 my-4">
      <span className="text-violet-400 text-lg flex-shrink-0">💡</span>
      <p className="text-violet-200 text-sm leading-relaxed">{children}</p>
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-amber-950/30 border border-amber-700/30 rounded-xl p-4 my-4">
      <span className="text-amber-400 text-lg flex-shrink-0">⚠️</span>
      <p className="text-amber-200 text-sm leading-relaxed">{children}</p>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {n}
        </div>
        <h3 className="text-white font-semibold text-xl">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ─── Tutorial content per slug ─────────────────────────────────────────────────

function GettingStartedContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        This guide walks you through the complete CooVex setup — from creating your account to receiving your first AI briefing. It takes about 5 minutes.
      </p>

      <Step n={1} title="Create your account">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">coovex.com</strong> and click <strong className="text-white">Start Free Trial</strong>. Enter your name, work email, and password.
        </p>
        <MockupFrame title="app.coovex.com/signup">
          <div className="max-w-sm mx-auto space-y-3 py-2">
            <div className="text-center mb-4">
              <div className="text-white font-bold text-lg">Create your account</div>
              <div className="text-slate-500 text-xs mt-1">14-day free trial · Full access</div>
            </div>
            {[{ label: 'Full Name', placeholder: 'Sarah Johnson' }, { label: 'Work Email', placeholder: 'sarah@company.com' }, { label: 'Password', placeholder: '••••••••••' }].map(f => (
              <div key={f.label}>
                <div className="text-slate-400 text-xs mb-1">{f.label}</div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-500 text-sm">{f.placeholder}</div>
              </div>
            ))}
            <div className="bg-violet-600 text-white text-sm font-medium text-center py-2.5 rounded-lg mt-4">Create Free Account →</div>
          </div>
        </MockupFrame>
        <Tip>Use your business email address. CooVex uses it to pre-fill your business profile.</Tip>
      </Step>

      <Step n={2} title="Set up your business profile">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          After signup, the Onboarding wizard launches automatically. Enter your business name, website URL, industry, and country. This data is used by the AI agent to calibrate all monitoring and recommendations.
        </p>
        <MockupFrame title="app.coovex.com/onboarding">
          <div className="max-w-md mx-auto space-y-3 py-2">
            <div className="text-white font-semibold mb-4">Tell us about your business</div>
            {[
              { label: 'Business Name', val: 'Bloom Wellness Co.', done: true },
              { label: 'Website URL', val: 'bloomwellness.com', done: true },
              { label: 'Industry', val: 'Health & Wellness', done: true },
              { label: 'Country', val: 'United States', done: true },
              { label: 'Business Size', val: '1–10 employees', done: false },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full flex-shrink-0 ${f.done ? 'bg-emerald-500' : 'bg-slate-700 border border-slate-600'}`} />
                <div className="flex-1">
                  <div className="text-slate-500 text-xs">{f.label}</div>
                  <div className={`text-sm ${f.done ? 'text-white' : 'text-slate-600'}`}>{f.val}</div>
                </div>
              </div>
            ))}
            <div className="bg-violet-600 text-white text-sm font-medium text-center py-2 rounded-lg mt-4">Continue →</div>
          </div>
        </MockupFrame>
      </Step>

      <Step n={3} title="Add your first competitors">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Type competitor business names or website URLs. CooVex will start monitoring them for pricing changes, new reviews, content activity, and hiring signals.
        </p>
        <MockupFrame title="app.coovex.com/onboarding — Step 2">
          <div className="max-w-md mx-auto py-2">
            <div className="text-white font-semibold mb-1">Add your competitors</div>
            <div className="text-slate-500 text-xs mb-4">Add up to 5 for your plan. You can add more later.</div>
            <div className="space-y-2 mb-3">
              {['RivalCo.com', 'FastFitness.io', 'ZenWellness.com'].map((c, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                  <div className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 text-xs flex items-center justify-center font-bold">{c[0]}</div>
                  <span className="text-slate-300 text-sm flex-1">{c}</span>
                  <span className="text-emerald-400 text-xs">Tracking ✓</span>
                </div>
              ))}
            </div>
            <div className="bg-slate-800 border border-dashed border-slate-600 rounded-lg px-3 py-2 text-slate-600 text-sm">+ Add another competitor...</div>
          </div>
        </MockupFrame>
      </Step>

      <Step n={4} title="Connect your channels">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Connect LinkedIn, Facebook, Google Business, or your CRM. Each connection unlocks more AI features. You can skip any and connect later from <strong className="text-white">Settings → Integrations</strong>.
        </p>
        <MockupFrame title="app.coovex.com/onboarding — Step 3">
          <div className="max-w-md mx-auto py-2">
            <div className="text-white font-semibold mb-4">Connect your channels</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'LinkedIn', icon: '💼', status: 'connected' },
                { name: 'Google Business', icon: '⭐', status: 'connected' },
                { name: 'Facebook', icon: '📘', status: 'pending' },
                { name: 'HubSpot', icon: '🔶', status: 'pending' },
              ].map(ch => (
                <div key={ch.name} className={`border rounded-xl p-3 flex items-center gap-2 ${ch.status === 'connected' ? 'border-emerald-700/40 bg-emerald-950/20' : 'border-slate-700 bg-slate-800/50'}`}>
                  <span className="text-lg">{ch.icon}</span>
                  <div>
                    <div className="text-white text-xs font-medium">{ch.name}</div>
                    <div className={`text-xs ${ch.status === 'connected' ? 'text-emerald-400' : 'text-violet-400'}`}>
                      {ch.status === 'connected' ? '✓ Connected' : 'Connect →'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </MockupFrame>
        <Tip>The more channels you connect, the smarter your AI agent becomes. LinkedIn + Google Business is the minimum recommended setup.</Tip>
      </Step>

      <Step n={5} title="Receive your first AI briefing">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          After setup, your agent runs its first analysis. Within a few minutes, your Dashboard fills with signals, competitor data, and your first Business Health Score. Check the <strong className="text-white">Agent Inbox</strong> for your first batch of prioritized actions.
        </p>
        <MockupFrame title="app.coovex.com/dashboard">
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {[
                { l: 'Health Score', v: '72', sub: 'Good — improving', c: 'text-blue-400' },
                { l: 'Competitors', v: '3', sub: 'Being tracked', c: 'text-violet-400' },
                { l: 'Signals', v: '5', sub: 'Need attention', c: 'text-amber-400' },
                { l: 'Review Avg', v: '4.2★', sub: 'Google Business', c: 'text-amber-400' },
              ].map(s => (
                <div key={s.l} className="bg-slate-800 rounded-lg p-2.5 text-center">
                  <div className="text-slate-500 text-xs">{s.l}</div>
                  <div className={`font-bold text-sm mt-0.5 ${s.c}`}>{s.v}</div>
                  <div className="text-slate-600 text-xs">{s.sub}</div>
                </div>
              ))}
            </div>
            <div className="bg-slate-800 rounded-lg p-3 space-y-2">
              <div className="text-slate-400 text-xs font-medium mb-1">🤖 Agent Inbox — Today</div>
              {[
                { type: '❗', text: 'Competitor RivalCo dropped prices by 12% — 2h ago', color: 'text-red-300' },
                { type: '⭐', text: '2 new reviews on Google Business — respond now', color: 'text-amber-300' },
                { type: '💡', text: 'Best time to post this week: Tuesday 10am', color: 'text-violet-300' },
              ].map((s, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span>{s.type}</span>
                  <span className={`text-xs ${s.color}`}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function DashboardContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Your Dashboard is the command center. This guide explains every section so you can act on the right things, at the right time.
      </p>

      <Step n={1} title="Read your Business Health Score">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          The Health Score (0–100) is a composite metric updated daily. It combines your digital presence, review sentiment, content activity, lead volume, and competitor position. Click the score card to see the full breakdown.
        </p>
        <MockupFrame title="Dashboard — Health Score">
          <div className="max-w-xs mx-auto">
            <div className="bg-slate-800 rounded-2xl p-5 text-center">
              <div className="text-slate-500 text-xs uppercase tracking-wider mb-2">Business Health Score</div>
              <div className="text-5xl font-black text-white mb-1">78</div>
              <div className="text-blue-400 text-sm font-medium mb-4">Good</div>
              <div className="space-y-2">
                {[
                  { label: 'Digital Presence', score: 82, color: 'bg-blue-500' },
                  { label: 'Content Activity', score: 60, color: 'bg-violet-500' },
                  { label: 'Review Sentiment', score: 90, color: 'bg-emerald-500' },
                  { label: 'Lead Pipeline', score: 72, color: 'bg-amber-500' },
                  { label: 'Competitor Position', score: 65, color: 'bg-red-500' },
                ].map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                      <span>{m.label}</span><span className="text-white">{m.score}</span>
                    </div>
                    <div className="bg-slate-700 rounded-full h-1.5">
                      <div className={`${m.color} h-1.5 rounded-full`} style={{ width: `${m.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </MockupFrame>
        <Tip>A score below 60 means the agent will send more urgent signals. A score above 85 means you're outperforming most businesses in your industry.</Tip>
      </Step>

      <Step n={2} title="Act on Agent Inbox signals">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          The Agent Inbox shows prioritized signals — ranked by urgency and business impact. Red signals require immediate action. Violet signals are opportunities. Green signals are wins to acknowledge.
        </p>
        <MockupFrame title="Dashboard — Agent Inbox">
          <div className="space-y-2">
            {[
              { icon: '❗', label: 'URGENT', text: 'Competitor RivalCo launched 20% discount on their main product — 3 hrs ago', bg: 'border-red-900/50 bg-red-950/20', lc: 'text-red-400' },
              { icon: '💡', label: 'OPPORTUNITY', text: 'Trending topic in your niche: "sustainable packaging" — high engagement this week', bg: 'border-violet-900/50 bg-violet-950/20', lc: 'text-violet-400' },
              { icon: '⭐', label: 'ACTION', text: '3 new Google reviews — 2 positive, 1 negative. AI draft responses ready.', bg: 'border-amber-900/50 bg-amber-950/20', lc: 'text-amber-400' },
              { icon: '✅', label: 'WIN', text: 'Your LinkedIn post from Tuesday reached 2,400 impressions — 3× above average', bg: 'border-emerald-900/50 bg-emerald-950/20', lc: 'text-emerald-400' },
            ].map((s, i) => (
              <div key={i} className={`border rounded-xl p-3 flex items-start gap-3 ${s.bg}`}>
                <span className="text-lg">{s.icon}</span>
                <div className="flex-1">
                  <div className={`text-xs font-bold tracking-wider mb-0.5 ${s.lc}`}>{s.label}</div>
                  <div className="text-slate-300 text-xs leading-relaxed">{s.text}</div>
                </div>
                <button className="text-xs text-slate-500 hover:text-white border border-slate-700 px-2 py-1 rounded-lg flex-shrink-0">Act</button>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>

      <Step n={3} title="Use the Daily Briefing">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Each morning, CooVex generates a briefing — a ranked list of the top 5 things to focus on today, based on signals, goals, and deadlines. It's available at the top of the Dashboard and delivered by email at 7am.
        </p>
        <MockupFrame title="Dashboard — Today's Briefing">
          <div className="bg-slate-800/60 rounded-xl p-4">
            <div className="text-slate-400 text-xs mb-3">🌅 Good morning! Here&apos;s what matters today:</div>
            <div className="space-y-2">
              {[
                { rank: 1, task: 'Respond to the 1-star Google review from "J.M." before it ranks on search', priority: 'High' },
                { rank: 2, task: 'Post on LinkedIn today — audience peak window is 9–11am', priority: 'High' },
                { rank: 3, task: 'Follow up with 3 leads scored 80+ that haven\'t replied in 5 days', priority: 'Medium' },
                { rank: 4, task: 'Competitor FastFitness posted new pricing — review and adjust', priority: 'Medium' },
                { rank: 5, task: 'Monthly goal: 12 leads closed. You\'re at 8 — 5 days left', priority: 'Low' },
              ].map(t => (
                <div key={t.rank} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">{t.rank}</div>
                  <div className="flex-1">
                    <p className="text-slate-300 text-xs leading-relaxed">{t.task}</p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${t.priority === 'High' ? 'bg-red-900/40 text-red-400' : t.priority === 'Medium' ? 'bg-amber-900/40 text-amber-400' : 'bg-slate-700 text-slate-500'}`}>{t.priority}</span>
                </div>
              ))}
            </div>
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function WebsiteAuditContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The Website Audit runs a full analysis of your site across SEO, performance, mobile, trust, and UX. It generates a prioritized action plan with exact fixes.
      </p>

      <Step n={1} title="Run your first audit">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Navigate to <strong className="text-white">Audit</strong> in the sidebar. Your business website is pre-filled. Click <strong className="text-white">Run Full Audit</strong>. It takes 30–60 seconds. You can run a new audit monthly.
        </p>
        <MockupFrame title="app.coovex.com/audit">
          <div className="max-w-md mx-auto py-2">
            <div className="text-white font-semibold mb-1">Website Audit</div>
            <div className="text-slate-500 text-xs mb-4">Full analysis: SEO · Speed · Mobile · Trust · UX</div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 flex items-center gap-2 mb-3">
              <span className="text-slate-500 text-sm">🌐</span>
              <span className="text-slate-300 text-sm">bloomwellness.com</span>
              <span className="ml-auto text-xs text-slate-500">Edit</span>
            </div>
            <div className="bg-violet-600 text-white text-sm font-medium text-center py-2.5 rounded-lg">▶ Run Full Audit</div>
          </div>
        </MockupFrame>
      </Step>

      <Step n={2} title="Read your audit scores">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Each category is scored 0–100. Red = critical issues. Amber = improvements needed. Green = good. The overall score appears at the top.
        </p>
        <MockupFrame title="Audit Results — bloomwellness.com">
          <div className="max-w-sm mx-auto space-y-3">
            <div className="text-center mb-2">
              <div className="text-4xl font-black text-white">63</div>
              <div className="text-amber-400 text-sm">Needs Improvement</div>
            </div>
            {[
              { cat: 'SEO', score: 55, color: 'bg-amber-500', issues: '8 issues' },
              { cat: 'Performance', score: 42, color: 'bg-red-500', issues: '5 issues (critical)' },
              { cat: 'Mobile', score: 78, color: 'bg-blue-500', issues: '2 issues' },
              { cat: 'Trust & Security', score: 90, color: 'bg-emerald-500', issues: 'Looks good' },
              { cat: 'UX & Accessibility', score: 65, color: 'bg-violet-500', issues: '4 issues' },
            ].map(c => (
              <div key={c.cat}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-400">{c.cat}</span>
                  <span className="text-slate-500">{c.issues}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <div className={`${c.color} h-2 rounded-full`} style={{ width: `${c.score}%` }} />
                  </div>
                  <span className="text-white text-xs font-medium w-6 text-right">{c.score}</span>
                </div>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>

      <Step n={3} title="Execute the AI action plan">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Below the scores is your personalized action plan — ranked by impact. Each item has an exact fix description, an estimated effort level, and the expected score improvement.
        </p>
        <MockupFrame title="Audit — Action Plan">
          <div className="space-y-2">
            {[
              { icon: '🔴', title: 'Add missing meta descriptions', impact: '+8 SEO', effort: '10 min', fix: 'These 4 pages have no meta description: /about, /services, /contact, /blog' },
              { icon: '🔴', title: 'Compress images on homepage', impact: '+12 Speed', effort: '30 min', fix: '3 images are >1MB. Use WebP format to reduce load time by ~2.4s.' },
              { icon: '🟡', title: 'Add schema markup for products', impact: '+6 SEO', effort: '1 hr', fix: 'Structured data improves Google rich snippets and click-through rate.' },
              { icon: '🟡', title: 'Fix 3 broken internal links', impact: '+4 UX', effort: '15 min', fix: '/old-pricing link appears in 4 pages and returns 404.' },
            ].map((a, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-3">
                <div className="flex items-start gap-2 mb-1">
                  <span>{a.icon}</span>
                  <div className="flex-1">
                    <div className="text-white text-xs font-medium">{a.title}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{a.fix}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-emerald-400 text-xs font-medium">{a.impact}</div>
                    <div className="text-slate-600 text-xs">{a.effort}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>Start with items marked 🔴 — they have the highest impact and usually fix the worst issues first. Complete them before moving to 🟡 improvements.</Tip>
      </Step>

      <Step n={4} title="Re-run after fixing issues">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          After applying fixes, return to the Audit page and run a new audit to confirm your score improved. The audit tracks history so you can compare scores over time.
        </p>
        <Warning>Avoid running audits more than once per week. Most fixes need 3–7 days to be indexed by search engines before their impact shows up in scores.</Warning>
      </Step>
    </>
  )
}

function ContentCalendarContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The Content Calendar helps you plan, write, schedule, and track posts across LinkedIn, Facebook, and Instagram — with AI generating the content.
      </p>

      <Step n={1} title="Generate AI post ideas">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Content</strong> in the sidebar. Click <strong className="text-white">Generate Ideas</strong>. The AI suggests 10 post ideas based on your industry, recent trends, and what performed best for you previously.
        </p>
        <MockupFrame title="app.coovex.com/content">
          <div className="space-y-2">
            <div className="text-slate-400 text-xs font-medium mb-3">🤖 AI-suggested ideas for this week:</div>
            {[
              { title: '5 signs your wellness routine needs a reset', type: 'Educational', score: '94 est. engagement' },
              { title: 'Behind the scenes: How we source our products', type: 'Story', score: '88 est. engagement' },
              { title: 'Client transformation story: Meet Sarah', type: 'Social Proof', score: '96 est. engagement' },
              { title: 'The #1 mistake people make with supplements', type: 'Opinion', score: '85 est. engagement' },
            ].map((idea, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <div className="flex-1">
                  <div className="text-slate-200 text-xs font-medium">{idea.title}</div>
                  <div className="text-slate-500 text-xs">{idea.type}</div>
                </div>
                <div className="text-emerald-400 text-xs">{idea.score}</div>
                <button className="text-xs text-violet-400 border border-violet-800/50 px-2 py-1 rounded">Write</button>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>

      <Step n={2} title="Write and edit the post">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Click <strong className="text-white">Write</strong> on any idea. The AI drafts a full post for your chosen platform — LinkedIn (long-form), Instagram (caption + hashtags), or Facebook. You can regenerate or edit inline.
        </p>
        <MockupFrame title="Content Editor">
          <div className="max-w-md mx-auto">
            <div className="flex gap-2 mb-3">
              {['LinkedIn', 'Instagram', 'Facebook'].map((p, i) => (
                <button key={p} className={`text-xs px-3 py-1.5 rounded-lg ${i === 0 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{p}</button>
              ))}
            </div>
            <div className="bg-slate-800 rounded-xl p-3 text-xs text-slate-300 leading-relaxed min-h-24">
              <p className="mb-2">🌿 5 signs your wellness routine needs a reset:</p>
              <p className="text-slate-400 mb-1">1. You&apos;re following a routine from 3 years ago without questioning it</p>
              <p className="text-slate-400 mb-1">2. Your energy peaks are unpredictable...</p>
              <p className="text-slate-600 italic">...AI-generated draft continues...</p>
            </div>
            <div className="flex gap-2 mt-2">
              <button className="text-xs px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg">🔄 Regenerate</button>
              <button className="text-xs px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg">✂️ Shorten</button>
              <button className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg ml-auto">Schedule →</button>
            </div>
          </div>
        </MockupFrame>
      </Step>

      <Step n={3} title="Schedule to your calendar">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Pick a date and time to publish. The AI shows you the recommended time slot based on your audience's peak engagement window. Posts show on the calendar in their scheduled slot.
        </p>
        <MockupFrame title="Content — Calendar View">
          <div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="text-center text-slate-600 text-xs py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[...Array(7)].map((_, i) => (
                <div key={i} className={`min-h-14 rounded-lg p-1 border ${i === 1 ? 'border-violet-700/50 bg-violet-950/20' : 'border-slate-800 bg-slate-800/30'}`}>
                  <div className="text-slate-600 text-xs mb-1">{i + 18}</div>
                  {i === 1 && <div className="bg-blue-600/80 text-white text-xs rounded px-1 py-0.5 truncate">Client Story</div>}
                  {i === 3 && <div className="bg-emerald-700/60 text-white text-xs rounded px-1 py-0.5 truncate">Tips Post</div>}
                  {i === 5 && <div className="bg-slate-700 text-slate-400 text-xs rounded px-1 py-0.5 truncate">Draft...</div>}
                </div>
              ))}
            </div>
          </div>
        </MockupFrame>
        <Tip>The green-highlighted time slot on your calendar is the AI-recommended posting time for maximum reach in your industry.</Tip>
      </Step>

      <Step n={4} title="Review content performance">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          After posts go live, click <strong className="text-white">Performance</strong> to see impressions, engagement rate, and clicks. The AI identifies which post types perform best for your audience.
        </p>
        <MockupFrame title="Content Performance">
          <div className="space-y-2">
            {[
              { title: 'Client transformation story', reach: '4,200', eng: '8.4%', clicks: '142', badge: '🔥 Best this month' },
              { title: '5 signs routine needs reset', reach: '2,800', eng: '5.2%', clicks: '78', badge: '' },
              { title: 'Behind the scenes: sourcing', reach: '1,900', eng: '4.8%', clicks: '45', badge: '' },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <div className="flex-1">
                  <div className="text-slate-300 text-xs font-medium">{p.title}</div>
                  {p.badge && <div className="text-amber-400 text-xs">{p.badge}</div>}
                </div>
                <div className="text-right text-xs">
                  <div className="text-white">{p.reach}</div>
                  <div className="text-slate-500">reach</div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-emerald-400">{p.eng}</div>
                  <div className="text-slate-500">eng.</div>
                </div>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function LeadManagementContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        CooVex scores every lead 0–100 using AI, so you always know who to prioritize. This guide covers adding leads, understanding scores, and moving them through your pipeline.
      </p>

      <Step n={1} title="Add or import leads">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Leads</strong>. Click <strong className="text-white">Add Lead</strong> to enter one manually, or use <strong className="text-white">Import CSV</strong> to upload a spreadsheet. You can also connect HubSpot/Salesforce to sync automatically.
        </p>
        <MockupFrame title="app.coovex.com/leads">
          <div className="space-y-2">
            {[
              { name: 'Marcus Chen', company: 'GrowthStack SaaS', score: 94, stage: 'Proposal', tag: 'Hot' },
              { name: 'Priya Sharma', company: 'HealthPath Inc.', score: 81, stage: 'Discovery', tag: 'Warm' },
              { name: 'James Osei', company: 'Apex Agency', score: 76, stage: 'New', tag: 'Warm' },
              { name: 'Fatima Al-Hassan', company: 'Solo Freelancer', score: 31, stage: 'New', tag: 'Cold' },
            ].map((lead) => (
              <div key={lead.name} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
                  {lead.name[0]}
                </div>
                <div className="flex-1">
                  <div className="text-slate-200 text-xs font-medium">{lead.name}</div>
                  <div className="text-slate-500 text-xs">{lead.company}</div>
                </div>
                <div className="text-center">
                  <div className={`text-sm font-bold ${lead.score >= 80 ? 'text-emerald-400' : lead.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{lead.score}</div>
                  <div className="text-slate-600 text-xs">score</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${lead.tag === 'Hot' ? 'bg-red-900/40 text-red-300' : lead.tag === 'Warm' ? 'bg-amber-900/40 text-amber-300' : 'bg-slate-700 text-slate-400'}`}>{lead.tag}</span>
                <span className="text-xs text-slate-500">{lead.stage}</span>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>

      <Step n={2} title="Understand the AI lead score">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Click any lead to open their profile. The AI score (0–100) is explained with the exact factors. Scores above 80 are priority — contact them within 24 hours. Scores below 40 go into cold nurture sequences.
        </p>
        <MockupFrame title="Lead Profile — Marcus Chen">
          <div className="max-w-sm mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-violet-600/30 flex items-center justify-center text-violet-300 font-bold">MC</div>
              <div>
                <div className="text-white font-semibold text-sm">Marcus Chen</div>
                <div className="text-slate-500 text-xs">GrowthStack SaaS · CEO</div>
              </div>
              <div className="ml-auto text-center">
                <div className="text-2xl font-black text-emerald-400">94</div>
                <div className="text-xs text-emerald-600">Hot Lead</div>
              </div>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3 mb-3">
              <div className="text-slate-400 text-xs font-medium mb-2">Why this score:</div>
              <div className="space-y-1">
                {[
                  { factor: 'Decision maker (CEO)', weight: '+18' },
                  { factor: 'Company size: 11–50', weight: '+12' },
                  { factor: 'Opened 4 emails', weight: '+10' },
                  { factor: 'Visited pricing page 3×', weight: '+14' },
                  { factor: 'Replied to last email', weight: '+20' },
                ].map(f => (
                  <div key={f.factor} className="flex justify-between text-xs">
                    <span className="text-slate-400">{f.factor}</span>
                    <span className="text-emerald-400 font-medium">{f.weight}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-violet-900/30 border border-violet-700/40 rounded-lg p-2.5 text-xs text-violet-200">
              🤖 Agent: Send a proposal today. Marcus visited pricing 3× in 48h — buying signal.
            </div>
          </div>
        </MockupFrame>
      </Step>

      <Step n={3} title="Move leads through the pipeline">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Use the Kanban view to drag leads across stages: <strong className="text-white">New → Discovery → Proposal → Negotiation → Closed</strong>. The AI updates the score as the lead progresses.
        </p>
        <MockupFrame title="Leads — Pipeline View">
          <div className="grid grid-cols-4 gap-2 text-xs">
            {[
              { stage: 'New', leads: ['James O.', 'Fatima A.'], color: 'border-slate-700' },
              { stage: 'Discovery', leads: ['Priya S.', 'Carlos M.'], color: 'border-blue-800/50' },
              { stage: 'Proposal', leads: ['Marcus C.'], color: 'border-violet-800/50' },
              { stage: 'Closed', leads: ['Sarah W.'], color: 'border-emerald-800/50' },
            ].map(col => (
              <div key={col.stage} className={`border rounded-xl p-2 ${col.color}`}>
                <div className="text-slate-500 font-medium mb-2 text-center">{col.stage}</div>
                {col.leads.map(lead => (
                  <div key={lead} className="bg-slate-800 rounded-lg p-2 mb-1 text-slate-300 text-center">{lead}</div>
                ))}
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>Set up a drip campaign for leads scored below 50. Instead of dropping them, the AI will nurture them automatically over 4–6 weeks.</Tip>
      </Step>
    </>
  )
}

function CompetitorContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Competitor Tracking monitors your rivals 24/7 and alerts you to pricing changes, content moves, new reviews, and hiring signals — so you can react before customers notice.
      </p>

      <Step n={1} title="Add competitors">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Competitors</strong> → <strong className="text-white">Add Competitor</strong>. Enter the business name or website. CooVex auto-discovers their social profiles, review listings, and pricing pages.
        </p>
        <MockupFrame title="Competitors — Overview">
          <div className="space-y-2">
            {[
              { name: 'RivalCo', url: 'rivalco.com', alerts: 3, rating: '4.1★', trend: '↓ dropped price' },
              { name: 'FastFitness', url: 'fastfitness.io', alerts: 1, rating: '3.8★', trend: '↑ new content' },
              { name: 'ZenWellness', url: 'zenwellness.com', alerts: 0, rating: '4.6★', trend: 'No changes' },
            ].map(c => (
              <div key={c.name} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-white text-xs font-bold">{c.name[0]}</div>
                <div className="flex-1">
                  <div className="text-slate-200 text-xs font-medium">{c.name}</div>
                  <div className="text-slate-500 text-xs">{c.url}</div>
                </div>
                <div className="text-amber-400 text-xs">{c.rating}</div>
                <div className="text-slate-400 text-xs">{c.trend}</div>
                {c.alerts > 0 && <div className="bg-red-900/40 text-red-400 text-xs px-1.5 py-0.5 rounded-full">{c.alerts} alerts</div>}
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>

      <Step n={2} title="View competitive intelligence">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Click any competitor to see a full intelligence profile: pricing history, review trends, top-performing content, and estimated traffic rank.
        </p>
        <MockupFrame title="Competitor Profile — RivalCo">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800 rounded-xl p-3">
              <div className="text-slate-500 text-xs mb-2">Pricing History</div>
              <div className="space-y-1">
                {[['Jun 1', '$99/mo', ''], ['Jun 18', '$79/mo', '↓ 20% drop']].map(([d, p, n]) => (
                  <div key={d} className="flex justify-between text-xs">
                    <span className="text-slate-400">{d}</span>
                    <span className="text-white">{p}</span>
                    {n && <span className="text-red-400">{n}</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <div className="text-slate-500 text-xs mb-2">Review Trend</div>
              <div className="space-y-1">
                {[['Apr', '4.3★'], ['May', '4.1★'], ['Jun', '3.9★ ↓']].map(([m, r]) => (
                  <div key={m} className="flex justify-between text-xs">
                    <span className="text-slate-400">{m}</span>
                    <span className={r.includes('↓') ? 'text-red-400' : 'text-amber-400'}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-2 bg-violet-900/30 border border-violet-700/40 rounded-xl p-3">
              <div className="text-violet-300 text-xs font-medium mb-1">🤖 AI Analysis</div>
              <div className="text-violet-200 text-xs leading-relaxed">RivalCo dropped pricing 20% and their reviews are declining — likely a quality issue. Opportunity: highlight your quality difference in your next LinkedIn post.</div>
            </div>
          </div>
        </MockupFrame>
      </Step>

      <Step n={3} title="Use the Benchmark tool">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Competitors → Benchmark</strong> to see a side-by-side comparison: your score vs competitors across reviews, content activity, pricing, and digital presence.
        </p>
        <MockupFrame title="Benchmark — You vs Competitors">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-500 font-normal">Metric</th>
                  <th className="text-center py-2 text-violet-400 font-semibold">You</th>
                  <th className="text-center py-2 text-slate-400 font-normal">RivalCo</th>
                  <th className="text-center py-2 text-slate-400 font-normal">FastFitness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[
                  { m: 'Review Rating', you: '4.7★', a: '3.9★', b: '3.8★' },
                  { m: 'Content/week', you: '5', a: '8', b: '3' },
                  { m: 'Health Score', you: '78', a: '65', b: '58' },
                  { m: 'Price range', you: '$99', a: '$79', b: '$89' },
                ].map(r => (
                  <tr key={r.m}>
                    <td className="py-2 text-slate-400">{r.m}</td>
                    <td className="py-2 text-center text-white font-medium">{r.you}</td>
                    <td className="py-2 text-center text-slate-400">{r.a}</td>
                    <td className="py-2 text-center text-slate-400">{r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function ReviewContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Review Management connects your Google Business, App Store, and review platforms. AI generates responses for every review so you can stay at 100% response rate.
      </p>

      <Step n={1} title="Connect review sources">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Reviews → Connect Source</strong>. Connect Google Business by entering your Google Business Profile URL. App Store and Play Store can be connected via App ID.
        </p>
        <MockupFrame title="Reviews — Sources">
          <div className="space-y-2">
            {[
              { source: 'Google Business', reviews: 48, avg: '4.7★', status: 'connected' },
              { source: 'App Store', reviews: 12, avg: '4.5★', status: 'connected' },
              { source: 'Trustpilot', reviews: 0, avg: '—', status: 'connect' },
            ].map(s => (
              <div key={s.source} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <div className="flex-1">
                  <div className="text-slate-200 text-xs font-medium">{s.source}</div>
                  {s.status === 'connected' && <div className="text-slate-500 text-xs">{s.reviews} reviews · {s.avg}</div>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'connected' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-violet-900/40 text-violet-400'}`}>
                  {s.status === 'connected' ? '✓ Connected' : '+ Connect'}
                </span>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>

      <Step n={2} title="Respond to reviews with AI">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          New reviews appear in the queue. For each review, the AI drafts a response. Review it, edit if needed, then click <strong className="text-white">Publish Response</strong>. You can approve all or one at a time.
        </p>
        <MockupFrame title="Reviews — Response Queue">
          <div className="space-y-3">
            {[
              {
                author: 'Sarah M.', stars: 5, text: 'Absolutely love the products! My energy levels have improved so much after 3 weeks.',
                response: 'Thank you so much, Sarah! We\'re thrilled to hear about your improved energy levels — that\'s exactly why we do what we do. 🌿',
              },
              {
                author: 'J.M.', stars: 1, text: 'Shipping took 3 weeks and the packaging was damaged.',
                response: 'We\'re truly sorry, J.M. This is not the standard we hold ourselves to. Please reach out to support@bloomwellness.com and we\'ll make this right immediately.',
              },
            ].map((r, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-amber-400 text-xs">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</div>
                  <div className="text-white text-xs font-medium">{r.author}</div>
                </div>
                <p className="text-slate-400 text-xs mb-2 italic">&ldquo;{r.text}&rdquo;</p>
                <div className="bg-violet-950/40 border border-violet-800/30 rounded-lg p-2">
                  <div className="text-violet-400 text-xs font-medium mb-1">🤖 AI Draft Response:</div>
                  <p className="text-violet-200 text-xs leading-relaxed">{r.response}</p>
                </div>
                <div className="flex gap-2 mt-2">
                  <button className="text-xs px-3 py-1 bg-slate-700 text-slate-300 rounded">Edit</button>
                  <button className="text-xs px-3 py-1 bg-emerald-700 text-white rounded ml-auto">Publish Response</button>
                </div>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>Respond to negative reviews within 2 hours. Studies show that a fast, professional response to negative reviews converts 33% of unhappy reviewers into repeat customers.</Tip>
      </Step>

      <Step n={3} title="Track rating trends">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          The Reviews dashboard shows your average rating over time and compares it against your tracked competitors.
        </p>
        <MockupFrame title="Reviews — Trend">
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[{ l: 'Avg Rating', v: '4.7★', c: 'text-amber-400' }, { l: 'Response Rate', v: '100%', c: 'text-emerald-400' }, { l: 'New This Month', v: '+14', c: 'text-white' }].map(s => (
              <div key={s.l} className="bg-slate-800 rounded-xl p-3 text-center">
                <div className="text-slate-500 text-xs">{s.l}</div>
                <div className={`font-bold text-sm mt-1 ${s.c}`}>{s.v}</div>
              </div>
            ))}
          </div>
          <div className="bg-slate-800 rounded-xl p-3">
            <div className="text-slate-500 text-xs mb-2">Rating vs Competitors</div>
            {[{ name: 'You', r: 4.7, w: 94 }, { name: 'RivalCo', r: 3.9, w: 78 }, { name: 'FastFitness', r: 3.8, w: 76 }].map(c => (
              <div key={c.name} className="mb-1.5">
                <div className="flex justify-between text-xs mb-0.5"><span className="text-slate-400">{c.name}</span><span className={c.name === 'You' ? 'text-white font-medium' : 'text-slate-400'}>{c.r}★</span></div>
                <div className="bg-slate-700 rounded-full h-1.5"><div className={`${c.name === 'You' ? 'bg-amber-400' : 'bg-slate-600'} h-1.5 rounded-full`} style={{ width: `${c.w}%` }} /></div>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function GoalsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Set revenue, leads, and content targets. CooVex tracks them automatically and alerts you when you&apos;re off-track — before it&apos;s too late to course-correct.
      </p>

      <Step n={1} title="Create a goal">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Goals → New Goal</strong>. Choose a category (Revenue, Leads, Content, Reviews), set a target, unit, and deadline. The AI tracks progress daily.
        </p>
        <MockupFrame title="Goals — New Goal">
          <div className="max-w-sm mx-auto space-y-3 py-2">
            {[
              { label: 'Category', val: 'Revenue' },
              { label: 'Goal Title', val: 'Reach $25,000 MRR' },
              { label: 'Target Value', val: '$25,000' },
              { label: 'Deadline', val: 'September 30, 2026' },
              { label: 'Auto-track from', val: 'Stripe (connected)' },
            ].map(f => (
              <div key={f.label}>
                <div className="text-slate-500 text-xs mb-1">{f.label}</div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">{f.val}</div>
              </div>
            ))}
            <div className="bg-violet-600 text-white text-sm font-medium text-center py-2.5 rounded-lg">Create Goal</div>
          </div>
        </MockupFrame>
      </Step>

      <Step n={2} title="Track progress on the Goals dashboard">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          All goals appear on the Goals dashboard with real-time progress bars. Red = at risk. Amber = on track. Green = ahead of pace.
        </p>
        <MockupFrame title="Goals Dashboard">
          <div className="space-y-3">
            {[
              { title: '$25K MRR by Sep 30', current: 18200, target: 25000, status: 'on-track' },
              { title: '50 new leads this month', current: 28, target: 50, status: 'at-risk' },
              { title: '20 posts in June', current: 18, target: 20, status: 'ahead' },
            ].map(g => {
              const pct = Math.round((g.current / g.target) * 100)
              const color = g.status === 'ahead' ? 'bg-emerald-500' : g.status === 'on-track' ? 'bg-blue-500' : 'bg-red-500'
              const label = g.status === 'ahead' ? '🟢 Ahead' : g.status === 'on-track' ? '🔵 On Track' : '🔴 At Risk'
              return (
                <div key={g.title} className="bg-slate-800 rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-slate-200 text-xs font-medium">{g.title}</div>
                    <div className="text-xs">{label}</div>
                  </div>
                  <div className="bg-slate-700 rounded-full h-2 mb-1">
                    <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{typeof g.current === 'number' && g.current > 100 ? `$${g.current.toLocaleString()}` : g.current} / {typeof g.target === 'number' && g.target > 100 ? `$${g.target.toLocaleString()}` : g.target}</span>
                    <span>{pct}% complete</span>
                  </div>
                </div>
              )
            })}
          </div>
        </MockupFrame>
        <Tip>The AI sends you a Slack or email alert when a goal drops from &ldquo;On Track&rdquo; to &ldquo;At Risk&rdquo; — you get time to intervene before the month ends.</Tip>
      </Step>
    </>
  )
}

function AiCoachContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The AI Coach is a chat interface connected to your business data. Ask it anything — strategy questions, writing help, or data analysis.
      </p>

      <Step n={1} title="Open the AI Coach">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Click the <strong className="text-white">AI Coach</strong> button in the sidebar or the chat bubble in the bottom-right of any page. The coach has context from your entire CooVex profile — leads, reviews, competitors, content.
        </p>
        <MockupFrame title="AI Coach Chat">
          <div className="max-w-sm mx-auto space-y-3">
            {[
              { role: 'user', text: 'Why did my lead score drop this week?' },
              { role: 'ai', text: 'Your lead score dropped from 82 to 71 this week. The main causes:\n• 3 leads went 7+ days without contact (score decay)\n• 2 high-score leads marked as lost\n• No new warm inbound leads this week\n\nAction: Re-engage your 3 stale leads now. I\'ve drafted a follow-up email — want me to show it?' },
              { role: 'user', text: 'Yes, show me the email' },
            ].map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                  {msg.role === 'ai' && <span className="text-violet-400 font-medium block mb-1">🤖 CooVex Agent</span>}
                  {msg.text}
                </div>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-600 text-xs">Ask anything about your business...</div>
              <button className="bg-violet-600 text-white px-3 rounded-lg text-xs">↑</button>
            </div>
          </div>
        </MockupFrame>
      </Step>

      <Step n={2} title="Example prompts to try">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          The AI Coach is most powerful when you give it specific context. Here are high-value prompts to get you started:
        </p>
        <div className="space-y-2">
          {[
            'Write 5 LinkedIn post ideas for this week based on my top-performing content',
            'Which leads should I follow up with today and why?',
            'Analyze my competitor\'s pricing change — what should I do?',
            'My Google rating dropped from 4.5 to 4.2 — what\'s causing it?',
            'Write a proposal for a client in the healthcare industry',
            'What are the 3 biggest opportunities in my business right now?',
          ].map((prompt, i) => (
            <div key={i} className="flex items-start gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-violet-400 text-xs flex-shrink-0 mt-0.5">▷</span>
              <p className="text-slate-300 text-sm italic">&ldquo;{prompt}&rdquo;</p>
            </div>
          ))}
        </div>
        <Tip>The more you use CooVex, the smarter the AI Coach becomes. After 30 days of data, its answers are significantly more accurate and personalized to your business.</Tip>
      </Step>
    </>
  )
}

function CampaignsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Email Campaigns let you send broadcast emails or drip sequences to your leads. AI writes the content, you choose the audience and schedule.
      </p>

      <Step n={1} title="Create a drip campaign">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Campaigns → Drip Sequences</strong>. Click <strong className="text-white">New Drip</strong>. Choose a trigger (lead added, lead score drops, deal stage changes) and let AI generate the email sequence.
        </p>
        <MockupFrame title="Campaigns — Drip Sequence Builder">
          <div className="space-y-2">
            <div className="bg-slate-800 rounded-xl p-3">
              <div className="text-slate-400 text-xs font-medium mb-2">Trigger</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-violet-500" />
                <div className="text-slate-300 text-xs">Lead Score drops below 50 — enter cold nurture</div>
              </div>
            </div>
            {[
              { day: 'Day 1', subject: 'Quick question about [Company]', type: 'Intro' },
              { day: 'Day 4', subject: 'How [Company] could save 5 hours/week', type: 'Value' },
              { day: 'Day 10', subject: 'Case study: See how [Industry] companies grow with CooVex', type: 'Proof' },
              { day: 'Day 18', subject: 'One last thing...', type: 'Breakup' },
            ].map((email, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-xl px-3 py-2.5">
                <div className="w-12 text-violet-400 text-xs font-medium">{email.day}</div>
                <div className="flex-1">
                  <div className="text-slate-200 text-xs">{email.subject}</div>
                  <div className="text-slate-600 text-xs">{email.type}</div>
                </div>
                <button className="text-xs text-slate-500 border border-slate-700 px-2 py-0.5 rounded">Edit</button>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>

      <Step n={2} title="Review AI-written emails">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Click any email in the sequence to see the AI draft. Personalization tokens like <strong className="text-white">[Company]</strong> and <strong className="text-white">[Industry]</strong> are auto-filled from lead data.
        </p>
        <MockupFrame title="Email Draft — Day 1">
          <div className="max-w-sm mx-auto space-y-2">
            <div className="text-slate-500 text-xs">Subject: Quick question about Bloom Wellness Co.</div>
            <div className="border-t border-slate-700 pt-3 text-slate-300 text-xs leading-relaxed space-y-2">
              <p>Hi Sarah,</p>
              <p>I noticed Bloom Wellness Co. has been growing its online presence — great work on the recent LinkedIn posts.</p>
              <p>We work with health & wellness businesses to automate competitor tracking and review management. Worth 15 minutes?</p>
              <p>Best,<br />Alex</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button className="text-xs px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg">Regenerate</button>
              <button className="text-xs px-3 py-1.5 bg-emerald-700 text-white rounded-lg ml-auto">Approve</button>
            </div>
          </div>
        </MockupFrame>
        <Tip>Keep drip emails short — 3–5 sentences max. Our data shows emails under 80 words get 40% higher reply rates.</Tip>
      </Step>
    </>
  )
}

function BusinessPlanContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The AI Business Plan Generator creates a complete, investor-ready business plan based on your product, market, and goals. Takes under 5 minutes.
      </p>

      <Step n={1} title="Enter your business details">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Tools → Business Plan</strong>. Enter your product/service description, target market, and revenue goal. The AI uses this plus your existing CooVex data to build the plan.
        </p>
        <MockupFrame title="Tools — Business Plan">
          <div className="max-w-sm mx-auto space-y-3 py-2">
            {[
              { label: 'Product / Service', val: 'Organic wellness supplements' },
              { label: 'Target Market', val: 'Health-conscious women, 25–45' },
              { label: '12-Month Revenue Goal', val: '$500,000' },
              { label: 'Primary Growth Channel', val: 'Instagram + LinkedIn' },
            ].map(f => (
              <div key={f.label}>
                <div className="text-slate-500 text-xs mb-1">{f.label}</div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">{f.val}</div>
              </div>
            ))}
            <div className="bg-violet-600 text-white text-sm font-medium text-center py-2.5 rounded-lg">Generate Business Plan ✨</div>
          </div>
        </MockupFrame>
      </Step>

      <Step n={2} title="Review the generated plan">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          The plan is organized into 7 sections: Executive Summary, Market Analysis, Product/Service, Marketing Strategy, Operations, Financial Projections, and Risk Assessment. Each section is editable.
        </p>
        <MockupFrame title="Business Plan — Bloom Wellness Co.">
          <div className="space-y-2">
            {[
              { section: 'Executive Summary', preview: 'Bloom Wellness Co. targets the $47B supplement market with organic...', done: true },
              { section: 'Market Analysis', preview: 'TAM: $47B. SAM: $2.3B (health-conscious women, US). SOM: $1.2M...', done: true },
              { section: 'Marketing Strategy', preview: 'Primary: Instagram content + influencer partnerships. Secondary...', done: true },
              { section: 'Financial Projections', preview: 'Month 1: $8,500 revenue. Month 6: $42,000. Month 12: $89,000...', done: true },
              { section: 'Risk Assessment', preview: 'Regulatory: FDA compliance for supplement claims. Mitigation...', done: false },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${s.done ? 'bg-emerald-500' : 'bg-slate-600 border border-slate-500'}`}>
                  {s.done && <span className="text-white text-xs">✓</span>}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-slate-200 text-xs font-medium">{s.section}</div>
                  <div className="text-slate-500 text-xs truncate">{s.preview}</div>
                </div>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>Download as PDF or share a read-only link with investors, advisors, or team members using the Export button in the top right.</Tip>
      </Step>
    </>
  )
}

function ProposalsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Generate professional client proposals in minutes. AI tailors each proposal to the client&apos;s industry, needs, and pain points.
      </p>

      <Step n={1} title="Create a new proposal">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Proposals → New Proposal</strong>. Select the client (from your Leads), choose your services, and set a price. The AI generates the full document.
        </p>
        <MockupFrame title="Proposals — New">
          <div className="max-w-sm mx-auto space-y-3 py-2">
            {[
              { label: 'Client', val: 'Marcus Chen · GrowthStack SaaS' },
              { label: 'Services', val: 'AI Business Agent — Growth Plan' },
              { label: 'Investment', val: '$1,200 setup + $149/month' },
              { label: 'Valid Until', val: 'July 10, 2026' },
            ].map(f => (
              <div key={f.label}>
                <div className="text-slate-500 text-xs mb-1">{f.label}</div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">{f.val}</div>
              </div>
            ))}
            <div className="bg-violet-600 text-white text-sm font-medium text-center py-2.5 rounded-lg">Generate Proposal</div>
          </div>
        </MockupFrame>
      </Step>

      <Step n={2} title="Send and track the proposal">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Click <strong className="text-white">Send</strong> to email the proposal directly, or copy the shareable link. Track when the client opens it, which sections they viewed, and for how long.
        </p>
        <MockupFrame title="Proposals — Tracking">
          <div className="space-y-2">
            <div className="bg-slate-800 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-300 font-medium">GrowthStack SaaS Proposal</span>
                <span className="text-amber-400">Viewed</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-500"><span>Sent</span><span>Jun 20, 2pm</span></div>
                <div className="flex justify-between text-slate-500"><span>First opened</span><span>Jun 20, 4:31pm ✓</span></div>
                <div className="flex justify-between text-slate-500"><span>Time spent</span><span>4m 22s</span></div>
                <div className="flex justify-between text-slate-500"><span>Most read section</span><span>Pricing & ROI</span></div>
              </div>
            </div>
            <div className="bg-violet-900/30 border border-violet-700/40 rounded-xl p-3 text-xs text-violet-200">
              🤖 Marcus spent 2+ minutes on Pricing — strong buying signal. Follow up now with a call-to-action.
            </div>
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function AnalyticsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Analytics shows you what&apos;s driving growth — which channels bring the most leads, which content converts, and how revenue flows from first touch to close.
      </p>

      <Step n={1} title="Read the Attribution report">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Analytics → Attribution</strong>. See each lead&apos;s first-touch channel, last-touch channel, and all touchpoints in between.
        </p>
        <MockupFrame title="Analytics — Attribution">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[{ l: 'Top Channel', v: 'LinkedIn', c: 'text-blue-400' }, { l: 'Avg Touchpoints', v: '3.2', c: 'text-white' }, { l: 'Fastest Close', v: 'Email (6d)', c: 'text-emerald-400' }].map(s => (
                <div key={s.l} className="bg-slate-800 rounded-xl p-2.5 text-center">
                  <div className="text-slate-500 text-xs">{s.l}</div>
                  <div className={`font-bold text-sm mt-1 ${s.c}`}>{s.v}</div>
                </div>
              ))}
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <div className="text-slate-400 text-xs font-medium mb-2">Revenue by Channel</div>
              {[
                { ch: 'LinkedIn', rev: '$14,200', pct: 58 },
                { ch: 'Organic Search', rev: '$6,800', pct: 28 },
                { ch: 'Email', rev: '$3,500', pct: 14 },
              ].map(c => (
                <div key={c.ch} className="mb-2">
                  <div className="flex justify-between text-xs mb-0.5"><span className="text-slate-400">{c.ch}</span><span className="text-white">{c.rev}</span></div>
                  <div className="bg-slate-700 rounded-full h-1.5"><div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${c.pct}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function IntegrationsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Connect your existing tools to CooVex. The more integrations active, the more data the AI agent has to work with.
      </p>

      <Step n={1} title="Connect a CRM (HubSpot or Salesforce)">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Settings → Integrations</strong>. Click <strong className="text-white">HubSpot</strong> → <strong className="text-white">Connect</strong>. Authorize via OAuth. Contacts sync automatically within 5 minutes.
        </p>
        <MockupFrame title="Settings — Integrations">
          <div className="space-y-2">
            {[
              { name: 'HubSpot', cat: 'CRM', icon: '🔶', status: 'connected', detail: '142 contacts synced' },
              { name: 'Salesforce', cat: 'CRM', icon: '☁️', status: 'available', detail: '' },
              { name: 'Google Analytics', cat: 'Analytics', icon: '📊', status: 'connected', detail: 'Last sync: 2h ago' },
              { name: 'LinkedIn', cat: 'Social', icon: '💼', status: 'connected', detail: 'Posts & analytics enabled' },
              { name: 'Stripe', cat: 'Billing', icon: '💳', status: 'available', detail: '' },
            ].map(i => (
              <div key={i.name} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <span className="text-xl">{i.icon}</span>
                <div className="flex-1">
                  <div className="text-slate-200 text-xs font-medium">{i.name} <span className="text-slate-600">· {i.cat}</span></div>
                  {i.detail && <div className="text-slate-500 text-xs">{i.detail}</div>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${i.status === 'connected' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                  {i.status === 'connected' ? '✓ Connected' : 'Connect →'}
                </span>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>Connect Stripe to enable automatic revenue tracking in your Goals and Finance dashboards — no manual input needed.</Tip>
      </Step>
    </>
  )
}

function TrendsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The Trends feed filters industry news, viral hashtags, and emerging opportunities — showing only what&apos;s relevant to your business.
      </p>

      <Step n={1} title="Read your Trends feed">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Trends</strong>. The feed updates daily with AI-curated news and topics relevant to your industry, keywords, and competitors.
        </p>
        <MockupFrame title="Trends — Your Industry">
          <div className="space-y-2">
            {[
              { tag: '#MindfulWellness', type: 'Trending Hashtag', engagement: '2.4M posts', action: 'Post today' },
              { tag: 'Study: Supplement transparency driving loyalty', type: 'Industry News', engagement: 'High relevance', action: 'Use in content' },
              { tag: 'Competitor RivalCo mentioned in Forbes article', type: 'Competitor Signal', engagement: 'Monitor', action: 'View article' },
            ].map((t, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="text-slate-200 text-xs font-medium">{t.tag}</div>
                    <div className="text-slate-500 text-xs">{t.type} · {t.engagement}</div>
                  </div>
                  <button className="text-xs text-violet-400 border border-violet-800/50 px-2 py-0.5 rounded flex-shrink-0">{t.action}</button>
                </div>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>When you see a trending hashtag relevant to your niche, click <strong>Post Today</strong> to open the Content editor with the trend pre-loaded. First-mover advantage matters.</Tip>
      </Step>
    </>
  )
}

function AgencyContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The Agency plan lets you resell CooVex under your own brand. Add clients, generate white-label reports, and manage up to 15 businesses from one dashboard.
      </p>

      <Step n={1} title="Set up your white label brand">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Agency → Branding</strong>. Upload your logo, set your brand colors, and configure your custom domain. Clients see your brand everywhere.
        </p>
        <MockupFrame title="Agency — Brand Settings">
          <div className="max-w-sm mx-auto space-y-3 py-2">
            {[{ label: 'Agency Name', val: 'Apex Digital Agency' }, { label: 'Logo', val: 'apex-logo.png ✓' }, { label: 'Primary Color', val: '#2563EB (Blue)' }, { label: 'Custom Domain', val: 'app.apexdigital.com' }].map(f => (
              <div key={f.label}>
                <div className="text-slate-500 text-xs mb-1">{f.label}</div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">{f.val}</div>
              </div>
            ))}
            <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-lg px-3 py-2 text-emerald-300 text-xs">✓ Domain verified · SSL active</div>
          </div>
        </MockupFrame>
      </Step>

      <Step n={2} title="Add and manage client workspaces">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Agency → Clients</strong>. Create a new workspace for each client. Each client gets their own isolated data, branding, and login.
        </p>
        <MockupFrame title="Agency — Client Workspaces">
          <div className="space-y-2">
            {[
              { name: 'Bloom Wellness Co.', plan: 'Growth', health: 78, status: 'Active' },
              { name: 'GrowthStack SaaS', plan: 'Scale', health: 85, status: 'Active' },
              { name: 'FastFitness Studio', plan: 'Starter', health: 52, status: 'Trial' },
            ].map(c => (
              <div key={c.name} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-white text-xs font-bold">{c.name[0]}</div>
                <div className="flex-1">
                  <div className="text-slate-200 text-xs font-medium">{c.name}</div>
                  <div className="text-slate-500 text-xs">{c.plan} plan</div>
                </div>
                <div className={`text-xs font-medium ${c.health >= 75 ? 'text-emerald-400' : c.health >= 60 ? 'text-blue-400' : 'text-amber-400'}`}>{c.health}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'Active' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-amber-900/40 text-amber-400'}`}>{c.status}</span>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>Generate a monthly client report from the Reports section. It shows competitor moves, health score trends, and content performance — branded with your agency logo.</Tip>
      </Step>
    </>
  )
}

function NpsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Run NPS surveys to measure customer satisfaction. CooVex identifies your promoters and detractors and suggests specific retention actions.
      </p>

      <Step n={1} title="Send an NPS survey">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">NPS</strong>. Click <strong className="text-white">Send Survey</strong>. Choose your audience (all customers, new customers, or customers inactive for 30+ days). AI writes the survey email.
        </p>
        <MockupFrame title="NPS — Results">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[{ l: 'NPS Score', v: '+42', c: 'text-emerald-400' }, { l: 'Promoters', v: '62%', c: 'text-emerald-400' }, { l: 'Detractors', v: '20%', c: 'text-red-400' }].map(s => (
                <div key={s.l} className="bg-slate-800 rounded-xl p-2.5 text-center">
                  <div className="text-slate-500 text-xs">{s.l}</div>
                  <div className={`font-bold text-sm mt-1 ${s.c}`}>{s.v}</div>
                </div>
              ))}
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <div className="text-slate-400 text-xs font-medium mb-2">Recent Responses</div>
              {[
                { score: 9, comment: 'Love how easy the competitor tracking is!' },
                { score: 2, comment: 'Setup was confusing. Support took 3 days to reply.' },
                { score: 10, comment: 'The daily briefing changed how I manage my business.' },
              ].map((r, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${r.score >= 9 ? 'bg-emerald-600 text-white' : r.score >= 7 ? 'bg-amber-600 text-white' : 'bg-red-700 text-white'}`}>{r.score}</div>
                  <p className="text-slate-400 text-xs leading-relaxed">{r.comment}</p>
                </div>
              ))}
            </div>
          </div>
        </MockupFrame>
        <Tip>For detractors (scores 0–6), the AI drafts a personal outreach email. Reach out within 48 hours — 40% of detractors who receive a personal response become neutral or promoter within 30 days.</Tip>
      </Step>
    </>
  )
}

// ─── NEW content functions ────────────────────────────────────────────────────

function AgentReportContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Every morning, CooVex generates a personalized Daily Agent Report — a full briefing on what happened yesterday, what matters today, and what to do about it.
      </p>
      <Step n={1} title="Where to find the report">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Agent → Daily Report</strong> in the sidebar. The report is generated at 6am your local time. It&apos;s also emailed to you automatically if email delivery is enabled in <strong className="text-white">Settings → Notifications</strong>.
        </p>
        <MockupFrame title="app.coovex.com/agent/report">
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-white font-semibold text-sm">Daily Report — Tuesday, June 24</div>
              <div className="text-slate-500 text-xs">Generated 6:02am</div>
            </div>
            {[
              { section: '📊 Business Health', content: 'Score: 78 (+3 from yesterday). Improving.', color: 'border-blue-800/40 bg-blue-950/20' },
              { section: '⭐ Reviews', content: '3 new reviews. Avg: 4.7★. 1 negative needs response.', color: 'border-amber-800/40 bg-amber-950/20' },
              { section: '🏆 Competitors', content: 'RivalCo posted 4 times — above their average. Monitor.', color: 'border-red-800/40 bg-red-950/20' },
              { section: '🎯 Leads', content: '5 new leads. 2 scored 80+. Follow up today.', color: 'border-emerald-800/40 bg-emerald-950/20' },
              { section: '📅 Today\'s Top Actions', content: '1. Respond to 1-star review 2. Post on LinkedIn 3. Follow up Marcus Chen', color: 'border-violet-800/40 bg-violet-950/20' },
            ].map((s, i) => (
              <div key={i} className={`border rounded-xl p-3 ${s.color}`}>
                <div className="text-white text-xs font-medium mb-0.5">{s.section}</div>
                <div className="text-slate-400 text-xs">{s.content}</div>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Customize what appears in the report">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Settings → Agent</strong> to choose which sections appear in your daily report, set your preferred delivery time, and toggle email delivery on or off.
        </p>
        <MockupFrame title="Settings — Agent Report Config">
          <div className="max-w-sm mx-auto space-y-2 py-2">
            {['Business Health Score', 'New Reviews', 'Competitor Activity', 'Lead Summary', 'Goal Progress', 'Top 5 Actions', 'Industry Trends'].map((item, i) => (
              <div key={item} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                <span className="text-slate-300 text-xs">{item}</span>
                <div className={`w-8 h-4 rounded-full ${i === 5 ? 'bg-slate-600' : 'bg-violet-600'} relative`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${i === 5 ? 'left-0.5' : 'left-4'}`} />
                </div>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>Keep &quot;Top 5 Actions&quot; enabled at all times — it&apos;s the highest-value section. The agent ranks actions by business impact so you always know what to work on first.</Tip>
      </Step>
    </>
  )
}

function NotificationsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        CooVex sends real-time alerts the moment something important happens — a competitor move, a new negative review, a goal at risk. This guide shows how to configure them.
      </p>
      <Step n={1} title="Configure notification channels">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Settings → Notifications</strong>. Enable email, browser push, or Slack. For Slack, paste your Slack webhook URL and select the channel.
        </p>
        <MockupFrame title="Settings — Notifications">
          <div className="space-y-2 max-w-sm mx-auto py-2">
            {[
              { channel: '📧 Email', detail: 'md.fhforhad@gmail.com', on: true },
              { channel: '🔔 Browser Push', detail: 'Chrome — enabled', on: true },
              { channel: '💬 Slack', detail: '#coovex-alerts channel', on: true },
              { channel: '📱 Mobile Push', detail: 'iOS App — coming soon', on: false },
            ].map(c => (
              <div key={c.channel} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <div className="flex-1">
                  <div className="text-slate-200 text-xs font-medium">{c.channel}</div>
                  <div className="text-slate-500 text-xs">{c.detail}</div>
                </div>
                <div className={`w-8 h-4 rounded-full ${c.on ? 'bg-violet-600' : 'bg-slate-700'} relative cursor-pointer`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${c.on ? 'left-4' : 'left-0.5'}`} />
                </div>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Set alert triggers and thresholds">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Choose exactly what triggers an alert. You can set thresholds — for example, only alert if a competitor drops price by more than 10%, or only send a review alert for 1–2 star reviews.
        </p>
        <MockupFrame title="Notification Triggers">
          <div className="space-y-2">
            {[
              { event: 'New negative review (1–2 stars)', trigger: 'Immediately', on: true },
              { event: 'Competitor price change > 10%', trigger: 'Immediately', on: true },
              { event: 'Goal drops to At Risk', trigger: 'Same day', on: true },
              { event: 'Lead score changes to 80+', trigger: 'Immediately', on: true },
              { event: 'Daily Agent Report ready', trigger: '6:00am', on: true },
              { event: 'New inbound lead', trigger: 'Every 2 hours', on: false },
            ].map((n, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2">
                <div className="flex-1">
                  <div className="text-slate-300 text-xs">{n.event}</div>
                  <div className="text-slate-600 text-xs">{n.trigger}</div>
                </div>
                <div className={`w-8 h-4 rounded-full ${n.on ? 'bg-violet-600' : 'bg-slate-700'} relative`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white ${n.on ? 'left-4' : 'left-0.5'}`} />
                </div>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>Set Quiet Hours (e.g., 10pm–7am) in Settings → Notifications so you don&apos;t get woken up by non-urgent alerts. Urgent alerts (new negative reviews, critical signals) override quiet hours by default.</Tip>
      </Step>
    </>
  )
}

function ContentPerformanceContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The Content Performance section shows you how every post performed — impressions, engagement, clicks, and conversions — so you can double down on what works.
      </p>
      <Step n={1} title="View post performance">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Content → Performance</strong>. All published posts appear with key metrics. Click any post to see the full analytics breakdown.
        </p>
        <MockupFrame title="Content Performance">
          <div className="space-y-2">
            {[
              { title: 'Client transformation story: Meet Sarah', platform: 'LinkedIn', reach: '4,800', eng: '9.2%', clicks: '168', leads: 3 },
              { title: '5 signs your routine needs a reset', platform: 'Instagram', reach: '3,200', eng: '6.1%', clicks: '89', leads: 1 },
              { title: 'Behind the scenes: How we source', platform: 'LinkedIn', reach: '2,100', eng: '4.4%', clicks: '52', leads: 0 },
              { title: 'The #1 supplement mistake', platform: 'Facebook', reach: '1,500', eng: '3.8%', clicks: '34', leads: 0 },
            ].map((p, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-slate-200 text-xs font-medium leading-snug">{p.title}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{p.platform}</div>
                  </div>
                  {p.leads > 0 && <span className="text-emerald-400 text-xs bg-emerald-900/30 px-1.5 py-0.5 rounded flex-shrink-0">{p.leads} leads</span>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div><div className="text-white font-medium">{p.reach}</div><div className="text-slate-600">reach</div></div>
                  <div><div className="text-violet-400 font-medium">{p.eng}</div><div className="text-slate-600">engagement</div></div>
                  <div><div className="text-blue-400 font-medium">{p.clicks}</div><div className="text-slate-600">clicks</div></div>
                </div>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Identify your best content type">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          The AI analyzes all your posts and surfaces patterns: which format (story, list, opinion, tips) drives the most engagement for your audience.
        </p>
        <MockupFrame title="Content Insights">
          <div className="bg-slate-800/60 rounded-xl p-4">
            <div className="text-violet-400 text-xs font-medium mb-3">🤖 AI Content Insights</div>
            <div className="space-y-2.5">
              {[
                { insight: 'Social proof posts (client stories) get 2.4× more leads than educational posts', type: 'Best for leads' },
                { insight: 'LinkedIn posts published Tuesday 9–11am get 60% more impressions', type: 'Best time' },
                { insight: 'Posts with 1 question at the end get 3× more comments', type: 'Engagement tip' },
                { insight: 'Your top 3 hashtags: #wellness #mindset #growthmindset', type: 'Top hashtags' },
              ].map((ins, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-violet-500 text-xs flex-shrink-0 mt-0.5">•</span>
                  <div>
                    <div className="text-xs text-emerald-400 font-medium">{ins.type}</div>
                    <div className="text-slate-300 text-xs leading-relaxed">{ins.insight}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function LeadFunnelContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The Lead Funnel shows conversion rates between every pipeline stage. It pinpoints exactly where you&apos;re losing leads — so you can fix the right problem.
      </p>
      <Step n={1} title="Read the funnel view">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Leads → Funnel</strong>. The funnel shows how many leads enter each stage and what percentage advance to the next. Red stages are your biggest drop-off points.
        </p>
        <MockupFrame title="Leads — Funnel View">
          <div className="max-w-xs mx-auto space-y-1.5">
            {[
              { stage: 'New Leads', count: 124, pct: 100, color: 'bg-slate-600', next: '61% advance' },
              { stage: 'Discovery Call', count: 76, pct: 61, color: 'bg-blue-600', next: '47% advance' },
              { stage: 'Proposal Sent', count: 36, pct: 29, color: 'bg-violet-600', next: '61% advance' },
              { stage: 'Negotiation', count: 22, pct: 18, color: 'bg-amber-600', next: '64% advance' },
              { stage: 'Closed Won', count: 14, pct: 11, color: 'bg-emerald-600', next: '' },
            ].map((s, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-300">{s.stage}</span>
                  <span className="text-slate-500">{s.count} leads</span>
                </div>
                <div className="bg-slate-800 rounded h-6 relative overflow-hidden">
                  <div className={`${s.color} h-full rounded transition-all`} style={{ width: `${s.pct}%` }} />
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-white text-xs font-medium">{s.pct}%</span>
                    {s.next && <span className="ml-auto text-slate-300 text-xs">{s.next}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Act on AI bottleneck analysis">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Below the funnel, the AI explains why drop-off is happening at each stage and gives specific recommendations to fix it.
        </p>
        <MockupFrame title="Funnel — AI Analysis">
          <div className="space-y-2">
            {[
              { stage: 'New → Discovery (39% drop)', severity: 'high', fix: 'Average response time is 18 hours. Leads go cold after 4 hours. Set up instant auto-reply + follow up within 1 hour.' },
              { stage: 'Proposal → Negotiation (39% drop)', severity: 'medium', fix: 'Proposals are sent without a scheduled follow-up call. Add a Calendly link to every proposal for a 15-min review call.' },
            ].map((a, i) => (
              <div key={i} className={`rounded-xl p-3 border ${a.severity === 'high' ? 'border-red-800/40 bg-red-950/20' : 'border-amber-800/40 bg-amber-950/20'}`}>
                <div className={`text-xs font-medium mb-1 ${a.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`}>{a.stage}</div>
                <div className="text-slate-300 text-xs leading-relaxed">{a.fix}</div>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function ColdLeadsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Leads scored below 40 go into the Cold Leads section. Instead of discarding them, CooVex nurtures them automatically with AI-written sequences and alerts you when they heat back up.
      </p>
      <Step n={1} title="View your cold leads">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Leads → Cold Leads</strong>. These are leads with a score below 40 or who haven&apos;t engaged in 30+ days. They are automatically enrolled in the cold nurture drip sequence.
        </p>
        <MockupFrame title="Leads — Cold Leads">
          <div className="space-y-2">
            {[
              { name: 'Tom Bradley', co: 'Bradley Consulting', score: 28, days: 45, status: 'Nurture Day 12' },
              { name: 'Emma Torres', co: 'Torres Design Studio', score: 35, days: 31, status: 'Nurture Day 3' },
              { name: 'Raj Patel', co: 'Patel Imports', score: 19, days: 62, status: 'Unresponsive' },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold">{l.name[0]}</div>
                <div className="flex-1">
                  <div className="text-slate-200 text-xs font-medium">{l.name}</div>
                  <div className="text-slate-500 text-xs">{l.co} · {l.days}d inactive</div>
                </div>
                <div className="text-red-400 text-xs font-medium">{l.score}</div>
                <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{l.status}</span>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Re-engagement alerts">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          When a cold lead opens an email, visits your website, or their company shows a buying signal, CooVex immediately alerts you and moves them back to the active pipeline.
        </p>
        <MockupFrame title="Cold Lead Re-engagement Alert">
          <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-xl p-4">
            <div className="text-emerald-400 text-xs font-bold mb-2">🔥 Cold Lead Heating Up!</div>
            <div className="text-emerald-200 text-sm font-medium mb-1">Emma Torres — Torres Design Studio</div>
            <div className="space-y-1 text-xs text-emerald-300/80">
              <div>• Opened your email (Day 3 nurture sequence) — 2h ago</div>
              <div>• Clicked pricing page link — 1h ago</div>
              <div>• Visited your website 3× today</div>
            </div>
            <div className="mt-3 bg-emerald-900/40 rounded-lg p-2.5">
              <div className="text-emerald-200 text-xs font-medium">🤖 Recommended action:</div>
              <div className="text-emerald-300/80 text-xs mt-0.5">Call Emma within the next 2 hours. She&apos;s actively evaluating — this is a live buying window.</div>
            </div>
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function FindLeadsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Lead Finder helps you discover new prospective customers that match your ideal customer profile — even before they know they need you.
      </p>
      <Step n={1} title="Define your ideal customer profile">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Leads → Find Leads</strong>. Set filters: industry, business size, country, and keywords. The AI searches for businesses that match your criteria.
        </p>
        <MockupFrame title="Lead Finder — Search">
          <div className="max-w-sm mx-auto space-y-3 py-2">
            {[
              { label: 'Industry', val: 'Health & Wellness' },
              { label: 'Business Size', val: '10–50 employees' },
              { label: 'Country', val: 'United States' },
              { label: 'Keywords', val: 'supplement, fitness, yoga studio' },
              { label: 'Exclude', val: 'Already in my CRM' },
            ].map(f => (
              <div key={f.label}>
                <div className="text-slate-500 text-xs mb-1">{f.label}</div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">{f.val}</div>
              </div>
            ))}
            <div className="bg-violet-600 text-white text-sm font-medium text-center py-2.5 rounded-lg">Find Leads →</div>
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Review and import leads">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Results show matching businesses with AI-estimated fit scores. Select the ones you want and click <strong className="text-white">Add to Leads</strong>. They enter your pipeline with a starting score and an auto-assigned nurture sequence.
        </p>
        <MockupFrame title="Lead Finder — Results">
          <div className="space-y-2">
            {[
              { name: 'PureGlow Wellness', loc: 'Austin, TX', size: '12 employees', fit: 88 },
              { name: 'Iron Republic Gym', loc: 'Denver, CO', size: '25 employees', fit: 82 },
              { name: 'ZenMind Studio', loc: 'Portland, OR', size: '8 employees', fit: 75 },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <input type="checkbox" className="w-3.5 h-3.5 accent-violet-500 flex-shrink-0" defaultChecked={i < 2} />
                <div className="flex-1">
                  <div className="text-slate-200 text-xs font-medium">{l.name}</div>
                  <div className="text-slate-500 text-xs">{l.loc} · {l.size}</div>
                </div>
                <div className={`text-xs font-bold ${l.fit >= 85 ? 'text-emerald-400' : 'text-blue-400'}`}>{l.fit} fit</div>
              </div>
            ))}
            <div className="bg-violet-600 text-white text-xs font-medium text-center py-2 rounded-lg">Add 2 Selected to Leads</div>
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function CompetitorBenchmarkContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The Benchmark tool gives you a side-by-side comparison of your business vs every competitor across 15 dimensions. Know your exact strengths and weaknesses at a glance.
      </p>
      <Step n={1} title="Open the Benchmark view">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Competitors → Benchmark</strong>. Select which competitors to compare against (default: all tracked). The comparison table populates automatically with live data.
        </p>
        <MockupFrame title="Competitor Benchmark">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 pr-3 text-slate-500 font-normal w-28">Metric</th>
                  <th className="text-center py-2 text-violet-400 font-semibold">You</th>
                  <th className="text-center py-2 text-slate-400 font-normal">RivalCo</th>
                  <th className="text-center py-2 text-slate-400 font-normal">FastFit</th>
                  <th className="text-center py-2 text-slate-400 font-normal">ZenWell</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[
                  { m: 'Review Rating', you: '4.7★', a: '3.9★', b: '3.8★', c: '4.6★' },
                  { m: 'Health Score', you: '78', a: '65', b: '58', c: '71' },
                  { m: 'Posts/week', you: '5', a: '8', b: '3', c: '4' },
                  { m: 'Response rate', you: '100%', a: '40%', b: '60%', c: '80%' },
                  { m: 'Price', you: '$99', a: '$79', b: '$89', c: '$110' },
                  { m: 'Review count', you: '48', a: '124', b: '31', c: '87' },
                ].map(r => (
                  <tr key={r.m}>
                    <td className="py-1.5 text-slate-400 pr-3">{r.m}</td>
                    <td className="py-1.5 text-center text-white font-medium">{r.you}</td>
                    <td className="py-1.5 text-center text-slate-400">{r.a}</td>
                    <td className="py-1.5 text-center text-slate-400">{r.b}</td>
                    <td className="py-1.5 text-center text-slate-400">{r.c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Read the AI gap analysis">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Below the table, the AI highlights your key advantages and the areas where competitors are beating you — with specific actions to close each gap.
        </p>
        <MockupFrame title="Benchmark — AI Gap Analysis">
          <div className="space-y-2">
            <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-xl p-3">
              <div className="text-emerald-400 text-xs font-medium mb-1.5">✅ Your Advantages</div>
              <div className="space-y-1 text-xs text-emerald-300/80">
                <div>• Best review rating (4.7★) — 0.8★ above nearest rival</div>
                <div>• 100% review response rate — others average 60%</div>
                <div>• Highest health score (78) in your competitive set</div>
              </div>
            </div>
            <div className="bg-red-950/20 border border-red-700/30 rounded-xl p-3">
              <div className="text-red-400 text-xs font-medium mb-1.5">⚡ Gaps to Close</div>
              <div className="space-y-1 text-xs text-red-300/80">
                <div>• RivalCo has 124 reviews vs your 48 — run a review request campaign</div>
                <div>• RivalCo posts 8×/week vs your 5× — increase posting frequency</div>
              </div>
            </div>
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function AppStoreReviewsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        If you have a mobile app, CooVex connects to the App Store and Google Play to pull in every review. AI drafts responses so you can reply to all of them in minutes.
      </p>
      <Step n={1} title="Connect your app listings">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Reviews → App Stores</strong>. Enter your Apple App Store App ID and/or Google Play package name. CooVex fetches all existing and new reviews automatically.
        </p>
        <MockupFrame title="Reviews — App Stores">
          <div className="max-w-sm mx-auto space-y-3 py-2">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🍎</span>
                <div>
                  <div className="text-white text-xs font-medium">Apple App Store</div>
                  <div className="text-slate-500 text-xs">Bloom Wellness App</div>
                </div>
                <span className="ml-auto text-xs text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">✓ Connected</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div><div className="text-white font-bold">4.5★</div><div className="text-slate-500">Rating</div></div>
                <div><div className="text-white font-bold">142</div><div className="text-slate-500">Reviews</div></div>
                <div><div className="text-amber-400 font-bold">8</div><div className="text-slate-500">Pending</div></div>
              </div>
            </div>
            <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">🤖</div>
              <div className="text-slate-400 text-xs">Connect Google Play</div>
              <div className="text-violet-400 text-xs mt-1">+ Add App ID</div>
            </div>
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Respond to app reviews with AI">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          All pending reviews appear in the queue. AI drafts a response for each one, adapting tone based on star rating. Approve and publish directly to the App Store — no copy-paste needed.
        </p>
        <MockupFrame title="App Store Review Queue">
          <div className="space-y-3">
            {[
              { stars: 5, user: 'wellnessfan22', text: 'Best wellness app I\'ve used. Simple, clean, and actually works!', resp: 'Thank you so much! We work hard to make wellness simple and effective — so glad it\'s working for you! 🙏' },
              { stars: 2, user: 'frustrated_user', text: 'App crashes every time I try to log a supplement. Unusable.', resp: 'We\'re so sorry about this! Our team has identified the crash bug and a fix is shipping in version 2.4.1 this week. Please email support@bloomwellness.com and we\'ll upgrade you to Premium free.' },
            ].map((r, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-amber-400 text-xs">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</div>
                  <div className="text-slate-400 text-xs">{r.user}</div>
                  <div className="text-slate-600 text-xs ml-auto">App Store</div>
                </div>
                <p className="text-slate-400 text-xs italic mb-2">&ldquo;{r.text}&rdquo;</p>
                <div className="bg-violet-950/40 border border-violet-800/30 rounded-lg p-2">
                  <div className="text-violet-400 text-xs font-medium mb-0.5">AI Draft:</div>
                  <p className="text-violet-200 text-xs">{r.resp}</p>
                </div>
                <button className="mt-2 w-full bg-emerald-700 text-white text-xs py-1.5 rounded-lg">Publish to App Store</button>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function ProductsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The Products section is your central catalog of everything you sell. Products link to leads, proposals, and revenue — giving the AI more context to score leads and attribute revenue accurately.
      </p>
      <Step n={1} title="Add your products and services">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Products</strong> in the sidebar. Click <strong className="text-white">Add Product</strong>. Enter the name, category, price, and description. You can add one-time products and recurring subscriptions.
        </p>
        <MockupFrame title="Products Catalog">
          <div className="space-y-2">
            {[
              { name: 'Starter Wellness Kit', type: 'One-time', price: '$49', leads: 12, rev: '$588' },
              { name: 'Monthly Supplement Box', type: 'Subscription', price: '$39/mo', leads: 28, rev: '$1,092/mo' },
              { name: 'Wellness Coaching (3 months)', type: 'Service', price: '$299', leads: 6, rev: '$1,794' },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center text-violet-300 text-xs">📦</div>
                <div className="flex-1">
                  <div className="text-slate-200 text-xs font-medium">{p.name}</div>
                  <div className="text-slate-500 text-xs">{p.type}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-white">{p.price}</div>
                  <div className="text-emerald-400">{p.rev}</div>
                </div>
              </div>
            ))}
            <div className="border border-dashed border-slate-700 rounded-lg py-2 text-center text-violet-400 text-xs">+ Add Product</div>
          </div>
        </MockupFrame>
        <Tip>Link products to leads so the AI knows which products a lead is interested in — this improves score accuracy and helps the AI suggest the right proposal template.</Tip>
      </Step>
    </>
  )
}

function ChatbotContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The AI Chatbot Builder lets you create a customer-facing chatbot trained on your business data. Embed it on your website to answer questions, capture leads, and book calls — 24/7.
      </p>
      <Step n={1} title="Create your chatbot">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Chatbot</strong> in the sidebar. Click <strong className="text-white">Create Chatbot</strong>. Give it a name, persona, and tone. Then add knowledge sources: your website URL, FAQ document, or manually typed Q&As.
        </p>
        <MockupFrame title="Chatbot Builder">
          <div className="max-w-sm mx-auto space-y-3 py-2">
            {[
              { label: 'Chatbot Name', val: 'Bloom Assistant' },
              { label: 'Persona', val: 'Friendly wellness expert' },
              { label: 'Tone', val: 'Warm, encouraging, professional' },
            ].map(f => (
              <div key={f.label}>
                <div className="text-slate-500 text-xs mb-1">{f.label}</div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">{f.val}</div>
              </div>
            ))}
            <div className="text-slate-500 text-xs mt-2 mb-1">Knowledge Sources</div>
            {['bloomwellness.com (crawled ✓)', 'FAQ Document (uploaded ✓)', 'Product Catalog (linked ✓)'].map(s => (
              <div key={s} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                <span className="text-emerald-400 text-xs">✓</span>
                <span className="text-slate-300 text-xs">{s}</span>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Embed on your website">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          After creating the chatbot, copy the embed code from the <strong className="text-white">Embed</strong> tab and paste it into your website&apos;s HTML. The chat bubble appears in the bottom right corner automatically.
        </p>
        <MockupFrame title="Chatbot — Embed Code">
          <div className="bg-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-400 leading-relaxed">
            <div className="text-slate-500 mb-1">{'<!-- Paste before </body> -->'}</div>
            <div>{'<script'}</div>
            <div className="pl-4">{'src="https://cdn.coovex.com/chatbot.js"'}</div>
            <div className="pl-4">{'data-id="bloom-assistant-x7k2"'}</div>
            <div className="pl-4">{'data-color="#7c3aed"'}</div>
            <div>{'></script>'}</div>
          </div>
          <div className="mt-3 bg-violet-950/30 border border-violet-700/40 rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1 text-violet-200 text-xs">Chatbot is live on bloomwellness.com · 24 conversations today · 3 leads captured</div>
          </div>
        </MockupFrame>
        <Tip>Set up a lead capture trigger: when a visitor asks about pricing, the chatbot automatically asks for their name and email before answering. These contacts go directly into your CooVex Leads list.</Tip>
      </Step>
    </>
  )
}

function MarketingPlanContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The AI Marketing Plan Generator creates a complete 90-day marketing strategy based on your goal, budget, and business type. No marketing expertise required.
      </p>
      <Step n={1} title="Choose your marketing goal">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Tools → Marketing Plan</strong>. Pick your primary goal: Brand Awareness, Lead Generation, Customer Retention, or Product Launch. The AI calibrates the entire plan around this goal.
        </p>
        <MockupFrame title="Tools — Marketing Plan">
          <div className="max-w-sm mx-auto space-y-3 py-2">
            {[
              { label: 'Primary Goal', val: 'Lead Generation' },
              { label: 'Monthly Budget', val: '$2,000' },
              { label: 'Timeline', val: '90 days' },
              { label: 'Target Audience', val: 'Health-conscious women, 25–45, US' },
            ].map(f => (
              <div key={f.label}>
                <div className="text-slate-500 text-xs mb-1">{f.label}</div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">{f.val}</div>
              </div>
            ))}
            <div className="bg-violet-600 text-white text-sm font-medium text-center py-2.5 rounded-lg">Generate 90-Day Plan ✨</div>
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Review the generated plan">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          The plan breaks into phases (Month 1, 2, 3) with weekly action items, channel allocations, content themes, and expected outcomes. Each action item is marked with effort level and projected ROI.
        </p>
        <MockupFrame title="90-Day Marketing Plan — Bloom Wellness Co.">
          <div className="space-y-3">
            {[
              {
                phase: 'Month 1 — Foundation',
                actions: ['Set up LinkedIn Company Page and optimize', 'Run 4 educational posts per week (content pillar strategy)', 'Launch Google Ads — $500 budget targeting "wellness supplements"'],
                kpi: 'Goal: 20 qualified leads',
              },
              {
                phase: 'Month 2 — Acceleration',
                actions: ['Activate email nurture sequence for Month 1 leads', 'Partner with 2 micro-influencers ($400 each)', 'Publish 2 long-form blog posts for SEO'],
                kpi: 'Goal: 45 leads total',
              },
              {
                phase: 'Month 3 — Conversion',
                actions: ['Retarget website visitors with paid ads', 'Send monthly NPS survey, use responses as testimonials', 'Host 1 webinar: "5 Wellness Routines That Actually Work"'],
                kpi: 'Goal: 75 leads, 15 closed',
              },
            ].map((ph, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-violet-300 text-xs font-medium">{ph.phase}</div>
                  <div className="text-emerald-400 text-xs">{ph.kpi}</div>
                </div>
                <ul className="space-y-1">
                  {ph.actions.map((a, j) => (
                    <li key={j} className="flex gap-1.5 text-xs text-slate-400"><span className="text-slate-600 flex-shrink-0">•</span>{a}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>Use the <strong className="text-white">Launch Tracker</strong> tab within the plan to mark each action item complete as you work through it. The AI adjusts future recommendations based on what you&apos;ve done.</Tip>
      </Step>
    </>
  )
}

function PitchDeckContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The AI Pitch Deck Generator creates a professional, investor-ready 10-slide deck in under 5 minutes. Export to PDF or share a live link with investors.
      </p>
      <Step n={1} title="Input your business details">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Tools → Pitch Deck</strong>. Fill in your business name, problem statement, solution, target market, traction, and funding ask. The AI generates all 10 slides from this.
        </p>
        <MockupFrame title="Tools — Pitch Deck Generator">
          <div className="max-w-sm mx-auto space-y-3 py-2">
            {[
              { label: 'Company', val: 'Bloom Wellness Co.' },
              { label: 'Problem', val: 'Supplement industry is full of misleading claims' },
              { label: 'Solution', val: 'Lab-tested, clinically-backed organic supplements' },
              { label: 'Market Size', val: '$47 billion (growing 8% YoY)' },
              { label: 'Traction', val: '$18K MRR, 400 customers, 4.7★ avg rating' },
              { label: 'Funding Ask', val: '$500,000 Seed' },
            ].map(f => (
              <div key={f.label}>
                <div className="text-slate-500 text-xs mb-1">{f.label}</div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-xs">{f.val}</div>
              </div>
            ))}
            <div className="bg-violet-600 text-white text-sm font-medium text-center py-2.5 rounded-lg">Generate Pitch Deck ✨</div>
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Review and export your deck">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          The 10-slide deck is generated with professional formatting. Each slide is editable. Export as PDF for email, or share a live link that tracks when investors view it.
        </p>
        <MockupFrame title="Pitch Deck — Slide Outline">
          <div className="grid grid-cols-2 gap-2">
            {[
              '1. Cover — Bloom Wellness Co.',
              '2. Problem — Supplement lies',
              '3. Solution — Lab-tested approach',
              '4. Market Size — $47B TAM',
              '5. Product — 3 product lines',
              '6. Business Model — D2C subscription',
              '7. Traction — $18K MRR, 400 customers',
              '8. Go-to-Market — Influencer + SEO',
              '9. Team — 3 co-founders + advisors',
              '10. Ask — $500K Seed round',
            ].map((slide, i) => (
              <div key={i} className={`bg-slate-800 rounded-lg p-2 text-xs ${i === 6 ? 'border border-emerald-700/50 text-emerald-300' : 'text-slate-400'}`}>{slide}</div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button className="flex-1 bg-slate-700 text-slate-300 text-xs py-2 rounded-lg">Export PDF</button>
            <button className="flex-1 bg-violet-600 text-white text-xs py-2 rounded-lg">Share Live Link</button>
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function SwotContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The AI SWOT Analysis uses your actual business data — health score, competitor intelligence, review sentiment, lead pipeline — to produce a data-driven SWOT. Not guesswork.
      </p>
      <Step n={1} title="Generate your SWOT">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Tools → SWOT Analysis</strong>. Click <strong className="text-white">Generate SWOT</strong>. The AI reads your entire CooVex profile and generates the analysis automatically.
        </p>
        <MockupFrame title="SWOT Analysis — Bloom Wellness Co.">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-950/30 border border-emerald-700/30 rounded-xl p-3">
              <div className="text-emerald-400 text-xs font-bold mb-2">💪 Strengths</div>
              <ul className="space-y-1 text-xs text-emerald-300/80">
                <li>• #1 review rating in category (4.7★)</li>
                <li>• 100% review response rate</li>
                <li>• Strong LinkedIn presence (5 posts/wk)</li>
                <li>• Growing MRR (+12% last 30d)</li>
              </ul>
            </div>
            <div className="bg-red-950/20 border border-red-700/30 rounded-xl p-3">
              <div className="text-red-400 text-xs font-bold mb-2">⚠️ Weaknesses</div>
              <ul className="space-y-1 text-xs text-red-300/80">
                <li>• Low review volume (48 vs avg 89)</li>
                <li>• No paid advertising active</li>
                <li>• Lead response time: 18 hours</li>
                <li>• Website speed score: 42/100</li>
              </ul>
            </div>
            <div className="bg-blue-950/20 border border-blue-700/30 rounded-xl p-3">
              <div className="text-blue-400 text-xs font-bold mb-2">🚀 Opportunities</div>
              <ul className="space-y-1 text-xs text-blue-300/80">
                <li>• #MindfulWellness trending (2.4M posts)</li>
                <li>• RivalCo reviews dropping — steal share</li>
                <li>• Supplement transparency trend rising</li>
              </ul>
            </div>
            <div className="bg-amber-950/20 border border-amber-700/30 rounded-xl p-3">
              <div className="text-amber-400 text-xs font-bold mb-2">⚡ Threats</div>
              <ul className="space-y-1 text-xs text-amber-300/80">
                <li>• RivalCo 20% price drop</li>
                <li>• New FDA regulation proposals</li>
                <li>• Supply chain cost increase (7%)</li>
              </ul>
            </div>
          </div>
        </MockupFrame>
        <Tip>Run a new SWOT every quarter. Your competitive position changes faster than you think — what was a &quot;Strength&quot; in January may be a &quot;Weakness&quot; by April.</Tip>
      </Step>
    </>
  )
}

function ValuationContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The Business Valuation tool gives you an AI-estimated range for what your business is worth today — using standard industry multiples and your actual revenue and growth data.
      </p>
      <Step n={1} title="Enter your financials">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Tools → Valuation</strong>. Enter your monthly revenue, growth rate, profit margin, and industry. If you&apos;ve connected Stripe, revenue is pre-filled automatically.
        </p>
        <MockupFrame title="Business Valuation">
          <div className="max-w-sm mx-auto space-y-3 py-2">
            {[
              { label: 'Monthly Revenue (MRR)', val: '$18,200' },
              { label: 'Annual Growth Rate', val: '42%' },
              { label: 'Profit Margin', val: '22%' },
              { label: 'Business Type', val: 'SaaS / Subscription' },
              { label: 'Years Operating', val: '2 years' },
            ].map(f => (
              <div key={f.label}>
                <div className="text-slate-500 text-xs mb-1">{f.label}</div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm">{f.val}</div>
              </div>
            ))}
            <div className="bg-violet-600 text-white text-sm font-medium text-center py-2.5 rounded-lg">Calculate Valuation</div>
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Read your valuation report">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          The report shows three valuation methods: Revenue Multiple, EBITDA Multiple, and Discounted Cash Flow (DCF). It gives a conservative, base, and optimistic range.
        </p>
        <MockupFrame title="Valuation Report — Bloom Wellness Co.">
          <div className="space-y-3">
            <div className="text-center bg-violet-950/40 border border-violet-700/40 rounded-xl p-4">
              <div className="text-slate-400 text-xs mb-1">Estimated Business Value</div>
              <div className="text-3xl font-black text-white">$648K – $1.2M</div>
              <div className="text-violet-300 text-xs mt-1">Based on 3× – 5.5× ARR</div>
            </div>
            {[
              { method: 'Revenue Multiple (3.5× ARR)', est: '$763,200', basis: 'ARR: $218,400' },
              { method: 'EBITDA Multiple (8×)', est: '$384,000', basis: 'Annual profit: $48,000' },
              { method: 'DCF (10% discount rate)', est: '$920,000', basis: '5-year projection' },
            ].map((v, i) => (
              <div key={i} className="flex justify-between items-center bg-slate-800 rounded-xl px-3 py-2.5 text-xs">
                <div>
                  <div className="text-slate-300 font-medium">{v.method}</div>
                  <div className="text-slate-600">{v.basis}</div>
                </div>
                <div className="text-emerald-400 font-bold">{v.est}</div>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function PersonaContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The Customer Persona Generator builds detailed buyer personas from your actual leads, customers, and industry data — so you know exactly who you&apos;re selling to and how to reach them.
      </p>
      <Step n={1} title="Generate your personas">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Tools → Persona</strong>. Click <strong className="text-white">Generate Personas</strong>. The AI analyzes your lead database and groups them into 2–4 distinct buyer personas based on demographics, behavior, and conversion rate.
        </p>
        <MockupFrame title="Customer Personas — Bloom Wellness Co.">
          <div className="space-y-3">
            {[
              {
                name: 'The Mindful Professional', pct: '38% of customers',
                traits: 'Age: 28–38 · Female · Urban · Income: $80K+',
                motivations: 'Wants clean, science-backed products. Researches before buying. Reads reviews.',
                channels: 'LinkedIn, Instagram, Google Search',
                color: 'border-violet-700/40 bg-violet-950/20',
              },
              {
                name: 'The Fitness Enthusiast', pct: '29% of customers',
                traits: 'Age: 22–35 · Mixed · Suburban · Income: $55K+',
                motivations: 'Focused on performance. Price-sensitive but loyal when results show.',
                channels: 'Instagram, YouTube, fitness forums',
                color: 'border-blue-700/40 bg-blue-950/20',
              },
            ].map((p, i) => (
              <div key={i} className={`border rounded-xl p-3 ${p.color}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="text-white text-xs font-semibold">{p.name}</div>
                  <div className="text-slate-400 text-xs">{p.pct}</div>
                </div>
                <div className="text-slate-400 text-xs mb-1">{p.traits}</div>
                <div className="text-slate-300 text-xs mb-1"><strong className="text-slate-400">Motivation:</strong> {p.motivations}</div>
                <div className="text-slate-300 text-xs"><strong className="text-slate-400">Find them on:</strong> {p.channels}</div>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>Use personas to inform your content strategy. The AI Coach can write posts specifically targeted to &quot;The Mindful Professional&quot; — just mention the persona in your prompt.</Tip>
      </Step>
    </>
  )
}

function CustomerJourneyContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Customer Journey Mapping visualizes every touchpoint a customer has with your business — from first discovering you to becoming a loyal advocate. The AI identifies drop-off points and suggests fixes.
      </p>
      <Step n={1} title="View the journey map">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Tools → Journey</strong>. The map is built automatically from your attribution data, lead history, and conversion tracking.
        </p>
        <MockupFrame title="Customer Journey Map">
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {[
                { stage: 'Awareness', icon: '👀', channels: 'LinkedIn, Google, Word of mouth', drop: '', color: 'border-blue-700/40' },
                { stage: 'Interest', icon: '🔍', channels: 'Website, Blog, Reviews', drop: '42% drop', color: 'border-violet-700/40' },
                { stage: 'Evaluation', icon: '⚖️', channels: 'Competitor compare, Demos', drop: '31% drop', color: 'border-amber-700/40' },
                { stage: 'Purchase', icon: '💳', channels: 'Pricing page, Proposal', drop: '18% drop', color: 'border-emerald-700/40' },
                { stage: 'Advocacy', icon: '📢', channels: 'Reviews, Referrals, NPS', drop: '', color: 'border-emerald-700/40' },
              ].map((s, i) => (
                <div key={i} className={`border rounded-xl p-3 w-32 flex-shrink-0 ${s.color}`}>
                  <div className="text-2xl mb-1 text-center">{s.icon}</div>
                  <div className="text-white text-xs font-medium text-center mb-1">{s.stage}</div>
                  <div className="text-slate-500 text-xs text-center leading-tight">{s.channels}</div>
                  {s.drop && <div className="mt-1 text-red-400 text-xs text-center font-medium">{s.drop}</div>}
                </div>
              ))}
            </div>
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Fix high drop-off stages">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          The AI identifies stages with the highest drop-off and suggests specific improvements to recover those lost customers.
        </p>
        <MockupFrame title="Journey — AI Recommendations">
          <div className="space-y-2">
            {[
              { stage: 'Interest stage (42% drop)', fix: 'Add a chatbot to your homepage. 68% of visitors leave without taking action. A chatbot that asks "What are you looking for?" reduces this by 30%.' },
              { stage: 'Evaluation stage (31% drop)', fix: 'Add a comparison page vs top 2 competitors. Visitors who find your comparison page convert 2.8× better than those who don\'t.' },
            ].map((r, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-3">
                <div className="text-amber-400 text-xs font-medium mb-1">{r.stage}</div>
                <div className="text-slate-300 text-xs leading-relaxed">{r.fix}</div>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function AttributionContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Revenue Attribution shows you which marketing channels and touchpoints actually drive closed deals — so you can invest in what works and cut what doesn&apos;t.
      </p>
      <Step n={1} title="View the Attribution report">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Attribution</strong> in the sidebar. Choose an attribution model: First Touch (which channel got them), Last Touch (which channel closed them), or Linear (equal credit across all touchpoints).
        </p>
        <MockupFrame title="Attribution — Linear Model">
          <div className="space-y-3">
            <div className="flex gap-2 mb-2">
              {['First Touch', 'Last Touch', 'Linear'].map((m, i) => (
                <button key={m} className={`text-xs px-3 py-1 rounded-lg ${i === 2 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{m}</button>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { ch: 'LinkedIn Posts', rev: '$14,200', deals: 8, pct: 58, color: 'bg-blue-500' },
                { ch: 'Google Organic', rev: '$6,800', deals: 4, pct: 28, color: 'bg-emerald-500' },
                { ch: 'Email Campaigns', rev: '$3,500', deals: 2, pct: 14, color: 'bg-violet-500' },
              ].map(c => (
                <div key={c.ch}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-300">{c.ch}</span>
                    <span className="text-white font-medium">{c.rev} · {c.deals} deals</span>
                  </div>
                  <div className="bg-slate-700 rounded-full h-2">
                    <div className={`${c.color} h-2 rounded-full`} style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-violet-950/30 border border-violet-700/40 rounded-xl p-2.5 text-xs text-violet-200">
              🤖 LinkedIn drives 58% of revenue but only 30% of your content time is spent there. Increasing posting frequency could add ~$8K/month.
            </div>
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Trace individual lead journeys">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Click any closed deal to see the full touchpoint history: every page they visited, every email they opened, and exactly what triggered the purchase decision.
        </p>
        <MockupFrame title="Attribution — Marcus Chen Journey">
          <div className="space-y-2">
            {[
              { event: 'Found via LinkedIn post — "5 signs your routine needs a reset"', date: 'May 3', type: 'First Touch' },
              { event: 'Visited website (3 pages)', date: 'May 3', type: '' },
              { event: 'Opened welcome email', date: 'May 5', type: '' },
              { event: 'Visited pricing page (3×)', date: 'May 15–20', type: '⚡ Buying signal' },
              { event: 'Replied to Day 3 nurture email', date: 'May 18', type: '' },
              { event: 'Signed up — Growth Plan', date: 'May 22', type: 'Last Touch' },
            ].map((e, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <div className="w-16 text-slate-600 flex-shrink-0 pt-0.5">{e.date}</div>
                <div className="flex-1 text-slate-300">{e.event}</div>
                {e.type && <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${e.type.includes('Touch') ? 'bg-violet-900/40 text-violet-400' : 'bg-amber-900/30 text-amber-400'}`}>{e.type}</span>}
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function RevenueTrackingContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Revenue Tracking gives you a real-time view of MRR, ARR, churn, and growth. Connect Stripe for automatic sync or enter revenue manually.
      </p>
      <Step n={1} title="Connect Stripe or enter revenue">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Revenue</strong> in the sidebar. Click <strong className="text-white">Connect Stripe</strong> for automatic sync. Without Stripe, click <strong className="text-white">Enter Manually</strong> to log revenue month by month.
        </p>
        <MockupFrame title="Revenue — Overview">
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { l: 'MRR', v: '$18,200', sub: '+$1,400 this month', c: 'text-emerald-400' },
              { l: 'ARR', v: '$218,400', sub: 'Run rate', c: 'text-white' },
              { l: 'Churn Rate', v: '2.4%', sub: 'Last 30 days', c: 'text-amber-400' },
              { l: 'New MRR', v: '+$3,100', sub: '5 new customers', c: 'text-emerald-400' },
            ].map(s => (
              <div key={s.l} className="bg-slate-800 rounded-xl p-3">
                <div className="text-slate-500 text-xs">{s.l}</div>
                <div className={`font-bold text-sm mt-0.5 ${s.c}`}>{s.v}</div>
                <div className="text-slate-600 text-xs">{s.sub}</div>
              </div>
            ))}
          </div>
          <div className="bg-slate-800 rounded-xl p-3">
            <div className="text-slate-500 text-xs mb-2">MRR Growth — Last 6 Months</div>
            <div className="flex items-end gap-2 h-12">
              {[12400, 13800, 14200, 15600, 16800, 18200].map((v, i) => (
                <div key={i} className="flex-1 bg-violet-600/70 rounded-t" style={{ height: `${(v / 18200) * 100}%` }} />
              ))}
            </div>
            <div className="flex justify-between text-slate-700 text-xs mt-1">
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            </div>
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Track expansion and churn">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          The Revenue breakdown shows New MRR (new customers), Expansion MRR (upgrades), Churned MRR (cancellations), and Net MRR each month.
        </p>
        <MockupFrame title="Revenue — MRR Breakdown">
          <div className="space-y-2">
            {[
              { type: 'New MRR', amount: '+$3,100', desc: '5 new customers', color: 'text-emerald-400' },
              { type: 'Expansion MRR', amount: '+$620', desc: '3 upgrades', color: 'text-blue-400' },
              { type: 'Churned MRR', amount: '-$2,320', desc: '4 cancellations', color: 'text-red-400' },
              { type: 'Net New MRR', amount: '+$1,400', desc: 'Total change', color: 'text-white font-bold' },
            ].map((r, i) => (
              <div key={i} className={`flex justify-between items-center px-3 py-2.5 bg-slate-800 rounded-xl text-xs ${i === 3 ? 'border border-slate-600' : ''}`}>
                <div>
                  <div className={r.color}>{r.type}</div>
                  <div className="text-slate-500">{r.desc}</div>
                </div>
                <div className={`text-sm font-bold ${r.color}`}>{r.amount}</div>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>High churn rate (above 3%) is the #1 revenue killer. Use the AI Coach to ask &quot;Why is my churn high?&quot; — it analyzes cancellation patterns and gives you specific retention recommendations.</Tip>
      </Step>
    </>
  )
}

function MetricsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The Metrics dashboard shows all your critical KPIs in one view — updated in real time. It&apos;s the fastest way to get a pulse on your business without clicking through every section.
      </p>
      <Step n={1} title="Read your KPI dashboard">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Metrics</strong> in the sidebar. All major KPIs are displayed as cards with current value, trend (vs last period), and a sparkline chart.
        </p>
        <MockupFrame title="Metrics Dashboard">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Health Score', value: '78', trend: '+3', tcolor: 'text-emerald-400' },
              { label: 'MRR', value: '$18.2K', trend: '+8.3%', tcolor: 'text-emerald-400' },
              { label: 'Lead Score Avg', value: '64', trend: '-2', tcolor: 'text-red-400' },
              { label: 'Review Rating', value: '4.7★', trend: '+0.1', tcolor: 'text-emerald-400' },
              { label: 'Posts This Month', value: '18', trend: '+4', tcolor: 'text-emerald-400' },
              { label: 'Response Rate', value: '100%', trend: '—', tcolor: 'text-slate-500' },
              { label: 'Churn Rate', value: '2.4%', trend: '-0.3%', tcolor: 'text-emerald-400' },
              { label: 'Pipeline Value', value: '$48K', trend: '+$5K', tcolor: 'text-emerald-400' },
              { label: 'New Leads', value: '24', trend: '+8', tcolor: 'text-emerald-400' },
            ].map(m => (
              <div key={m.label} className="bg-slate-800 rounded-xl p-2.5">
                <div className="text-slate-500 text-xs leading-tight">{m.label}</div>
                <div className="text-white font-bold text-sm mt-0.5">{m.value}</div>
                <div className={`text-xs ${m.tcolor}`}>{m.trend}</div>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>Pin your most important KPIs to the top using the ☆ star icon on each card. Pinned cards always stay at the top, no matter how many metrics you add.</Tip>
      </Step>
    </>
  )
}

function ForecastContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        Business Forecast uses your lead pipeline, deal velocity, historical revenue, and growth trends to predict your revenue for the next 30, 60, and 90 days.
      </p>
      <Step n={1} title="View your revenue forecast">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Forecast</strong> in the sidebar. The AI generates three scenarios: Conservative, Base, and Optimistic — based on your current pipeline conversion rates and historical patterns.
        </p>
        <MockupFrame title="Business Forecast">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '+30 Days', v: '$19,800', sub: 'Base forecast' },
                { label: '+60 Days', v: '$22,400', sub: 'Base forecast' },
                { label: '+90 Days', v: '$26,100', sub: 'Base forecast' },
              ].map(s => (
                <div key={s.label} className="bg-slate-800 rounded-xl p-2.5 text-center">
                  <div className="text-slate-500 text-xs">{s.label}</div>
                  <div className="text-white font-bold">{s.v}</div>
                  <div className="text-slate-600 text-xs">{s.sub}</div>
                </div>
              ))}
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <div className="text-slate-400 text-xs mb-2">Scenario Range</div>
              {[
                { label: 'Optimistic (pipeline converts at 25%)', v: '$31,200', color: 'text-emerald-400' },
                { label: 'Base (pipeline converts at 14%)', v: '$26,100', color: 'text-white' },
                { label: 'Conservative (pipeline converts at 8%)', v: '$21,400', color: 'text-amber-400' },
              ].map((s, i) => (
                <div key={i} className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">{s.label}</span>
                  <span className={`font-medium ${s.color}`}>{s.v}</span>
                </div>
              ))}
            </div>
            <div className="bg-violet-950/30 border border-violet-700/40 rounded-xl p-2.5 text-xs text-violet-200">
              🤖 To reach the optimistic scenario: follow up 3 stale hot leads (Marcus C., Priya S., James O.) — they&apos;re in proposal stage but haven&apos;t been contacted in 5 days.
            </div>
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

function ReportsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The Reports section lets you generate branded PDF reports to share with your team, board, or clients. Choose from several report types, each automatically populated with your live data.
      </p>
      <Step n={1} title="Generate a report">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Reports</strong> in the sidebar. Click <strong className="text-white">New Report</strong>. Choose the report type and date range. The report is generated in seconds.
        </p>
        <MockupFrame title="Reports — Generate">
          <div className="space-y-2">
            {[
              { type: 'Monthly Business Summary', desc: 'Health score, revenue, leads, content, reviews', icon: '📊', popular: true },
              { type: 'Competitor Intelligence Report', desc: 'All competitor activity, pricing changes, benchmarks', icon: '🏆', popular: false },
              { type: 'Lead Pipeline Report', desc: 'Funnel, scores, conversion rates, forecast', icon: '🎯', popular: false },
              { type: 'Client Report (White Label)', desc: 'Agency-branded report for client delivery', icon: '🏷️', popular: false },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-xl px-3 py-3">
                <span className="text-xl">{r.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-slate-200 text-xs font-medium">{r.type}</div>
                    {r.popular && <span className="text-xs bg-violet-600/30 text-violet-300 px-1.5 py-0.5 rounded">Popular</span>}
                  </div>
                  <div className="text-slate-500 text-xs mt-0.5">{r.desc}</div>
                </div>
                <button className="text-xs text-violet-400 border border-violet-800/50 px-2 py-1 rounded flex-shrink-0">Generate</button>
              </div>
            ))}
          </div>
        </MockupFrame>
      </Step>
      <Step n={2} title="Share or download">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          After generation, download as PDF or copy a shareable link. Report links track when the recipient opens them — useful for client reports.
        </p>
        <MockupFrame title="Reports — Ready">
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-12 bg-slate-700 rounded flex items-center justify-center text-slate-400 text-xs">PDF</div>
              <div>
                <div className="text-white text-xs font-medium">Monthly Summary — June 2026</div>
                <div className="text-slate-500 text-xs">12 pages · Generated just now</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 bg-slate-700 text-slate-300 text-xs py-2 rounded-lg">⬇️ Download PDF</button>
              <button className="flex-1 bg-violet-600 text-white text-xs py-2 rounded-lg">🔗 Share Link</button>
            </div>
          </div>
        </MockupFrame>
        <Tip>For agency clients, use the Client Report type and enable white label branding. Your logo and colors replace all CooVex branding before the PDF is generated.</Tip>
      </Step>
    </>
  )
}

function LeadScoringSettingsContent() {
  return (
    <>
      <p className="text-slate-400 text-lg leading-relaxed mb-10">
        The AI lead scoring model works out-of-the-box, but you can tune it to match your specific sales reality. Adjust factor weights so the score reflects what actually predicts a closed deal for you.
      </p>
      <Step n={1} title="Open scoring settings">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Go to <strong className="text-white">Settings → Lead Scoring</strong>. You&apos;ll see all scoring factors and their current weight (points). Drag the slider or type a new value to adjust each factor.
        </p>
        <MockupFrame title="Settings — Lead Scoring">
          <div className="space-y-3 max-w-sm mx-auto py-2">
            <div className="text-slate-400 text-xs font-medium mb-2">Scoring Factors (total = 100 pts)</div>
            {[
              { factor: 'Job Title (Decision Maker)', pts: 20, color: 'bg-violet-500' },
              { factor: 'Company Size (11–100)', pts: 15, color: 'bg-blue-500' },
              { factor: 'Email Opens', pts: 12, color: 'bg-emerald-500' },
              { factor: 'Website Visits (Pricing Page)', pts: 18, color: 'bg-amber-500' },
              { factor: 'Reply to Email', pts: 20, color: 'bg-red-500' },
              { factor: 'Industry Match', pts: 10, color: 'bg-slate-500' },
              { factor: 'LinkedIn Connection', pts: 5, color: 'bg-slate-600' },
            ].map(f => (
              <div key={f.factor}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-300">{f.factor}</span>
                  <span className="text-white font-medium">{f.pts} pts</span>
                </div>
                <div className="bg-slate-700 rounded-full h-2">
                  <div className={`${f.color} h-2 rounded-full`} style={{ width: `${f.pts * 5}%` }} />
                </div>
              </div>
            ))}
          </div>
        </MockupFrame>
        <Tip>If you find that email replies are the strongest predictor of a deal closing for your business, increase that factor to 25–30 pts and reduce lower-signal factors like LinkedIn connection.</Tip>
      </Step>
      <Step n={2} title="Test your new scoring model">
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          After adjusting weights, click <strong className="text-white">Preview Changes</strong> to see how your existing leads would be re-scored. Check that your known best leads score 80+ and your cold leads score below 40 before saving.
        </p>
        <MockupFrame title="Scoring — Preview Changes">
          <div className="space-y-2">
            {[
              { name: 'Marcus Chen', old: 94, new: 97, note: 'Replied to email → higher weight now' },
              { name: 'Priya Sharma', old: 81, new: 76, note: 'No email reply — lower with new weights' },
              { name: 'Fatima Al-Hassan', old: 31, new: 28, note: 'No changes' },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <div className="flex-1">
                  <div className="text-slate-200 text-xs font-medium">{l.name}</div>
                  <div className="text-slate-600 text-xs">{l.note}</div>
                </div>
                <div className="text-slate-500 text-xs">{l.old} →</div>
                <div className={`text-sm font-bold ${l.new >= 80 ? 'text-emerald-400' : l.new >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{l.new}</div>
              </div>
            ))}
            <div className="bg-emerald-700 text-white text-xs font-medium text-center py-2 rounded-lg">Save New Scoring Model</div>
          </div>
        </MockupFrame>
      </Step>
    </>
  )
}

// ─── Content dispatcher ────────────────────────────────────────────────────────

function getTutorialContent(slug: string) {
  switch (slug) {
    case 'getting-started':           return <GettingStartedContent />
    case 'dashboard-agent-inbox':     return <DashboardContent />
    case 'agent-report':              return <AgentReportContent />
    case 'notifications':             return <NotificationsContent />
    case 'website-audit':             return <WebsiteAuditContent />
    case 'content-calendar':          return <ContentCalendarContent />
    case 'content-performance':       return <ContentPerformanceContent />
    case 'lead-management':           return <LeadManagementContent />
    case 'lead-funnel':               return <LeadFunnelContent />
    case 'cold-leads':                return <ColdLeadsContent />
    case 'find-leads':                return <FindLeadsContent />
    case 'competitor-tracking':       return <CompetitorContent />
    case 'competitor-benchmark':      return <CompetitorBenchmarkContent />
    case 'review-management':         return <ReviewContent />
    case 'app-store-reviews':         return <AppStoreReviewsContent />
    case 'products':                  return <ProductsContent />
    case 'trends':                    return <TrendsContent />
    case 'integrations':              return <IntegrationsContent />
    case 'ai-coach':                  return <AiCoachContent />
    case 'chatbot':                   return <ChatbotContent />
    case 'business-plan':             return <BusinessPlanContent />
    case 'marketing-plan':            return <MarketingPlanContent />
    case 'pitch-deck':                return <PitchDeckContent />
    case 'swot-analysis':             return <SwotContent />
    case 'business-valuation':        return <ValuationContent />
    case 'persona-generator':         return <PersonaContent />
    case 'customer-journey':          return <CustomerJourneyContent />
    case 'campaigns':                 return <CampaignsContent />
    case 'proposals':                 return <ProposalsContent />
    case 'goals':                     return <GoalsContent />
    case 'nps-feedback':              return <NpsContent />
    case 'analytics':                 return <AnalyticsContent />
    case 'attribution':               return <AttributionContent />
    case 'revenue-tracking':          return <RevenueTrackingContent />
    case 'metrics':                   return <MetricsContent />
    case 'forecast':                  return <ForecastContent />
    case 'reports':                   return <ReportsContent />
    case 'lead-scoring-settings':     return <LeadScoringSettingsContent />
    case 'agency-white-label':        return <AgencyContent />
    default:                          return null
  }
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="text-white font-semibold text-lg">CooVex</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/blog" className="text-slate-400 hover:text-white text-sm transition-colors">← All Guides</Link>
          <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Start Free Trial
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ─── DB content renderer ─────────────────────────────────────────────────────

function DbContent({ steps }: { steps: DbStep[] }) {
  return (
    <>
      {steps.map((step, i) => (
        <div key={i} className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {i + 1}
            </div>
            <h3 className="text-white font-semibold text-xl">{step.title}</h3>
          </div>
          <div className="text-slate-400 text-sm leading-relaxed mb-3 prose prose-invert prose-sm max-w-none prose-a:text-violet-400 prose-code:text-violet-300 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.content}</ReactMarkdown>
          </div>
          {step.image && (
            <img
              src={step.image}
              alt={step.title}
              className="w-full rounded-xl border border-slate-700/60 my-4 shadow-lg"
            />
          )}
          {step.tip && (
            <div className="flex gap-3 bg-violet-950/40 border border-violet-800/30 rounded-xl p-4 my-4">
              <span className="text-violet-400 text-lg flex-shrink-0">💡</span>
              <p className="text-violet-200 text-sm leading-relaxed">{step.tip}</p>
            </div>
          )}
          {step.warning && (
            <div className="flex gap-3 bg-amber-950/30 border border-amber-700/30 rounded-xl p-4 my-4">
              <span className="text-amber-400 text-lg flex-shrink-0">⚠️</span>
              <p className="text-amber-200 text-sm leading-relaxed">{step.warning}</p>
            </div>
          )}
        </div>
      ))}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // DB post takes priority over static
  const dbPost = await getDbPost(slug)

  // Metadata: DB or static
  const staticPost = POSTS.find(p => p.slug === slug)
  const staticContent = getTutorialContent(slug)

  // If neither source has the slug, 404
  if (!dbPost && (!staticPost || !staticContent)) notFound()

  const title      = dbPost?.title      ?? staticPost!.title
  const subtitle   = dbPost?.subtitle   ?? staticPost!.subtitle
  const icon       = dbPost?.icon       ?? staticPost!.icon
  const category   = dbPost?.category   ?? staticPost!.category
  const readTime   = dbPost?.read_time  ?? staticPost!.readTime
  const postIcon   = icon

  const allSlugs = POSTS.map(p => p.slug)
  const idx      = allSlugs.indexOf(slug)
  const prevSlug = POSTS[idx - 1]
  const nextSlug = POSTS[idx + 1]

  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <Nav />

      {/* Hero */}
      <div className="pt-28 pb-12 px-6 border-b border-slate-900">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="text-slate-500 hover:text-slate-400 text-sm transition-colors mb-6 inline-flex items-center gap-1">
            ← Back to Guides
          </Link>
          <div className="flex items-center gap-3 mt-4 mb-5">
            <span className="text-xs px-2 py-0.5 bg-violet-600/20 text-violet-300 rounded-full border border-violet-600/30">{category}</span>
            <span className="text-slate-500 text-xs">{readTime} min read</span>
            {dbPost && (
              <span className="text-xs px-2 py-0.5 bg-emerald-900/30 text-emerald-400 rounded-full border border-emerald-800/30">Updated</span>
            )}
          </div>
          <div className="flex items-start gap-4">
            <div className="text-5xl flex-shrink-0">{postIcon}</div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{title}</h1>
              <p className="text-slate-400 text-lg leading-relaxed">{subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14">
        {/* DB content wins; fallback to static */}
        {dbPost && dbPost.content?.length > 0
          ? <DbContent steps={dbPost.content} />
          : staticContent
        }

        {/* CTA banner */}
        <div className="mt-16 bg-gradient-to-br from-violet-950/60 to-slate-900 border border-violet-800/30 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-3">{postIcon}</div>
          <h2 className="text-xl font-bold text-white mb-2">Ready to try {title}?</h2>
          <p className="text-slate-400 text-sm mb-5">Start your 14-day free trial. Full access, cancel anytime.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            Start Free Trial →
          </Link>
        </div>

        {/* Prev / Next */}
        <div className="mt-10 grid grid-cols-2 gap-4">
          {prevSlug ? (
            <Link href={`/blog/${prevSlug.slug}`} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-colors">
              <div className="text-slate-500 text-xs mb-1">← Previous</div>
              <div className="text-white text-sm font-medium">{prevSlug.title}</div>
            </Link>
          ) : <div />}
          {nextSlug ? (
            <Link href={`/blog/${nextSlug.slug}`} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 text-right transition-colors">
              <div className="text-slate-500 text-xs mb-1">Next →</div>
              <div className="text-white text-sm font-medium">{nextSlug.title}</div>
            </Link>
          ) : <div />}
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
