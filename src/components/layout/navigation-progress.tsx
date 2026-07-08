'use client'

import { useEffect, useState } from 'react'
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar'

export function NavigationProgress() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return (
    <ProgressBar
      height="2px"
      color="#7c3aed"
      options={{ showSpinner: false }}
      shallowRouting
    />
  )
}
