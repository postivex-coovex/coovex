import { NextResponse } from 'next/server'

export const revalidate = 86400

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://coovex.com'

export async function GET() {
  const content = `# CooVex — AI Business Agent

> CooVex is a 24/7 AI Business Agent SaaS platform for SMBs, SaaS founders, consultants, and digital agencies. It monitors competitors, manages reviews, generates AI content, scores leads, and delivers personalized daily briefings — replacing 10+ separate business tools with a single intelligent agent.

CooVex uses Claude AI (Anthropic) to analyze each business's unique context, surface high-impact opportunities, and execute growth tasks automatically. Businesses connect their website, social channels, and CRM once; CooVex runs continuously in the background.

## Core Platform

- [Agent Inbox](${BASE}/#features): Real-time AI signals — competitor moves, negative reviews, viral trends — all prioritized by business impact and revenue potential.
- [Daily AI Briefing](${BASE}/#features): Personalized morning email with today's top 3 actions, new leads ranked by conversion likelihood, and market signals.
- [AI Coach Chat](${BASE}/dashboard): Natural language business advisor. Ask "Why did leads drop?" or "Write 5 LinkedIn posts for next week."
- [Business Health Score](${BASE}/#features): A single 0–100 score tracking digital presence, pipeline health, and brand reputation — updated daily.
- [Website Audit & GEO Optimizer](${BASE}/tools/website-audit): Full SEO + AI-readiness audit. Generates llms.txt, JSON-LD schema, AI-friendly robots.txt. Scores visibility in ChatGPT, Perplexity, Gemini.

## Competitive Intelligence

- Competitor Intelligence: Monitor pricing, content, reviews, and hiring signals from up to 50 competitors simultaneously.
- Competitor Benchmark: Side-by-side comparison against competitors on SEO authority, review ratings, content volume, and social reach.
- Trend Feed: Industry news, viral hashtags, and emerging opportunities filtered for each business's niche.

## Reputation & Reviews

- Review Management: AI-generated reply drafts for every Google, Facebook, and App Store review. Never leave a review unanswered.
- NPS Surveys: Automated Net Promoter Score campaigns. AI segments responses and flags at-risk customers.

## Content & Marketing

- Content Calendar: AI writes, schedules, and publishes posts across LinkedIn, Facebook, and Instagram.
- Content Performance: Track reach, engagement, and conversion for every published post.
- Campaign Manager: Drip email sequences with AI-generated copy. Track opens, clicks, and conversions.
- AI Website Chatbot: Embed a branded AI chatbot on any website. Captures leads and answers visitor questions 24/7.

## Lead Generation & Sales

- Lead Scoring: AI scores every inbound lead 0–100 with recommended next action.
- AI Lead Worker: Builds an Ideal Customer Profile from your audit data, then searches for matching leads automatically.
- Cold Leads: Discover outreach targets by industry and location. AI-generated personalized email drafts included.
- Lead Funnel / Kanban: Visual pipeline from first contact to closed deal with AI follow-up nudges.
- Proposal Builder: Generate professional client proposals with AI. Shareable links with open-tracking.

## Analytics & Finance

- Revenue Intelligence: Track MRR, ARR, deal pipeline value, and channel attribution.
- Business Forecast: AI-powered revenue and lead forecasting based on historical data and market trends.
- Analytics & Attribution: Know which channels, campaigns, and content pieces actually drive revenue.
- Goals & OKR Tracker: Set business goals, get AI check-ins, and weekly performance summaries.

## Agency & Platform

- Agency View: Manage multiple client businesses from one dashboard. One-click workspace switching.
- White Label: Resell CooVex under your own brand — custom domain, logo, colors, and client portal.
- Integrations Hub: HubSpot, Salesforce, Zoho, WordPress, Zapier, Facebook, and 20+ tools.
- Business Tools Suite: SWOT analysis, Pitch Deck builder, Business Valuation, Persona creator — all AI-generated.

## Free Tools

- [Website Audit](${BASE}/tools/website-audit): Free full-site SEO and AI-readiness audit with action plan.
- [Competitor Compare](${BASE}/tools/competitor-compare): Free head-to-head competitive analysis.
- [Business Health Score](${BASE}/tools/health-score): Free 0–100 business health assessment.
- [LinkedIn Analyzer](${BASE}/tools/linkedin-analyzer): Free LinkedIn profile optimization score.
- [Content Generator](${BASE}/tools/content-generator): Free AI content ideas for any business niche.

## Company

- Product: ${BASE}
- Pricing: ${BASE}/pricing
- Blog: ${BASE}/blog
- About: ${BASE}/about
- Contact: ${BASE}/contact
- Privacy Policy: ${BASE}/privacy
- Terms of Service: ${BASE}/terms
- AI Technology: Built on Anthropic Claude AI

## Optional

- [Blog](${BASE}/blog): Business growth guides, AI marketing insights, product updates, and case studies.
- [Pricing](${BASE}/pricing): Plans for solo founders, growing businesses, and agencies. 14-day free trial, no card required.
- [About](${BASE}/about): Mission, team, and the story behind CooVex.
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  })
}
