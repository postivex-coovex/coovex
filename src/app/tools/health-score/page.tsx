'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'

// Metadata can't be in client components — moved to layout

const QUESTIONS = [
  {
    id: 'website',
    category: 'Online Presence',
    text: 'How would you rate your website?',
    options: [
      { label: 'No website yet', score: 0 },
      { label: 'Basic/outdated website', score: 25 },
      { label: 'Decent website, needs work', score: 50 },
      { label: 'Modern, fast, mobile-friendly', score: 75 },
      { label: 'Optimized with SEO & conversion tracking', score: 100 },
    ],
  },
  {
    id: 'social',
    category: 'Social Media',
    text: 'How active is your business on social media?',
    options: [
      { label: 'Not active at all', score: 0 },
      { label: 'Post occasionally (< 1x/week)', score: 25 },
      { label: 'Post weekly on 1-2 platforms', score: 50 },
      { label: 'Post 3-4x/week consistently', score: 75 },
      { label: 'Daily posting with engagement strategy', score: 100 },
    ],
  },
  {
    id: 'reviews',
    category: 'Reputation',
    text: 'How do you manage online reviews?',
    options: [
      { label: "Don't track reviews", score: 0 },
      { label: 'Check occasionally, rarely respond', score: 25 },
      { label: 'Respond to negative reviews only', score: 50 },
      { label: 'Respond to most reviews within a week', score: 75 },
      { label: 'Respond to all within 24h, actively collect reviews', score: 100 },
    ],
  },
  {
    id: 'leads',
    category: 'Lead Generation',
    text: 'How do you generate new leads?',
    options: [
      { label: 'Word of mouth only', score: 0 },
      { label: 'Basic contact form on website', score: 25 },
      { label: 'Some ads or outreach, no CRM', score: 50 },
      { label: 'Multiple channels with CRM tracking', score: 75 },
      { label: 'Automated lead scoring and nurturing', score: 100 },
    ],
  },
  {
    id: 'competitors',
    category: 'Competitive Intelligence',
    text: 'How well do you monitor your competitors?',
    options: [
      { label: "Don't monitor competitors", score: 0 },
      { label: 'Occasionally check their website', score: 25 },
      { label: 'Monthly manual research', score: 50 },
      { label: 'Weekly monitoring of pricing & content', score: 75 },
      { label: 'Real-time tracking of all competitor moves', score: 100 },
    ],
  },
  {
    id: 'content',
    category: 'Content Marketing',
    text: 'How consistent is your content strategy?',
    options: [
      { label: 'No content strategy', score: 0 },
      { label: 'Post when we remember', score: 25 },
      { label: 'Monthly content calendar', score: 50 },
      { label: 'Weekly planned content across 2+ channels', score: 75 },
      { label: 'Data-driven content with AI assistance', score: 100 },
    ],
  },
  {
    id: 'analytics',
    category: 'Analytics & Data',
    text: 'How data-driven are your business decisions?',
    options: [
      { label: 'We go on gut feeling', score: 0 },
      { label: 'Basic Google Analytics, rarely checked', score: 25 },
      { label: 'Monthly reporting on key metrics', score: 50 },
      { label: 'Weekly dashboards with defined KPIs', score: 75 },
      { label: 'Daily monitoring with AI-driven insights', score: 100 },
    ],
  },
  {
    id: 'automation',
    category: 'Automation',
    text: 'How automated are your business processes?',
    options: [
      { label: 'Everything is manual', score: 0 },
      { label: 'Some email automation', score: 25 },
      { label: 'CRM + basic workflow automation', score: 50 },
      { label: 'Multi-tool automation with integrations', score: 75 },
      { label: 'AI-driven automation across all functions', score: 100 },
    ],
  },
  {
    id: 'brand',
    category: 'Brand Consistency',
    text: 'How consistent is your brand across all channels?',
    options: [
      { label: 'Inconsistent visuals and messaging', score: 0 },
      { label: 'Logo consistent, messaging varies', score: 25 },
      { label: 'Brand guide exists but not always followed', score: 50 },
      { label: 'Strong consistent brand identity', score: 75 },
      { label: 'Brand guidelines enforced across all touchpoints', score: 100 },
    ],
  },
  {
    id: 'team',
    category: 'Team & Tools',
    text: 'How well equipped is your team with digital tools?',
    options: [
      { label: 'No dedicated tools, email only', score: 0 },
      { label: 'Basic office suite', score: 25 },
      { label: 'Project management + some marketing tools', score: 50 },
      { label: 'Full marketing stack, team trained', score: 75 },
      { label: 'AI-powered tools, continuous learning culture', score: 100 },
    ],
  },
]

