import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    status?: string; notes?: string
    proof_value?: string; proof_type?: string; proof_summary?: string
    screenshot_base64?: string; screenshot_mime?: string
  }

  // Verify ownership
  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: existing } = await service.from('tasks').select('id, workspace_id, business_id, title, category')
    .eq('id', id).single()
  if (!existing || existing.workspace_id !== profile?.current_workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.status)      updates.status = body.status
  if (body.notes !== undefined) updates.notes = body.notes

  // Handle screenshot OCR via Gemini Vision
  if (body.screenshot_base64 && body.screenshot_mime) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const result = await model.generateContent([
        {
          inlineData: {
            data: body.screenshot_base64.replace(/^data:[^;]+;base64,/, ''),
            mimeType: body.screenshot_mime as 'image/png' | 'image/jpeg' | 'image/webp',
          },
        },
        'Describe what this screenshot shows as proof of task completion. Focus on visible URLs, dates, post titles, metrics, or any concrete evidence. Be brief (2-3 sentences).',
      ])
      const text = result.response.text().trim()
      updates.proof_summary = text
      updates.proof_type = 'screenshot'
    } catch (e) {
      console.error('OCR error:', e)
    }
  }

  if (body.proof_value)   updates.proof_value = body.proof_value
  if (body.proof_type)    updates.proof_type  = body.proof_type
  if (body.proof_summary) updates.proof_summary = body.proof_summary

  // Save to agent memory when task is completed
  if (body.status === 'done') {
    const proofText = (updates.proof_summary as string) || (updates.proof_value as string) || 'No proof provided'
    const memKey = 'kanban_completed_tasks'
    const { data: memRow } = await service.from('agent_memory')
      .select('value_text').eq('business_id', existing.business_id).eq('key', memKey).maybeSingle()

    let history: Array<{ title: string; category: string; proof: string; completed_at: string }> = []
    if (memRow?.value_text) {
      try { history = JSON.parse(memRow.value_text) } catch {}
    }
    history.unshift({
      title: existing.title,
      category: existing.category,
      proof: proofText,
      completed_at: new Date().toISOString(),
    })
    history = history.slice(0, 50) // keep last 50

    await service.from('agent_memory').upsert({
      business_id: existing.business_id,
      key: memKey,
      value_text: JSON.stringify(history),
    }, { onConflict: 'business_id,key' })
  }

  const { data: task, error } = await service.from('tasks').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('current_workspace_id').eq('id', user.id).single()
  const { data: existing } = await service.from('tasks').select('workspace_id')
    .eq('id', id).single()
  if (!existing || existing.workspace_id !== profile?.current_workspace_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await service.from('tasks').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
