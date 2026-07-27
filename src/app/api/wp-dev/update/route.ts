import { NextResponse } from 'next/server'

// ── Bump this when releasing a new plugin version ─────────────────────────────
// Also update CVD_VERSION constant in plugin/route.ts (must match).
export const CVD_CURRENT_VERSION    = '1.4.1'
export const CVD_REQUIRES_WP        = '5.9'
export const CVD_TESTED_WP          = '6.8'
export const CVD_REQUIRES_PHP       = '7.4'

const CHANGELOG = `\
= 1.4.1 - 2026-07-27 =
* Fix: fatal error on activation caused by uninstall hook using anonymous function (PHP cannot serialise closures)
* Fix: theme installer class_exists guard to prevent redeclaration on repeated calls
* Fix: deactivation hook now correctly unschedules cvd_cleanup_exports cron

= 1.4.0 - 2026-07-27 =
* WooCommerce: create/update/delete products, create coupons, update order status
* User management: create users, set roles, delete users, reset passwords
* Redirect manager: add/remove/list 301/302 redirects via chat
* Maintenance mode: enable/disable with custom message, bypass for admins
* HTTPS fixer: rewrite all http:// URLs in DB to https:// in one command
* DB cleanup: delete revisions, spam, trashed posts, transients, orphaned meta, optimize tables
* Site audit: PHP version, memory, SSL, debug mode, DB size, pending updates at a glance
* Error log reader: read + clear PHP error log via chat
* Cron manager: list, add, and remove WP cron jobs
* Image tools: regenerate thumbnails, convert images to WebP
* Broken link scanner: find 404/unreachable internal links in post content
* Data export: export posts, pages, users, orders, products as CSV download
* Webhooks: fire HTTP POST to any URL on post publish, user login, order changes
* Scheduled publish: set a future publish date/time for any post
* Login activity log: track login success/failure with IP + timestamp
* Admin dashboard widget: site health overview at a glance
* Auto-cleanup: old CSV exports purged after 24 hours via WP cron

= 1.3.0 - 2026-07-27 =
* Auto-update: plugin now updates itself through WP admin like any other plugin
* Security scanner: malware pattern detection, DB injection checks, admin account audit
* Plugin installer: install any wordpress.org plugin by name via AI command
* Telegram integration: control your site from Telegram messages
* Improved billing: pay-per-use credits based on actual LLM token cost

= 1.2.0 =
* Initial public release with file editing, DB queries, snapshot/rollback, and chat UI`

export async function GET() {
  return NextResponse.json(
    {
      version:      CVD_CURRENT_VERSION,
      requires:     CVD_REQUIRES_WP,
      tested:       CVD_TESTED_WP,
      requires_php: CVD_REQUIRES_PHP,
      changelog:    CHANGELOG,
      homepage:     'https://coovex.com/dev',
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    }
  )
}
