import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SoftwareClient from './software-client'

export const metadata: Metadata = { title: 'Software Hub — CooVex' }

export default async function SoftwarePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  const workspaceId = profile?.current_workspace_id ?? null

  const [catalogResult, stackResult, businessResult] = await Promise.all([
    supabase
      .from('software_catalog')
      .select('*')
      .eq('active', true)
      .order('is_coovex_pick', { ascending: false })
      .order('sort_order'),
    workspaceId
      ? supabase
          .from('workspace_software_stack')
          .select('*, software:software_catalog(*)')
          .eq('workspace_id', workspaceId)
      : Promise.resolve({ data: [] }),
    workspaceId
      ? supabase
          .from('businesses')
          .select('name, industry, description, website_intel')
          .eq('workspace_id', workspaceId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return (
    <SoftwareClient
      initialCatalog={catalogResult.data ?? []}
      initialStack={stackResult.data ?? []}
      businessName={businessResult.data?.name ?? ''}
    />
  )
}
