import https from 'https'
import type { CheckResult } from './types'

function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return 'https://' + url
  return url
}

function getHostname(urlStr: string): string {
  try { return new URL(urlStr).hostname } catch { return urlStr }
}

function getOrigin(urlStr: string): string {
  try { return new URL(urlStr).origin } catch { return urlStr }
}

function getApexDomain(hostname: string): string {
  const parts = hostname.split('.')
  if (parts.length <= 2) return hostname
  const knownTwo = ['co.uk', 'com.au', 'co.nz', 'co.in', 'co.za', 'com.br', 'co.jp', 'co.id']
  if (knownTwo.includes(parts.slice(-2).join('.'))) return parts.slice(-3).join('.')
  return parts.slice(-2).join('.')
}

async function checkSSL(urlStr: string): Promise<CheckResult['ssl']> {
  try {
    const url = new URL(urlStr)
    if (url.protocol !== 'https:') {
      return { valid: false, expiryDate: null, daysLeft: null, issuer: null, error: 'Not HTTPS' }
    }
    return new Promise((resolve) => {
      const req = https.request(
        { host: url.hostname, port: 443, method: 'HEAD', rejectUnauthorized: false, timeout: 10000, servername: url.hostname },
        (res) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sock = res.socket as any
          const cert = sock.getPeerCertificate?.()
          res.destroy()
          if (!cert?.valid_to) {
            return resolve({ valid: false, expiryDate: null, daysLeft: null, issuer: null, error: 'No cert' })
          }
          const expiryDate = new Date(cert.valid_to)
          const daysLeft = Math.floor((expiryDate.getTime() - Date.now()) / 86400000)
          resolve({
            valid: sock.authorized === true && daysLeft > 0,
            expiryDate,
            daysLeft,
            issuer: cert.issuer?.CN || cert.issuer?.O || null,
            error: sock.authorized ? null : (sock.authorizationError ?? 'Invalid cert'),
          })
        }
      )
      req.on('error', (e) => resolve({ valid: false, expiryDate: null, daysLeft: null, issuer: null, error: e.message }))
      req.on('timeout', () => {
        req.destroy()
        resolve({ valid: false, expiryDate: null, daysLeft: null, issuer: null, error: 'Timeout' })
      })
      req.end()
    })
  } catch (e: unknown) {
    return { valid: false, expiryDate: null, daysLeft: null, issuer: null, error: (e as Error).message }
  }
}

// TLD-specific RDAP servers (faster + more reliable than rdap.org proxy)
const RDAP_SERVERS: Record<string, string> = {
  com: 'https://rdap.verisign.com/com/v1/',
  net: 'https://rdap.verisign.com/net/v1/',
  org: 'https://rdap.publicinterestregistry.org/rdap/',
  info: 'https://rdap.afilias.info/rdap/info/',
  io:  'https://rdap.nic.io/',
  co:  'https://rdap.nic.co/',
  app: 'https://rdap.nic.google/',
  dev: 'https://rdap.nic.google/',
  page:'https://rdap.nic.google/',
  xyz: 'https://rdap.nic.xyz/',
  ai:  'https://rdap.nic.ai/',
  me:  'https://rdap.nic.me/',
  online: 'https://rdap.centralnic.com/online/',
  store:  'https://rdap.centralnic.com/store/',
  site:   'https://rdap.centralnic.com/site/',
  tech:   'https://rdap.centralnic.com/tech/',
  // European TLDs
  de:  'https://rdap.denic.de/',
  eu:  'https://rdap.eurid.eu/',
  uk:  'https://rdap.nominet.uk/',
  fr:  'https://rdap.nic.fr/',
  nl:  'https://rdap.sidn.nl/',
  it:  'https://rdap.nic.it/',
  ch:  'https://rdap.nic.ch/',
  at:  'https://rdap.nic.at/',
  be:  'https://rdap.dnsbelgium.be/',
  se:  'https://rdap.iis.se/',
  dk:  'https://rdap.dk-hostmaster.dk/',
  no:  'https://rdap.norid.no/',
  pl:  'https://rdap.dns.pl/',
  // North America
  ca:  'https://rdap.cira.ca/',
}

async function tryRdap(url: string, domain: string): Promise<CheckResult['domain']> {
  const res = await fetch(`${url}domain/${domain}`, {
    signal: AbortSignal.timeout(7000),
    headers: { Accept: 'application/rdap+json, application/json' },
  })
  if (!res.ok) return null as unknown as CheckResult['domain']
  const data = await res.json() as { events?: { eventAction: string; eventDate: string }[] }
  const exp = data.events?.find(e =>
    e.eventAction === 'expiration' || e.eventAction === 'expiry'
  )
  if (!exp?.eventDate) return null as unknown as CheckResult['domain']
  const expiryDate = new Date(exp.eventDate)
  const daysLeft = Math.floor((expiryDate.getTime() - Date.now()) / 86400000)
  return { expiryDate, daysLeft, error: null }
}

