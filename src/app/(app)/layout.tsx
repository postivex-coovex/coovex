import { redirect } from 'next/navigation'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/app-shell'
import { AppHeader } from '@/components/layout/app-header'
import { TrialBanner } from '@/components/layout/trial-banner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, workspaces(*)')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.onboarding_completed) {
    redirect('/onboarding/welcome')
  }

  // Track last seen (non-blocking — fire and forget)
  supabase.from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id)
    .then(() => {})

  // Check subscription / trial
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at, plan_name')
    .eq('workspace_id', profile?.current_workspace_id)
    .maybeSingle()

  const isOnPaidPlan = subscription?.status === 'active' || subscription?.status === 'past_due'
  let trialDaysLeft = 14
  if (subscription?.trial_ends_at) {
    trialDaysLeft = Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000))
  } else if (!subscription) {
    trialDaysLeft = 14
  }

  // Fetch current business name, onboarding status + GA4/Ads settings
  let ga4Id: string | null = null
  let gAdsId: string | null = null
  let currentBusinessName = 'My Business'
  let onboardingRequired = false
  try {
    if (profile?.current_workspace_id) {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('onboarding_completed')
        .eq('id', profile.current_workspace_id)
        .single()
      onboardingRequired = ws?.onboarding_completed === false

      const { data: biz } = await supabase
        .from('businesses').select('name, integrations')
        .eq('workspace_id', profile.current_workspace_id).maybeSingle()
      if (biz?.name) currentBusinessName = biz.name
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ig = (biz as any)?.integrations ?? {}
      ga4Id  = ig?.ga4?.enabled         ? (ig.ga4.measurement_id ?? null)       : null
      gAdsId = ig?.google_ads?.enabled  ? (ig.google_ads.tag_id ?? null)        : null
    }
  } catch {
    // integrations column may not exist yet — skip
  }

  return (
    <AppShell user={profile} currentBusinessName={currentBusinessName} onboardingRequired={onboardingRequired}>
      {/* Google Analytics 4 */}
      {ga4Id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html:
            `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');`
          }} />
        </>
      )}
      {/* Google Ads conversion tracking */}
      {gAdsId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gAdsId}`} strategy="afterInteractive" />
          <Script id="gads-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html:
            `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gAdsId}');`
          }} />
        </>
      )}
      <AppHeader user={profile} />
      {!isOnPaidPlan && trialDaysLeft <= 7 && (
        <TrialBanner daysLeft={trialDaysLeft} />
      )}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </AppShell>
  )
}
