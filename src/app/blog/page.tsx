import Link from 'next/link'
import { POSTS, CATEGORIES } from './content'
import type { Metadata } from 'next'
import { SiteFooter } from '@/components/layout/site-footer'

export const metadata: Metadata = {
  title: 'Feature Guides & Tutorials',
  description: 'Step-by-step tutorials for every CooVex feature. Learn how to use AI to grow your business.',
}

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="text-white font-semibold text-lg">CooVex</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/blog" className="text-violet-400 text-sm font-medium">Guides</Link>
          <Link href="/login" className="text-slate-400 hover:text-white text-sm transition-colors">Log in</Link>
          <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Start Free Trial
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default function BlogIndexPage() {
  const featured = POSTS[0]
  const byCategory = CATEGORIES.map(cat => ({
    cat,
    posts: POSTS.filter(p => p.category === cat),
  })).filter(g => g.posts.length > 0)

  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <Nav />

      {/* Header */}
      <div className="pt-28 pb-16 px-6 text-center">
        <div className="inline-flex items-center gap-2 border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          📚 Feature Guides & Tutorials
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Learn CooVex — Step by Step
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Tutorial guides for every feature. See exactly how each tool works with
          live UI examples — no guessing required.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-24">

        {/* Featured */}
        <Link href={`/blog/${featured.slug}`} className="block mb-16 group">
          <div className="bg-gradient-to-br from-violet-950/60 to-slate-900 border border-violet-800/40 hover:border-violet-700/60 rounded-2xl p-8 md:p-10 transition-colors">
            <div className="flex items-start gap-6">
              <div className="text-5xl flex-shrink-0">{featured.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs px-2 py-0.5 bg-violet-600/30 text-violet-300 rounded-full">{featured.category}</span>
                  <span className="text-xs text-slate-500">{featured.readTime} min read</span>
                  <span className="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded-full">Start Here</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 group-hover:text-violet-300 transition-colors">
                  {featured.title}
                </h2>
                <p className="text-slate-400 text-lg mb-4">{featured.subtitle}</p>
                <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">{featured.description}</p>
                <div className="mt-5 flex items-center gap-2 text-violet-400 group-hover:text-violet-300 text-sm font-medium transition-colors">
                  Read Tutorial
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* By category */}
        <div className="space-y-14">
          {byCategory.map(({ cat, posts }) => (
            <div key={cat}>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-white font-bold text-xl">{cat}</h2>
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-slate-600 text-xs">{posts.length} guides</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {posts.map(post => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="bg-slate-900 border border-slate-800 hover:border-violet-800/50 rounded-xl p-5 transition-colors group"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="text-2xl">{post.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs text-slate-500">{post.readTime} min</span>
                        </div>
                        <h3 className="text-white font-semibold text-sm group-hover:text-violet-300 transition-colors leading-tight">
                          {post.title}
                        </h3>
                      </div>
                    </div>
                    <p className="text-slate-500 text-xs leading-relaxed">{post.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {post.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-20 text-center bg-slate-900 border border-slate-800 rounded-2xl p-10">
          <div className="text-3xl mb-4">🤖</div>
          <h2 className="text-2xl font-bold text-white mb-3">Ready to try it yourself?</h2>
          <p className="text-slate-400 mb-6 text-sm">14-day free trial. Full access, cancel anytime.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-7 py-3 rounded-xl transition-colors"
          >
            Start Free Trial →
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
