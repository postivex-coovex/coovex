import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const CHANNELS = ['linkedin', 'instagram', 'facebook', 'linkedin', 'instagram'] as const
const DAYS_OF_WEEK = [1, 2, 3, 4, 5] // Mon-Fri preferred

function getPostDatesForMonth(count: number): string[] {
  const dates: string[] = []
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = now.getDate()

  for (let d = today + 1; d <= daysInMonth && dates.length < count; d++) {
    const date = new Date(year, month, d)
    if (DAYS_OF_WEEK.includes(date.getDay())) {
      date.setHours(9, 0, 0, 0)
      dates.push(date.toISOString())
    }
  }
  // If not enough days left this month, continue into next month
  if (dates.length < count) {
    for (let d = 1; dates.length < count; d++) {
      const date = new Date(year, month + 1, d)
      if (DAYS_OF_WEEK.includes(date.getDay())) {
        date.setHours(9, 0, 0, 0)
        dates.push(date.toISOString())
      }
    }
  }
  return dates
}

const MOCK_POSTS = (industry: string, businessName: string) => [
  { content: `🚀 ${businessName} is on a mission to transform the ${industry} industry. Here's what we've learned in our first year:\n\n1. Customer feedback is your best product roadmap\n2. Move fast but don't break trust\n3. The best marketing is a delighted customer\n\nWhat's the biggest lesson you've learned building your business? 👇\n\n#${industry.replace(/\s/g, '')} #StartupLife #BusinessGrowth`, channel: 'linkedin' },
  { content: `✨ Behind the scenes at ${businessName}!\n\nOur team spends every Monday reviewing customer feedback and turning it into action. This week's top insight: customers want faster response times.\n\nSo we built it. 🛠️\n\n#BehindTheScenes #CustomerFirst #${industry.replace(/\s/g, '')}`, channel: 'instagram' },
  { content: `Did you know 67% of ${industry} businesses lose customers due to slow follow-up?\n\nAt ${businessName}, we've automated our follow-up sequence so no lead goes cold. Result: 40% higher conversion in 90 days.\n\nWant to know how? Drop a comment below 👇\n\n#LeadGeneration #Sales #BusinessTips`, channel: 'linkedin' },
  { content: `This week's win 🎉\n\nA client came to us struggling with ${industry} operations. 6 weeks later, they've saved 15 hours per week and doubled their output.\n\nThat's why we do what we do. 💪\n\n#ClientWin #${industry.replace(/\s/g, '')} #Success`, channel: 'facebook' },
  { content: `3 things every ${industry} business should automate TODAY:\n\n1️⃣ Lead follow-up emails\n2️⃣ Review request sequences\n3️⃣ Weekly performance reports\n\nFree up 10+ hours per week for the work that actually moves the needle.\n\nSave this post for later! 📌\n\n#BusinessAutomation #${industry.replace(/\s/g, '')} #Productivity`, channel: 'instagram' },
  { content: `🔑 The secret to consistent growth in ${industry}?\n\nShow up. Every. Single. Day.\n\nNot just when you feel inspired. Not just when results are coming in. Every day.\n\nConsistency compounds. What's your non-negotiable daily habit?\n\n#GrowthMindset #${industry.replace(/\s/g, '')} #Consistency`, channel: 'linkedin' },
  { content: `We asked our top clients what they wish they'd done earlier in their ${industry} journey...\n\n"Invested in systems sooner" — 78% of responses\n\nSystems aren't just for big companies. A simple, repeatable process beats hustle every time.\n\n#Systems #${industry.replace(/\s/g, '')} #BusinessStrategy`, channel: 'linkedin' },
  { content: `Q: What's the #1 mistake ${industry} businesses make?\n\nA: Trying to be everything to everyone.\n\nNiche down. Serve one customer type better than anyone else. Own that market before expanding.\n\nTag a business owner who needs to hear this 👇\n\n#NicheMarketing #${industry.replace(/\s/g, '')} #BusinessAdvice`, channel: 'facebook' },
  { content: `Good morning! ☀️\n\nReminder: your ${industry} business doesn't need to be perfect to start marketing it.\n\nDone > Perfect. Every time.\n\nWhat are you putting off that you could ship today?\n\n#MondayMotivation #${industry.replace(/\s/g, '')} #JustShipIt`, channel: 'instagram' },
  { content: `The most underrated growth strategy for ${industry} businesses?\n\n→ Ask for referrals.\n\nNot sometimes. Every single time you deliver a great result. A simple "Do you know anyone who could benefit from what we did for you?" converts better than any ad.\n\n#ReferralMarketing #WordOfMouth #${industry.replace(/\s/g, '')}`, channel: 'linkedin' },
]

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { count = 10 } = await req.json()
  const postCount = Math.min(Math.max(Number(count), 1), 20)

  const { data: profile } = await supabase.from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, industry, description')
    .eq('workspace_id', profile?.current_workspace_id)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 400 })

  const dates = getPostDatesForMonth(postCount)
  let posts: Array<{ content: string; channel: string }>

  if (!process.env.ANTHROPIC_API_KEY) {
    posts = MOCK_POSTS(business.industry, business.name).slice(0, postCount)
  } else {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Create ${postCount} social media posts for a ${business.industry} business called "${business.name}".
${business.description ? `Business: ${business.description}` : ''}

Requirements:
- Mix of LinkedIn (professional), Instagram (engaging/visual), and Facebook (community)
- Vary the themes: thought leadership, client wins, tips, behind-the-scenes, motivational
- Use relevant hashtags (3-5 per post)
- Each post should be 50-150 words
- No emojis in every post — vary the style
- Make them feel authentic, not corporate

Return ONLY a JSON array of ${postCount} objects with this structure:
[{"content": "post text here", "channel": "linkedin|instagram|facebook"}]

No markdown, no explanation — just the JSON array.`
      }]
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'
    try {
      posts = JSON.parse(text)
    } catch {
      posts = MOCK_POSTS(business.industry, business.name).slice(0, postCount)
    }
  }

  // Insert all posts as drafts with scheduled dates
  const rows = posts.slice(0, postCount).map((p, i) => ({
    business_id: business.id,
    channel: (p.channel || CHANNELS[i % CHANNELS.length]) as string,
    status: 'draft' as const,
    content: p.content,
    scheduled_at: dates[i] || null,
  }))

  const { data: inserted, error } = await supabase.from('posts').insert(rows).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, created: inserted?.length ?? 0 })
}
