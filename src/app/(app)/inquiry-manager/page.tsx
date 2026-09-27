import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InquiryManagerClient } from './inquiry-client'

export const metadata = { title: 'Inquiry Manager' }

export default async function InquiryManagerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <InquiryManagerClient />
    </div>
  )
}
