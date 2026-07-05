import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://coovex.com'

const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: `${BASE}/`,                        priority: 1.0,  changeFrequency: 'weekly'  },
  { url: `${BASE}/pricing`,                 priority: 0.9,  changeFrequency: 'weekly'  },
  { url: `${BASE}/blog`,                    priority: 0.8,  changeFrequency: 'daily'   },
  { url: `${BASE}/about`,                   priority: 0.7,  changeFrequency: 'monthly' },
  { url: `${BASE}/contact`,                 priority: 0.6,  changeFrequency: 'monthly' },
  { url: `${BASE}/tools/website-audit`,     priority: 0.75, changeFrequency: 'monthly' },
  { url: `${BASE}/tools/competitor-compare`,priority: 0.75, changeFrequency: 'monthly' },
  { url: `${BASE}/tools/health-score`,      priority: 0.75, changeFrequency: 'monthly' },
  { url: `${BASE}/tools/linkedin-analyzer`, priority: 0.70, changeFrequency: 'monthly' },
  { url: `${BASE}/tools/content-generator`, priority: 0.70, changeFrequency: 'monthly' },
  { url: `${BASE}/privacy`,                 priority: 0.3,  changeFrequency: 'yearly'  },
  { url: `${BASE}/terms`,                   priority: 0.3,  changeFrequency: 'yearly'  },
  { url: `${BASE}/cookies`,                 priority: 0.2,  changeFrequency: 'yearly'  },
  { url: `${BASE}/gdpr`,                    priority: 0.2,  changeFrequency: 'yearly'  },
]

export const revalidate = 86400 // rebuild once per day

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Add lastModified to all static pages
  const pages = STATIC_PAGES.map(p => ({ ...p, lastModified: now }))

  // TODO: pull dynamic blog post slugs from DB here
  // const { data: posts } = await supabase.from('blog_posts').select('slug, updated_at').eq('published', true)
  // const blogPages = (posts ?? []).map(p => ({ url: `${BASE}/blog/${p.slug}`, lastModified: new Date(p.updated_at), priority: 0.65, changeFrequency: 'monthly' as const }))

  return pages
}
