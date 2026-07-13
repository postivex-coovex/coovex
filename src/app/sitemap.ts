import type { MetadataRoute } from 'next'

// App sitemap — public-facing tool pages only (not auth-gated pages)
const BASE = 'https://app.coovex.com'

export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const pages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`,                        priority: 1.0,  changeFrequency: 'weekly',  lastModified: now },
    { url: `${BASE}/login`,                   priority: 0.5,  changeFrequency: 'yearly',  lastModified: now },
    { url: `${BASE}/signup`,                  priority: 0.6,  changeFrequency: 'yearly',  lastModified: now },

    // Public tools
    { url: `${BASE}/tools/website-audit`,     priority: 0.8,  changeFrequency: 'monthly', lastModified: now },
    { url: `${BASE}/tools/competitor-compare`,priority: 0.75, changeFrequency: 'monthly', lastModified: now },
    { url: `${BASE}/tools/health-score`,      priority: 0.75, changeFrequency: 'monthly', lastModified: now },
    { url: `${BASE}/tools/linkedin-analyzer`, priority: 0.70, changeFrequency: 'monthly', lastModified: now },
    { url: `${BASE}/tools/content-generator`, priority: 0.70, changeFrequency: 'monthly', lastModified: now },

    // Key feature pages (for GEO / AI discoverability)
    { url: `${BASE}/gtm-agent`,               priority: 0.9,  changeFrequency: 'weekly',  lastModified: now },
    { url: `${BASE}/audit`,                   priority: 0.8,  changeFrequency: 'monthly', lastModified: now },
    { url: `${BASE}/geo`,                     priority: 0.8,  changeFrequency: 'monthly', lastModified: now },
    { url: `${BASE}/leads`,                   priority: 0.75, changeFrequency: 'monthly', lastModified: now },
    { url: `${BASE}/content`,                 priority: 0.75, changeFrequency: 'monthly', lastModified: now },
    { url: `${BASE}/competitors`,             priority: 0.75, changeFrequency: 'monthly', lastModified: now },
    { url: `${BASE}/trends`,                  priority: 0.70, changeFrequency: 'weekly',  lastModified: now },
  ]

  return pages
}
