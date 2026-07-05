'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DataGateConfig, RequiredField } from '@/components/data-gate/DataGateModal'

interface WebsiteMetrics {
  paying_customers?: number
  mrr?: number
  arr?: number
  dau?: number
  mau?: number
  trial_users?: number
  churn_rate?: number
  arpu?: number
  conversion_rate?: number
  total_signups?: number
  nps_score?: number
  [key: string]: unknown
}

// Pre-defined field sets for common features
export const DATA_FIELDS = {
  business_metrics: [
    {
      key: 'paying_customers',
      label: 'Paying Customers',
      placeholder: '150',
      why: 'Total active paid subscribers/customers right now',
    },
    {
      key: 'mrr',
      label: 'MRR (Monthly Recurring Revenue)',
      placeholder: '12500',
      prefix: '$',
      why: 'Monthly Recurring Revenue in USD',
    },
  ] as RequiredField[],

  revenue_only: [
    {
      key: 'mrr',
      label: 'MRR ($)',
      placeholder: '12500',
      prefix: '$',
      why: 'Monthly Recurring Revenue',
    },
    {
      key: 'paying_customers',
      label: 'Paying Customers',
      placeholder: '150',
      why: 'Total active paying customers/subscribers',
    },
  ] as RequiredField[],

  growth_metrics: [
    {
      key: 'paying_customers',
      label: 'Paying Customers',
      placeholder: '150',
      why: 'Current active paid users',
    },
    {
      key: 'mrr',
      label: 'MRR ($)',
      placeholder: '12500',
      prefix: '$',
      why: 'Monthly Recurring Revenue',
    },
    {
      key: 'churn_rate',
      label: 'Monthly Churn Rate',
      placeholder: '2',
      suffix: '%',
      why: 'Monthly churn % (2 = 2%)',
    },
  ] as RequiredField[],

  full_context: [
    {
      key: 'paying_customers',
      label: 'Paying Customers',
      placeholder: '150',
      why: 'Total active paid subscribers right now',
    },
    {
      key: 'mrr',
      label: 'MRR ($)',
      placeholder: '12500',
      prefix: '$',
      why: 'Monthly Recurring Revenue in USD',
    },
    {
      key: 'dau',
      label: 'Daily Active Users',
      placeholder: '320',
      why: 'Average DAU in last 7 days',
    },
    {
      key: 'mau',
      label: 'Monthly Active Users',
      placeholder: '1200',
      why: 'Unique users in last 30 days',
    },
  ] as RequiredField[],
}

export function useDataGate() {
  const [metrics, setMetrics] = useState<WebsiteMetrics | null>(null)
  const [metricsLoaded, setMetricsLoaded] = useState(false)
  const [gateConfig, setGateConfig] = useState<DataGateConfig | null>(null)

  useEffect(() => {
    fetch('/api/integrations/website-metrics')
      .then(r => r.json())
      .then((d: { metrics?: WebsiteMetrics }) => {
        setMetrics(d.metrics ?? null)
        setMetricsLoaded(true)
      })
      .catch(() => setMetricsLoaded(true))
  }, [])

  // Check if required fields exist in stored metrics
  function hasData(fields: RequiredField[]): boolean {
    if (!metrics) return false
    return fields.some(f => metrics[f.key] !== undefined && metrics[f.key] !== null)
  }

  // Call this before any AI feature.
  // If data exists → onComplete() runs immediately.
  // If data is missing → modal opens, onComplete() runs after user saves.
  const requireData = useCallback((
    fields: RequiredField[],
    feature: string,
    description: string,
    onComplete: () => void,
  ) => {
    if (hasData(fields)) {
      onComplete()
      return
    }

    setGateConfig({
      feature,
      description,
      requiredFields: fields,
      onComplete: () => {
        // Refresh metrics from server, then run the feature
        setGateConfig(null)
        fetch('/api/integrations/website-metrics')
          .then(r => r.json())
          .then((d: { metrics?: WebsiteMetrics }) => {
            setMetrics(d.metrics ?? null)
          })
          .catch(() => {})
        onComplete()
      },
      onDismiss: () => setGateConfig(null),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics])

  // Convenience: run immediately if data present, else show gate
  const withRealData = useCallback((
    fields: RequiredField[],
    feature: string,
    description: string,
    onComplete: () => void,
  ) => {
    requireData(fields, feature, description, onComplete)
  }, [requireData])

  return {
    metrics,
    metricsLoaded,
    hasData,
    requireData,
    withRealData,
    gateConfig,
  }
}
