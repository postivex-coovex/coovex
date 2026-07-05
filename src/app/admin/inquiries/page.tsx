import { createServiceClient } from '@/lib/supabase/server'
import { InquiriesClient } from './inquiries-client'

export const dynamic = 'force-dynamic'

export default async function AdminInquiriesPage() {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('integration_inquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  return <InquiriesClient inquiries={data ?? []} />
}
