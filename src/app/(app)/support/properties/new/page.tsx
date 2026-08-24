import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PropertyForm } from '@/components/support/property-form'

export const metadata = { title: 'New Support Property' }

export default async function NewPropertyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">New Support Property</h1>
        <p className="text-sm text-slate-500 mt-1">Create a property for each website or brand you want to support.</p>
      </div>
      <PropertyForm mode="create" />
    </div>
  )
}
