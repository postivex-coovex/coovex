'use client'

import { useEffect } from 'react'

export function Tracker({ token }: { token: string }) {
  useEffect(() => {
    fetch(`/api/p/${token}/view`, { method: 'POST' }).catch(() => {})
  }, [token])
  return null
}