interface Answer {
  questionId: string
  score: number
  label: string
}

function ScoreRing({ score }: { score: number }) {
  const r = 70
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444'
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F'
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Needs Work' : 'Critical'

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
        <circle
          cx="80" cy="80" r={r} fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.5s ease, stroke 0.5s ease' }}
        />
      </svg>
      <div className="text-center -mt-4">
        <div className="text-5xl font-bold text-white">{score}</div>
        <div className="text-xl font-bold mt-1" style={{ color }}>{grade}</div>
        <div className="text-slate-400 text-sm">{label}</div>
      </div>
    </div>
  )
}

type PageState = 'quiz' | 'email' | 'results'

export default function HealthScorePage() {
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [page, setPage] = useState<PageState>('quiz')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [score, setScore] = useState(0)
  const [categoryScores, setCategoryScores] = useState<Record<string, number>>({})

  const question = QUESTIONS[currentQ]
  const progress = ((currentQ) / QUESTIONS.length) * 100

  function selectOption(optionIdx: number) {
    setSelected(optionIdx)
  }

  function next() {
    if (selected === null) return
    const option = question.options[selected]
    const newAnswers = [...answers, { questionId: question.id, score: option.score, label: option.label }]
    setAnswers(newAnswers)
    setSelected(null)

    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(q => q + 1)
    } else {
      // Calculate scores
      const total = Math.round(newAnswers.reduce((sum, a) => sum + a.score, 0) / QUESTIONS.length)
      setScore(total)

      const cats: Record<string, number> = {}
      newAnswers.forEach((a, i) => {
        cats[QUESTIONS[i].category] = a.score
      })
      setCategoryScores(cats)
      setPage('email')
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setSubmitting(true)

    await fetch('/api/tools/capture-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name,
        tool_used: 'health-score',
        result_json: { score, answers, categoryScores },
      }),
    })

    setSubmitting(false)
    setPage('results')
  }

  const weakAreas = Object.entries(categoryScores)
    .filter(([, s]) => s < 50)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)

  const recommendations: Record<string, string> = {
    'Online Presence': 'Rebuild or redesign your website with a modern, mobile-first approach and SEO optimization.',
    'Social Media': 'Create a content calendar and commit to posting 3× per week minimum on your top 2 platforms.',
    'Reputation': 'Set up Google Alert + a review response process. Respond to every review within 24 hours.',
    'Lead Generation': 'Install a CRM and create at least 2 lead capture points on your website.',
    'Competitive Intelligence': 'Set up Google Alerts for your top 3 competitors and track their pricing monthly.',
    'Content Marketing': 'Build a 30-day content calendar. Repurpose one piece of content across all channels.',
    'Analytics & Data': 'Set up Google Analytics + Search Console. Review 5 key metrics weekly.',
    'Automation': 'Start with email automation for new leads. Save 5+ hours per week.',
    'Brand Consistency': 'Create a 1-page brand guide with logo, colors, fonts, and tone of voice.',
    'Team & Tools': 'Identify 3 repetitive tasks and find tools to automate them this month.',
  }

  if (page === 'quiz') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            📊 Free Business Health Score
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            How healthy is your business?
          </h1>
          <p className="text-slate-400 text-sm">10 questions. 2 minutes. Get your score + action plan.</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>Question {currentQ + 1} of {QUESTIONS.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div
              className="h-2 bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <div className="text-violet-400 text-xs font-medium uppercase tracking-wider mb-3">
            {question.category}
          </div>
          <h2 className="text-xl font-semibold text-white mb-6">{question.text}</h2>

          <div className="space-y-3">
            {question.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => selectOption(i)}
                className={`w-full text-left px-5 py-3.5 rounded-xl border transition-all ${
                  selected === i
                    ? 'border-violet-500 bg-violet-500/10 text-violet-200'
                    : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
                    selected === i ? 'border-violet-500 bg-violet-500' : 'border-slate-600'
                  }`} />
                  <span className="text-sm">{opt.label}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-between items-center">
            {currentQ > 0 ? (
              <button
                onClick={() => { setCurrentQ(q => q - 1); setSelected(null); setAnswers(a => a.slice(0, -1)) }}
                className="text-slate-500 hover:text-slate-400 text-sm transition-colors"
              >
                ← Back
              </button>
            ) : <div />}

            <button
              onClick={next}
              disabled={selected === null}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              {currentQ === QUESTIONS.length - 1 ? 'See My Score' : 'Next'}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (page === 'email') {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="mb-6">
          <ScoreRing score={score} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Your score is ready!</h2>
        <p className="text-slate-400 text-sm mb-8">
          Enter your email to see the full breakdown + your personalized action plan.
        </p>

        <form onSubmit={submitEmail} className="space-y-4 text-left">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors text-sm"
          />
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors text-sm"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {submitting ? 'Loading...' : 'See My Full Report →'}
          </button>
          <p className="text-slate-600 text-xs text-center">No spam. We&apos;ll also send you your score breakdown.</p>
        </form>
      </div>
    )
  }

  // Results page
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-1">Your Business Health Report</h1>
        <p className="text-slate-400 text-sm">Based on your answers — generated by CooVex AI</p>
      </div>

      {/* Score */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center">
        <ScoreRing score={score} />
        <p className="text-slate-400 text-sm mt-4 max-w-xs text-center">
          {score >= 80
            ? 'Your business is digitally strong. Focus on optimization and scaling.'
            : score >= 60
            ? 'Good foundation. A few key improvements could significantly boost growth.'
            : score >= 40
            ? "There's meaningful room for improvement. Focus on the areas below first."
            : 'Your business has critical gaps that need urgent attention to stay competitive.'}
        </p>
      </div>

      {/* Category breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-white font-semibold">Category Breakdown</h3>
        {Object.entries(categoryScores).map(([cat, s]) => (
          <div key={cat}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-300">{cat}</span>
              <span className={s >= 60 ? 'text-green-400' : s >= 40 ? 'text-amber-400' : 'text-red-400'}>{s}/100</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-700 ${s >= 60 ? 'bg-green-500' : s >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${s}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Action plan */}
      {weakAreas.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-semibold">Your Top Priorities</h3>
          {weakAreas.map(([cat, s], i) => (
            <div key={cat} className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 text-violet-400 font-bold text-sm">
                {i + 1}
              </div>
              <div>
                <p className="text-white font-medium text-sm">{cat} — <span className="text-red-400">{s}/100</span></p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{recommendations[cat]}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="bg-violet-950/40 border border-violet-800/30 rounded-2xl p-6 text-center">
        <p className="text-white font-semibold mb-2">
          Let CooVex AI fix these for you automatically
        </p>
        <p className="text-slate-400 text-sm mb-5">
          Your AI agent monitors all these areas 24/7 and tells you exactly what to do each day.
        </p>
        <Link
          href={email ? `/signup?email=${encodeURIComponent(email)}` : '/signup'}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
        >
          Start Free Trial — Fix These Issues
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </Link>
      </div>
    </div>
  )
}
