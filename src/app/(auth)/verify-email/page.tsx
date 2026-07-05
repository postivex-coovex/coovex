import Link from 'next/link'

export const metadata = { title: 'Verify Email — CooVex' }

export default function VerifyEmailPage() {
  return (
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-5 text-3xl">
        📧
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
      <p className="text-slate-400 text-sm mb-6 leading-relaxed">
        We sent a confirmation link to your email address.
        Click the link to activate your account — it expires in 24 hours.
      </p>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mb-6">
        <p className="text-slate-400 text-xs leading-relaxed">
          Can&apos;t find it? Check your spam folder, or make sure you entered the correct email.
          The sender is <span className="text-violet-400">noreply@coovex.com</span>.
        </p>
      </div>

      <div className="space-y-3">
        <Link
          href="/login"
          className="block w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          Go to Login →
        </Link>
        <Link
          href="/signup"
          className="block text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          Try a different email
        </Link>
      </div>
    </div>
  )
}
