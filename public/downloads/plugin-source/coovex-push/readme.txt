=== CooVex Content Push ===
Contributors: coovex
Tags: ai content, content automation, auto publish, content push, marketing automation
Requires at least: 5.0
Tested up to: 6.7
Stable tag: 1.0.1
Requires PHP: 7.0
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Automatically receive and publish AI-generated content from CooVex to your WordPress site.

== Description ==

**CooVex Content Push** connects your WordPress site to [CooVex](https://app.coovex.com) — an AI-powered marketing platform. When CooVex generates a blog post, article, or content piece, this plugin receives it and publishes it as a WordPress post automatically.

= Key Features =

* **One-click install** — no coding required. Install, activate, paste one URL into CooVex, done.
* **Secure** — HMAC-SHA256 signature verification ensures only CooVex can push content.
* **Flexible publishing** — choose to publish immediately, save as draft, or send to pending review.
* **Choose post author** — assign any administrator, editor, or author as the post author.
* **Auto-sync** — automatically notifies CooVex with the live URL so your dashboard stays updated.
* **Conflict-safe** — uses unique class names, option keys, and REST route namespaces.
* **Works with any theme** — standard WordPress REST API, compatible with all themes and page builders.

= How It Works =

1. CooVex AI generates a blog post or content piece.
2. CooVex sends a secure POST request to your WordPress site (the Webhook URL).
3. This plugin verifies the request, creates a WordPress post, and optionally sends the live URL back to CooVex.
4. Your CooVex dashboard shows the post as "Published" with a link.

= Requirements =

* WordPress 5.0 or higher
* PHP 7.0 or higher
* A CooVex account at [app.coovex.com](https://app.coovex.com)

== Installation ==

= Automatic Installation =

1. Go to your WordPress Admin → **Plugins → Add New**.
2. Search for **CooVex Content Push**.
3. Click **Install Now** and then **Activate**.

= Manual Installation =

1. Download `coovex-push.zip`.
2. Go to WordPress Admin → **Plugins → Add New → Upload Plugin**.
3. Upload the zip file and click **Install Now**, then **Activate**.

= Setup =

1. After activation, go to **Settings → CooVex Push**.
2. Copy the **Webhook URL** displayed at the top.
3. Log in to [app.coovex.com](https://app.coovex.com) → **Settings → Integrations → Content Push**.
4. Paste the Webhook URL into the **Webhook URL** field.
5. Copy the **Webhook Secret** from CooVex and paste it into the plugin settings.
6. Click **Save Settings** in both places.
7. Enable **Auto Push** in CooVex to publish content automatically.

== Frequently Asked Questions ==

= Do I need coding skills? =

No. Just install, activate, and copy-paste one URL. That's it.

= Is the connection secure? =

Yes. Every request from CooVex is signed with HMAC-SHA256. If the signature doesn't match, the plugin rejects the request and returns a 401 error. You can also leave the secret blank if you prefer to skip signature verification (not recommended for production).

= Can I review posts before they go live? =

Yes. In **Settings → CooVex Push**, set **Publish Status** to **Save as Draft** or **Pending Review**.

= Will this conflict with other plugins? =

No. The plugin uses a fully-namespaced PHP class (`CooVex_Push`), unique option keys prefixed with `coovex_push_`, and a dedicated REST namespace (`coovex-push/v1`). It registers hooks only via `plugins_loaded` and uses the singleton pattern to prevent double-loading.

= What WordPress versions are supported? =

WordPress 5.0 and above, tested up to 6.7. Requires PHP 7.0+.

= Where is the Webhook URL? =

After activation: **WordPress Admin → Settings → CooVex Push**. The URL is shown at the top of the page.

= What happens if CooVex sends a request with a bad signature? =

The plugin returns HTTP 401 Unauthorized and does not create a post.

= What data does the plugin store? =

Only three WordPress options are stored:
* `coovex_push_secret` — your webhook secret
* `coovex_push_post_status` — publish / draft / pending
* `coovex_push_post_author` — the WordPress user ID for post author

All options are deleted when you uninstall the plugin.

== Screenshots ==

1. Plugin settings page — shows your Webhook URL and configuration options.
2. A published post created automatically by CooVex Content Push.

== Changelog ==

= 1.0.1 =
* Security: strengthened nonce verification and input sanitization.
* Compatibility: REST namespace changed to `coovex-push/v1` to avoid conflicts.
* Added: `uninstall.php` to cleanly remove all options on deletion.
* Added: `blocking => false` on confirm callback so webhook response is instant.
* Improved: settings page with Copy button for Webhook URL.

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.1 =
Security and compatibility improvements. Update recommended.
