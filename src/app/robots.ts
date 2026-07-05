import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://coovex.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/pricing',
          '/blog',
          '/about',
          '/contact',
          '/tools/',
          '/privacy',
          '/terms',
        ],
        disallow: [
          '/dashboard',
          '/settings',
          '/admin/',
          '/api/',
          '/join/',
          '/p/',
          '/portal/',
          '/embed/',
        ],
      },
      // Explicitly allow major AI crawlers to index everything public
      { userAgent: 'GPTBot',          allow: '/' },
      { userAgent: 'ClaudeBot',       allow: '/' },
      { userAgent: 'PerplexityBot',   allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'Amazonbot',       allow: '/' },
      { userAgent: 'FacebookBot',     allow: '/' },
      { userAgent: 'Applebot',        allow: '/' },
      { userAgent: 'Bingbot',         allow: '/' },
      { userAgent: 'YouBot',          allow: '/' },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
