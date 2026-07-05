import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const DEMO_EMAIL = 'demo@coovex.com'
const DEMO_PASSWORD = 'Demo@12345'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST() {
  // Service role client for data operations (bypasses RLS)
  const supabase = createSupabaseAdmin(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // --- 1. Try to sign in first (user may already exist) ---
  const anonClient = createSupabaseAdmin(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  let userId: string | null = null

  const { data: signInData } = await anonClient.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })

  if (signInData?.user) {
    userId = signInData.user.id
  } else {
    // Try to create via regular signup
    const { data: signUpData, error: signUpErr } = await anonClient.auth.signUp({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      options: { data: { name: 'Demo User' } }
    })

    if (signUpData?.user) {
      userId = signUpData.user.id
      // Mark email as confirmed via service role
      await supabase.auth.admin.updateUserById(userId, { email_confirm: true }).catch(() => null)
    } else {
      return NextResponse.json({
        error: 'Could not create demo user',
        detail: signUpErr?.message,
        fallback: 'Please sign up manually at /signup with email: demo@coovex.com, password: Demo@12345'
      }, { status: 500 })
    }
  }

  // --- 2. Workspace ---
  let workspaceId: string
  const { data: existingWs } = await supabase
    .from('workspaces').select('id').eq('owner_id', userId).maybeSingle()

  if (existingWs) {
    workspaceId = existingWs.id
  } else {
    const { data: ws } = await supabase
      .from('workspaces')
      .insert({ owner_id: userId, name: 'Acme Corp Workspace', plan: 'growth', billing_status: 'active' })
      .select('id').single()
    if (!ws) return NextResponse.json({ error: 'workspace insert failed' }, { status: 500 })
    workspaceId = ws.id
  }

  // --- 3. Profile upsert ---
  await supabase.from('profiles').upsert({
    id: userId,
    email: DEMO_EMAIL,
    name: 'Demo User',
    current_workspace_id: workspaceId,
    onboarding_completed: true,
    language: 'en',
    timezone: 'America/New_York',
  }, { onConflict: 'id' })

  // --- 4. Business ---
  let businessId: string
  const { data: existingBiz } = await supabase
    .from('businesses').select('id').eq('workspace_id', workspaceId).maybeSingle()

  if (existingBiz) {
    businessId = existingBiz.id
  } else {
    const { data: biz } = await supabase
      .from('businesses')
      .insert({
        workspace_id: workspaceId,
        name: 'Acme Corp',
        industry: 'SaaS / Technology',
        size: '11-50',
        country: 'United States',
        website_url: 'https://acmecorp.example.com',
        description: 'AI-powered productivity tools for remote teams.',
        health_score: 74,
      })
      .select('id').single()
    if (!biz) return NextResponse.json({ error: 'business insert failed' }, { status: 500 })
    businessId = biz.id
  }

  // --- 5. Leads ---
  const { count: lc } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessId)
  if (!lc || lc < 3) {
    await supabase.from('leads').insert([
      { business_id: businessId, name: 'Sarah Mitchell', email: 'sarah.m@techstart.io', phone: '+1 555-0101', company: 'TechStart Inc', job_title: 'CTO', stage: 'proposal', lead_score: 88, notes: 'Very interested, requested pricing for 50 seats. Follow up Friday.' },
      { business_id: businessId, name: 'James Okafor', email: 'j.okafor@globalops.com', phone: '+1 555-0134', company: 'GlobalOps', job_title: 'Head of Operations', stage: 'qualified', lead_score: 72, notes: 'Needs enterprise SSO. Has budget approval.' },
      { business_id: businessId, name: 'Priya Sharma', email: 'priya@designstudio.co', company: 'Design Studio Co', job_title: 'Founder', stage: 'new', lead_score: 45, notes: 'Signed up from free audit tool.' },
      { business_id: businessId, name: 'Carlos Vega', email: 'carlos@marketingpro.io', phone: '+1 555-0199', company: 'MarketingPro', job_title: 'Marketing Director', stage: 'won', lead_score: 95, notes: 'Closed! 20 seat annual plan.' },
      { business_id: businessId, name: 'Emma Chen', email: 'emma.chen@retailco.com', company: 'RetailCo', job_title: 'E-commerce Manager', stage: 'contacted', lead_score: 58 },
      { business_id: businessId, name: 'David Kowalski', email: 'd.kowalski@manufact.eu', phone: '+48 555-0211', company: 'Manufact EU', job_title: 'VP Product', stage: 'new', lead_score: 33 },
    ])
  }

  // --- 6. Posts ---
  const { count: pc } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('business_id', businessId)
  if (!pc || pc < 3) {
    const now = new Date()
    await supabase.from('posts').insert([
      { business_id: businessId, channel: 'linkedin', status: 'published', content: '🚀 Excited to announce that Acme Corp just crossed 500 active teams!\n\nWhat started as a simple idea to reduce meeting overhead has grown into something we never imagined.\n\nThank you to every customer who believed in us early. 🙏\n\n#SaaS #Milestones', scheduled_at: new Date(now.getTime() - 2 * 86400000).toISOString(), published_at: new Date(now.getTime() - 2 * 86400000).toISOString() },
      { business_id: businessId, channel: 'instagram', status: 'scheduled', content: '✨ Behind the scenes: How our team ships features in 48 hours.\n\n#BuildInPublic #StartupLife #RemoteWork', scheduled_at: new Date(now.getTime() + 86400000).toISOString() },
      { business_id: businessId, channel: 'linkedin', status: 'pending_approval', content: '3 lessons from scaling to 500 customers without a sales team:\n\n1. Product-led growth beats outbound cold email\n2. Your best salespeople are your happiest users\n3. Transparency about pricing builds trust\n\nWhat would you add? 👇', scheduled_at: new Date(now.getTime() + 3 * 86400000).toISOString() },
      { business_id: businessId, channel: 'facebook', status: 'draft', content: 'We just launched AI-powered meeting summaries! Try it free for 30 days →' },
    ])
  }

  // --- 7. Reviews ---
  const { count: rc } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', businessId)
  if (!rc || rc < 2) {
    await supabase.from('reviews').insert([
      { business_id: businessId, platform: 'google', reviewer_name: 'Mark Henderson', rating: 5, content: 'Absolutely love Acme Corp! We\'ve been using it for 6 months and it has completely transformed how our remote team collaborates. Customer support is incredibly responsive.', review_date: new Date(Date.now() - 3 * 86400000).toISOString(), status: 'new', sentiment: 'positive' },
      { business_id: businessId, platform: 'g2', reviewer_name: 'Anita R.', rating: 4, content: 'Great product overall. Integrations with Slack and Notion are seamless. Docking one star because the mobile app could use polish.', review_date: new Date(Date.now() - 7 * 86400000).toISOString(), status: 'responded', sentiment: 'positive', response_text: 'Thank you, Anita! We\'re working on a redesigned mobile app — stay tuned!' },
      { business_id: businessId, platform: 'google', reviewer_name: 'Tom Bradley', rating: 2, content: 'Setup was confusing and took nearly a week to get integrations working. The product is good once configured, but onboarding needs significant improvement.', review_date: new Date(Date.now() - 86400000).toISOString(), status: 'new', sentiment: 'negative' },
      { business_id: businessId, platform: 'trustpilot', reviewer_name: 'Lisa Fontaine', rating: 5, content: 'We switched from a competitor 3 months ago and haven\'t looked back. The price-to-value ratio is unmatched. Highly recommend!', review_date: new Date(Date.now() - 14 * 86400000).toISOString(), status: 'responded', sentiment: 'positive', response_text: 'Thank you so much, Lisa! We\'re thrilled you made the switch. 🙏' },
    ])
  }

  // --- 8. Competitors ---
  const { count: cc } = await supabase.from('competitors').select('*', { count: 'exact', head: true }).eq('business_id', businessId)
  if (!cc || cc < 2) {
    await supabase.from('competitors').insert([
      { business_id: businessId, name: 'Notion', website: 'https://notion.so', linkedin_url: 'https://linkedin.com/company/notionhq' },
      { business_id: businessId, name: 'Loom', website: 'https://loom.com' },
      { business_id: businessId, name: 'Asana', website: 'https://asana.com' },
    ])
  }

  // --- 9. Agent signals ---
  const { count: sc } = await supabase.from('agent_signals').select('*', { count: 'exact', head: true }).eq('business_id', businessId)
  if (!sc || sc < 2) {
    await supabase.from('agent_signals').insert([
      { business_id: businessId, type: 'review_alert', title: 'New 2★ review on Google needs response', description: 'Tom Bradley left a negative review. Responding within 24h improves reputation score.', priority: 'high', action_type: 'respond_review', action_data: {}, status: 'unread' },
      { business_id: businessId, type: 'lead_alert', title: 'Hot lead: Sarah Mitchell opened your proposal', description: 'Sarah (TechStart Inc, score 88) viewed your pricing page 3x today. Great time to follow up.', priority: 'high', action_type: 'view_lead', action_data: {}, status: 'unread' },
      { business_id: businessId, type: 'content_alert', title: '1 post pending your approval', description: 'A LinkedIn post is ready for review before scheduling.', priority: 'medium', action_type: 'approve_post', action_data: {}, status: 'unread' },
    ])
  }

  // --- 10. Business metrics ---
  const { count: mcc } = await supabase.from('business_metrics').select('*', { count: 'exact', head: true }).eq('business_id', businessId)
  if (!mcc || mcc < 3) {
    const rows = [...Array(14)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i))
      return { business_id: businessId, date: d.toISOString().split('T')[0], health_score: Math.min(100, 55 + i * 2 + Math.floor(Math.random() * 6)) }
    })
    await supabase.from('business_metrics').insert(rows)
  }

  return NextResponse.json({
    ok: true,
    credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    login_url: 'http://localhost:3000/login',
    note: userId ? 'Demo account ready' : 'Data seeded for existing user',
  })
}
