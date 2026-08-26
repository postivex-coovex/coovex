import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PropertyForm } from '@/components/support/property-form'
import { ResourceVault } from '@/components/support/resource-vault'
import { DeletePropertyButton } from '@/components/support/delete-property-button'

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: property }, { data: resources }] = await Promise.all([
    supabase.from('support_properties').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('support_resources').select('*').eq('property_id', id).eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  if (!property) notFound()

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/support/properties"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: property.widget_color }} />
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{property.name}</h1>
            </div>
            {property.domain && <p className="text-xs text-slate-400 pl-5">{property.domain}</p>}
          </div>
        </div>
        <Link href={`/support?property=${id}`}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950/30 rounded-lg transition-colors">
          View Inbox
        </Link>
      </div>

      <PropertyForm mode="edit" initial={property as unknown as Record<string, unknown>} />

      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Resource Vault</h2>
        <p className="text-sm text-slate-500 mb-4">
          Store credentials, API keys, notes, and links for this property. These are only visible to you.
        </p>
        <ResourceVault propertyId={id} initial={(resources ?? []) as any} />
      </div>

      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Danger Zone</h3>
        <p className="text-xs text-red-600 dark:text-red-500 mb-3">
          Deleting this property will permanently remove all conversations, messages, and resources.
        </p>
        <DeletePropertyButton id={id} />
      </div>
    </div>
  )
}