async function checkDomain(hostname: string): Promise<CheckResult['domain']> {
  try {
    const apex = getApexDomain(hostname)
    const tld  = apex.split('.').pop()?.toLowerCase() ?? ''

    // Try TLD-specific server first (faster), then rdap.org as universal fallback
    const servers: string[] = []
    if (RDAP_SERVERS[tld]) servers.push(RDAP_SERVERS[tld])
    servers.push('https://rdap.org/')

    for (const server of servers) {
      try {
        const result = await tryRdap(server, apex)
        if (result?.expiryDate) return result
      } catch { /* try next */ }
    }

    return { expiryDate: null, daysLeft: null, error: 'RDAP not available for this TLD' }
  } catch (e: unknown) {
    return { expiryDate: null, daysLeft: null, error: (e as Error).message }
  }
}

function parseSecurityHeaders(headers: Headers): CheckResult['security'] {
  const has = (h: string) => !!headers.get(h)
  const hasHsts           = has('strict-transport-security')
  const hasXFrame         = has('x-frame-options')
  const hasXContentType   = has('x-content-type-options')
  const hasCSP            = has('content-security-policy')
  const hasReferrerPolicy = has('referrer-policy')
  const hasPermissionsPolicy = has('permissions-policy')
  const count = [hasHsts, hasXFrame, hasXContentType, hasCSP, hasReferrerPolicy, hasPermissionsPolicy].filter(Boolean).length
  return { score: Math.round((count / 6) * 100), hasHsts, hasXFrame, hasXContentType, hasCSP, hasReferrerPolicy, hasPermissionsPolicy }
}

function parseSEO(html: string): CheckResult['seo'] {
  const title = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? null
  const metaDescription = (
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,500})["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']description["']/i)?.[1] ??
    null
  )?.trim() ?? null
  const hasOgTitle  = /<meta[^>]+property=["']og:title["']/i.test(html)
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html)
  const factors = [!!title, !!metaDescription, hasOgTitle, hasCanonical]
  return {
    score: Math.round((factors.filter(Boolean).length / 4) * 100),
    hasTitle: !!title,
    hasMetaDescription: !!metaDescription,
    hasOgTitle,
    hasCanonical,
    title,
    metaDescription,
  }
}

async function httpGet(url: string, timeoutMs = 20000) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
      headers: { 'User-Agent': 'CooVex-Monitor/1.0 (+https://coovex.com)' },
    })
    const body = await res.text()
    return { ok: res.ok, status: res.status, ms: Date.now() - t0, body, headers: res.headers, error: null }
  } catch (e: unknown) {
    return { ok: false, status: null, ms: Date.now() - t0, body: '', headers: null, error: (e as Error).message }
  }
}

export async function checkWebsite(urlInput: string): Promise<CheckResult> {
  const url      = normalizeUrl(urlInput)
  const hostname = getHostname(url)
  const origin   = getOrigin(url)
  const isHttps  = url.startsWith('https://')

  const main = await httpGet(url, 15000)

  // Network failure — site is unreachable
  if (main.status === null) {
    return {
      isUp: false, httpStatus: null, loadTimeMs: main.ms, hasHttps: isHttps,
      hasRobotsTxt: false, hasSitemap: false,
      ssl: { valid: false, expiryDate: null, daysLeft: null, issuer: null, error: 'Connection failed' },
      domain: { expiryDate: null, daysLeft: null, error: null },
      security: { score: 0, hasHsts: false, hasXFrame: false, hasXContentType: false, hasCSP: false, hasReferrerPolicy: false, hasPermissionsPolicy: false },
      seo: { score: 0, hasTitle: false, hasMetaDescription: false, hasOgTitle: false, hasCanonical: false, title: null, metaDescription: null },
      errorMessage: main.error,
    }
  }

  // Parallel secondary checks
  const [sslR, domainR, robotsR, sitemapR] = await Promise.allSettled([
    isHttps ? checkSSL(url) : Promise.resolve<CheckResult['ssl']>({ valid: false, expiryDate: null, daysLeft: null, issuer: null, error: 'Not HTTPS' }),
    checkDomain(hostname),
    httpGet(`${origin}/robots.txt`, 10000),
    httpGet(`${origin}/sitemap.xml`, 10000),
  ])

  const ssl      = sslR.status === 'fulfilled' ? sslR.value : { valid: false, expiryDate: null, daysLeft: null, issuer: null, error: 'Check failed' }
  const domain   = domainR.status === 'fulfilled' ? domainR.value : { expiryDate: null, daysLeft: null, error: 'Check failed' }
  const hasRobotsTxt = robotsR.status === 'fulfilled' && robotsR.value.status === 200
  const hasSitemap   = sitemapR.status === 'fulfilled' && sitemapR.value.status === 200
  const security = main.headers ? parseSecurityHeaders(main.headers) : { score: 0, hasHsts: false, hasXFrame: false, hasXContentType: false, hasCSP: false, hasReferrerPolicy: false, hasPermissionsPolicy: false }
  const seo      = main.body ? parseSEO(main.body) : { score: 0, hasTitle: false, hasMetaDescription: false, hasOgTitle: false, hasCanonical: false, title: null, metaDescription: null }
  const isUp     = main.status >= 200 && main.status < 400

  return {
    isUp, httpStatus: main.status, loadTimeMs: main.ms, hasHttps: isHttps,
    hasRobotsTxt, hasSitemap, ssl, domain, security, seo,
    errorMessage: isUp ? null : `HTTP ${main.status}`,
  }
}
