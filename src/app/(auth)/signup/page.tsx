import { Suspense } from 'react'
import { SignupForm } from './signup-form'

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md h-96 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />}>
      <SignupForm />
    </Suspense>
  )
}
