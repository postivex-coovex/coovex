import { NextResponse } from 'next/server'
import { buildZip } from '@/lib/zip'

/* eslint-disable no-useless-escape */

export const COOVEX_DEV_PHP = `<?php
/**
 * Plugin Name: CooVex Dev
 * Plugin URI:  https://coovex.com/dev
 * Description: AI agent that writes, edits, and manages your WordPress site. Speak plain language \u2014 CooVex Dev delivers working code.
 * Version:     1.5.0
 * Author:      CooVex
 * Author URI:  https://coovex.com
 * License:     GPL2
 * Requires at least: 5.9
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

// -- Constants -----------------------------------------------------------------
define('CVD_VERSION',         '1.5.0');
define('CVD_API_URL',         'https://app.coovex.com/api/wp-dev/command');
define('CVD_VALIDATE_URL',    'https://app.coovex.com/api/wp-dev/validate');
define('CVD_UPDATE_URL',      'https://app.coovex.com/api/wp-dev/update');
define('CVD_DOWNLOAD_URL',    'https://app.coovex.com/api/wp-dev/download');
define('CVD_MAX_SNAPSHOTS',   25);
define('CVD_RATE_LIMIT',      12); // max commands per 5 minutes
define('CVD_TELEGRAM_API',    'https://api.telegram.org/bot');

// -----------------------------------------------------------------------------
// AUTO-UPDATE \u2014 hooks into WordPress built-in plugin updater
// When CooVex releases a new version, WP admin shows the standard update notice
// and handles download + installation automatically.
// -----------------------------------------------------------------------------

add_filter('pre_set_site_transient_update_plugins', function ($transient) {
    if (empty($transient->checked)) return $transient;

    $cached = get_transient('cvd_update_info');
    if ($cached === false) {
        $res    = wp_remote_get(CVD_UPDATE_URL, ['timeout' => 10, 'sslverify' => true]);
        $cached = (!is_wp_error($res) && wp_remote_retrieve_response_code($res) === 200)
                    ? (json_decode(wp_remote_retrieve_body($res), true) ?? [])
                    : [];
        set_transient('cvd_update_info', $cached, 12 * HOUR_IN_SECONDS);
    }

    $remote_ver = $cached['version'] ?? '';
    if (!$remote_ver || !version_compare($remote_ver, CVD_VERSION, '>')) return $transient;

    $plugin_file       = plugin_basename(__FILE__);
    $api_key           = get_option('cvd_api_key', '');
    $obj               = new stdClass();
    $obj->id           = $plugin_file;
    $obj->slug         = 'coovex-dev';
    $obj->plugin       = $plugin_file;
    $obj->new_version  = $remote_ver;
    $obj->url          = 'https://coovex.com/dev';
    $obj->package      = CVD_DOWNLOAD_URL . '?api_key=' . urlencode($api_key) . '&v=' . urlencode($remote_ver);
    $obj->tested       = $cached['tested']       ?? '6.8';
    $obj->requires     = $cached['requires']     ?? '5.9';
    $obj->requires_php = $cached['requires_php'] ?? '7.4';
    $obj->icons        = ['default' => 'https://app.coovex.com/icon-128.png'];

    $transient->response[$plugin_file] = $obj;
    return $transient;
});

// "View version X.X details" popup in WP admin → Plugins
add_filter('plugins_api', function ($result, $action, $args) {
    if ($action !== 'plugin_information' || ($args->slug ?? '') !== 'coovex-dev') return $result;

    $cached              = get_transient('cvd_update_info') ?: [];
    $api_key             = get_option('cvd_api_key', '');
    $info                = new stdClass();
    $info->name          = 'CooVex Dev';
    $info->slug          = 'coovex-dev';
    $info->version       = $cached['version']     ?? CVD_VERSION;
    $info->author        = '<a href="https://coovex.com">CooVex</a>';
    $info->requires      = $cached['requires']     ?? '5.9';
    $info->tested        = $cached['tested']       ?? '6.8';
    $info->requires_php  = $cached['requires_php'] ?? '7.4';
    $info->download_link = CVD_DOWNLOAD_URL . '?api_key=' . urlencode($api_key);
    $info->sections      = [
        'description' => '<p>AI agent that writes, edits, and manages your WordPress site via plain language commands. Supports file editing, DB queries, plugin installation, security scanning, and Telegram integration.</p>',
        'changelog'   => wpautop(esc_html($cached['changelog'] ?? '')),
    ];
    return $info;
}, 10, 3);

// Post-update: clear cached version info and re-validate license with new version
add_action('upgrader_process_complete', function ($upgrader, $options) {
    if (($options['type'] ?? '') !== 'plugin' || empty($options['plugins'])) return;
    foreach ((array)$options['plugins'] as $p) {
        if (strpos($p, 'coovex-dev') !== false) {
            delete_transient('cvd_update_info');
            delete_option('cvd_license_token');
            delete_option('cvd_license_expires');
            // Re-validate shortly after update completes
            wp_schedule_single_event(time() + 10, 'cvd_daily_license_check');
            break;
        }
    }
}, 10, 2);

// -----------------------------------------------------------------------------
// LICENSE VALIDATION \u2014 runs on activation, daily, and before every command
// Security: license_token is derived server-side with a secret never sent here.
//           Even reading this code reveals nothing useful for bypassing it.
// -----------------------------------------------------------------------------

add_action('cvd_daily_license_check', 'cvd_license_validate');

// Schedule daily license check via init hook (safe to call after WP is loaded)
add_action('init', function () {
    if (!wp_next_scheduled('cvd_daily_license_check')) {
        wp_schedule_event(time(), 'daily', 'cvd_daily_license_check');
    }
});

function cvd_license_validate(): bool {
    $api_key = get_option('cvd_api_key', '');
    if (empty($api_key)) return false;

    $response = wp_remote_post(CVD_VALIDATE_URL, [
        'timeout' => 15,
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => wp_json_encode([
            'api_key'        => $api_key,
            'site_url'       => get_site_url(),
            'plugin_version' => CVD_VERSION,
        ]),
    ]);

    if (is_wp_error($response)) {
        update_option('cvd_validate_error', 'Network error: ' . $response->get_error_message());
        return (time() < (int)get_option('cvd_license_expires', 0));
    }

    $code = wp_remote_retrieve_response_code($response);
    $body = json_decode(wp_remote_retrieve_body($response), true);

    if ($code === 403) {
        $code_str = $body['code'] ?? '';
        update_option('cvd_license_status', $code_str === 'REVOKED' ? 'revoked' : 'site_mismatch');
        update_option('cvd_license_token',   '');
        update_option('cvd_license_expires',  0);
        update_option('cvd_validate_error', 'Rejected (' . $code_str . '): ' . ($body['error'] ?? 'unknown'));
        return false;
    }

    if ($code !== 200 || empty($body['valid'])) {
        update_option('cvd_validate_error', 'HTTP ' . $code . ': ' . ($body['error'] ?? wp_remote_retrieve_body($response)));
        return false;
    }

    delete_option('cvd_validate_error');
    update_option('cvd_license_token',   $body['license_token']);
    update_option('cvd_license_expires', strtotime($body['expires_at']));
    update_option('cvd_license_status',  'active');
    return true;
}

function cvd_license_ok(): bool {
    $status  = get_option('cvd_license_status', '');
    $expires = (int)get_option('cvd_license_expires', 0);

    if ($status === 'revoked' || $status === 'site_mismatch') return false;
    if ($expires > 0 && time() > $expires) {
        // Token expired \u2014 try to refresh silently
        return cvd_license_validate();
    }
    return !empty(get_option('cvd_license_token', ''));
}

/**
 * Verify the HMAC signature on an API response.
 *
 * The server signs: HMAC-SHA256(response_body + ":" + nonce, license_token)
 * where license_token is derived from (api_key + site_url + today) using a
 * server secret that never leaves the server.
 *
 * An attacker who modifies the response body (or forges one entirely) cannot
 * produce a valid signature without knowing today's license_token \u2014 which they
 * cannot compute without the server's secret.
 */
function cvd_verify_response(string $body, string $sig, string $nonce): bool {
    $token = get_option('cvd_license_token', '');
    if (empty($token)) return false;

    $expected = hash_hmac('sha256', $body . ':' . $nonce, $token);
    // hash_equals prevents timing attacks
    return hash_equals($expected, $sig);
}

// -- Redirect Handler ---------------------------------------------------------
add_action('template_redirect', function () {
    $redirects = get_option('cvd_redirects', []);
    if (empty($redirects)) return;
    $path = '/' . ltrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '', '/');
    if (isset($redirects[$path])) {
        $r = $redirects[$path];
        wp_redirect(esc_url_raw($r['to']), (int)($r['code'] ?? 301));
        exit;
    }
});

// -- Maintenance Mode ----------------------------------------------------------
add_action('wp', function () {
    if (!get_option('cvd_maintenance_enabled')) return;
    if (current_user_can('manage_options')) return;
    $allowed_ips = (array)get_option('cvd_maintenance_allowed_ips', []);
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if ($allowed_ips && in_array($ip, $allowed_ips)) return;
    $msg = esc_html(get_option('cvd_maintenance_message', "We'll be back shortly. Thank you for your patience."));
    status_header(503);
    header('Retry-After: 3600');
    ?><!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Maintenance</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5}
.box{text-align:center;padding:40px;background:#fff;border-radius:8px;box-shadow:0 2px 16px rgba(0,0,0,.08);max-width:400px}
h1{font-size:1.4em;color:#111;margin:0 0 12px}p{color:#555;margin:0}</style></head>
<body><div class="box"><h1>Under Maintenance</h1><p><?php echo $msg; ?></p></div></body></html>
<?php
    exit;
});

// -- Login Activity Log --------------------------------------------------------
add_action('wp_login', function (string $user_login, WP_User $user) {
    $log   = array_slice((array)get_option('cvd_login_log', []), 0, 499);
    array_unshift($log, [
        'type'     => 'success',
        'user'     => $user_login,
        'roles'    => $user->roles,
        'ip'       => $_SERVER['REMOTE_ADDR'] ?? '',
        'ua'       => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 120),
        'time'     => time(),
    ]);
    update_option('cvd_login_log', $log);
}, 10, 2);

add_action('wp_login_failed', function (string $user_login) {
    $log   = array_slice((array)get_option('cvd_login_log', []), 0, 499);
    array_unshift($log, [
        'type'  => 'failed',
        'user'  => $user_login,
        'ip'    => $_SERVER['REMOTE_ADDR'] ?? '',
        'ua'    => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 120),
        'time'  => time(),
    ]);
    update_option('cvd_login_log', $log);
});

// -- Webhook Dispatcher --------------------------------------------------------
function cvd_fire_webhook(string $event, array $payload): void {
    $webhooks = get_option('cvd_webhooks', []);
    if (empty($webhooks)) return;
    foreach ($webhooks as $id => $wh) {
        $ev = $wh['event'] ?? '*';
        if ($ev !== '*' && $ev !== $event) continue;
        $body   = json_encode(['event' => $event, 'webhook_id' => $id, 'payload' => $payload, 'timestamp' => time()]);
        $sig    = isset($wh['secret']) ? hash_hmac('sha256', $body, $wh['secret']) : '';
        wp_remote_post(esc_url_raw($wh['url']), [
            'timeout'     => 5,
            'blocking'    => false,
            'body'        => $body,
            'headers'     => ['Content-Type' => 'application/json', 'X-CVD-Signature' => $sig, 'X-CVD-Event' => $event],
        ]);
    }
}

add_action('publish_post', function (int $post_id) {
    $post = get_post($post_id);
    if (!$post || $post->post_status !== 'publish') return;
    cvd_fire_webhook('post.published', ['post_id' => $post_id, 'title' => $post->post_title, 'url' => get_permalink($post_id)]);
});

add_action('publish_page', function (int $post_id) {
    $post = get_post($post_id);
    if (!$post) return;
    cvd_fire_webhook('page.published', ['post_id' => $post_id, 'title' => $post->post_title, 'url' => get_permalink($post_id)]);
});

add_action('wp_login', function (string $user_login, WP_User $user) {
    cvd_fire_webhook('user.login', ['user' => $user_login, 'roles' => $user->roles, 'ip' => $_SERVER['REMOTE_ADDR'] ?? '']);
}, 20, 2);

add_action('user_register', function (int $user_id) {
    $user = get_userdata($user_id);
    cvd_fire_webhook('user.registered', ['user_id' => $user_id, 'email' => $user ? $user->user_email : '']);
});

// WooCommerce-specific webhooks (only if WC active)
add_action('woocommerce_order_status_changed', function (int $order_id, string $old, string $new_status) {
    if (!class_exists('WooCommerce')) return;
    $order = wc_get_order($order_id);
    if (!$order) return;
    cvd_fire_webhook('order.status_changed', ['order_id' => $order_id, 'from' => $old, 'to' => $new_status, 'total' => $order->get_total()]);
}, 10, 3);

// -- CSV Export Auto-Cleanup (removes exports older than 24h) -----------------
add_action('cvd_cleanup_exports', function () {
    $uploads = wp_upload_dir();
    $pattern = $uploads['basedir'] . '/cvd-export-*.csv';
    foreach (glob($pattern) ?: [] as $file) {
        if (filemtime($file) < time() - DAY_IN_SECONDS) @unlink($file);
    }
});
add_action('init', function () {
    if (!wp_next_scheduled('cvd_cleanup_exports')) {
        wp_schedule_event(time(), 'daily', 'cvd_cleanup_exports');
    }
});

// -- Admin Dashboard Widget ----------------------------------------------------
add_action('wp_dashboard_setup', function () {
    wp_add_dashboard_widget('cvd_site_health', 'CooVex Dev \u2014 Site Health', function () {
        global $wpdb;
        $maintenance = get_option('cvd_maintenance_enabled') ? '<span style="color:#d63638">ON</span>' : '<span style="color:#00a32a">OFF</span>';
        $redirects   = count(get_option('cvd_redirects', []));
        $webhooks    = count(get_option('cvd_webhooks', []));
        $log         = get_option('cvd_login_log', []);
        $failed      = count(array_filter($log, fn($e) => ($e['type'] ?? '') === 'failed'));
        $revisions   = (int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='revision'");
        $update_p    = get_site_transient('update_plugins');
        $updates     = !empty($update_p->response) ? count($update_p->response) : 0;
        $db_size     = (float)$wpdb->get_var("SELECT SUM(data_length+index_length) FROM information_schema.tables WHERE table_schema=DATABASE()");
        $db_mb       = round($db_size / 1024 / 1024, 1);
        $ssl         = is_ssl() ? '<span style="color:#00a32a">Yes</span>' : '<span style="color:#d63638">No</span>';
        $agent_url   = admin_url('admin.php?page=coovex-dev');
        ?>
        <style>
        .cvd-widget table{width:100%;border-collapse:collapse;font-size:13px}
        .cvd-widget td{padding:5px 4px;border-bottom:1px solid #f0f0f0;vertical-align:middle}
        .cvd-widget td:first-child{color:#666;width:55%}
        .cvd-widget td:last-child{font-weight:600;text-align:right}
        .cvd-widget .cvd-warn{color:#d63638}
        .cvd-widget .cvd-btn{display:inline-block;margin-top:10px;padding:6px 12px;background:#2271b1;color:#fff;text-decoration:none;border-radius:3px;font-size:12px}
        </style>
        <div class="cvd-widget">
        <table>
            <tr><td>Maintenance Mode</td><td><?php echo $maintenance; ?></td></tr>
            <tr><td>SSL Active</td><td><?php echo $ssl; ?></td></tr>
            <tr><td>DB Size</td><td><?php echo $db_mb; ?> MB</td></tr>
            <tr><td>Plugin Updates Available</td><td class="<?php echo $updates > 0 ? 'cvd-warn' : ''; ?>"><?php echo $updates; ?></td></tr>
            <tr><td>Post Revisions (cleanup recommended)</td><td class="<?php echo $revisions > 200 ? 'cvd-warn' : ''; ?>"><?php echo number_format($revisions); ?></td></tr>
            <tr><td>Active Redirects</td><td><?php echo $redirects; ?></td></tr>
            <tr><td>Active Webhooks</td><td><?php echo $webhooks; ?></td></tr>
            <tr><td>Failed Logins (all time)</td><td class="<?php echo $failed > 10 ? 'cvd-warn' : ''; ?>"><?php echo $failed; ?></td></tr>
        </table>
        <a href="<?php echo esc_url($agent_url); ?>" class="cvd-btn">Open AI Agent</a>
        </div>
        <?php
    });
});

// -- Admin menu ----------------------------------------------------------------
add_action('admin_menu', function () {
    add_menu_page(
        'CooVex Dev',
        'CooVex Dev',
        'manage_options',
        'coovex-dev',
        'cvd_page_agent',
        'dashicons-editor-code',
        3
    );
    add_submenu_page('coovex-dev', 'Dev Agent',       'Dev Agent',       'manage_options', 'coovex-dev',          'cvd_page_agent');
    add_submenu_page('coovex-dev', 'Commit History',  'Commit History',  'manage_options', 'coovex-dev-history',  'cvd_page_history');
    add_submenu_page('coovex-dev', 'Settings',        'Settings',        'manage_options', 'coovex-dev-settings', 'cvd_page_settings');
});

// -- Settings registration -----------------------------------------------------
add_action('admin_init', function () {
    register_setting('cvd_options', 'cvd_api_key',              ['sanitize_callback' => 'sanitize_text_field']);
    register_setting('cvd_options', 'cvd_workspace_id',         ['sanitize_callback' => 'sanitize_text_field']);
    register_setting('cvd_options', 'cvd_telegram_bot_token',   ['sanitize_callback' => 'sanitize_text_field']);
    register_setting('cvd_options', 'cvd_telegram_chat_id',     ['sanitize_callback' => 'sanitize_text_field']);
    // Auto-validate when token is missing (runs on every admin page load until it succeeds)
    if (!empty(get_option('cvd_api_key', '')) && empty(get_option('cvd_license_token', ''))) {
        cvd_license_validate();
    }
});

// Re-validate immediately whenever the API key is changed via Settings
add_action('update_option_cvd_api_key', function ($old, $new) {
    if ($old !== $new) {
        delete_option('cvd_license_token');
        delete_option('cvd_license_expires');
        delete_option('cvd_license_status');
        delete_option('cvd_validate_error');
        cvd_license_validate();
    }
}, 10, 2);

// -- Rate limiting -------------------------------------------------------------
function cvd_rate_check(): bool {
    $key   = 'cvd_rate_' . get_current_user_id();
    $count = (int) get_transient($key);
    if ($count >= CVD_RATE_LIMIT) return false;
    set_transient($key, $count + 1, 5 * MINUTE_IN_SECONDS);
    return true;
}

// -- Snapshot system -----------------------------------------------------------
function cvd_snapshot_take(array $files_changed, string $label): string {
    $snaps = get_option('cvd_snapshots', []);
    $snap  = [
        'id'    => substr(uniqid('', true), -8),
        'time'  => time(),
        'label' => sanitize_text_field($label),
        'files' => [],
        'db'    => [],
    ];

    foreach ($files_changed as $rel_path) {
        $abs = cvd_resolve_path($rel_path);
        if ($abs && file_exists($abs)) {
            $snap['files'][$rel_path] = file_get_contents($abs);
        }
    }

    array_unshift($snaps, $snap);
    update_option('cvd_snapshots', array_slice($snaps, 0, CVD_MAX_SNAPSHOTS), false);
    return $snap['id'];
}

function cvd_snapshot_rollback(string $snap_id): array {
    $snaps = get_option('cvd_snapshots', []);
    $snap  = null;
    foreach ($snaps as $s) {
        if ($s['id'] === $snap_id) { $snap = $s; break; }
    }
    if (!$snap) return ['ok' => false, 'error' => 'Snapshot not found'];

    require_once ABSPATH . 'wp-admin/includes/file.php';
    WP_Filesystem();
    global $wp_filesystem;

    $restored = [];
    foreach ($snap['files'] as $rel_path => $content) {
        $abs = cvd_resolve_path($rel_path);
        if (!$abs) continue;
        wp_mkdir_p(dirname($abs));
        $wp_filesystem->put_contents($abs, $content, FS_CHMOD_FILE);
        $restored[] = $rel_path;
    }

    return ['ok' => true, 'restored' => $restored, 'label' => $snap['label']];
}

// -- File resolution (path security) ------------------------------------------
function cvd_resolve_path(string $rel_path): ?string {
    $rel = ltrim(str_replace('..', '', $rel_path), '/');

    // Allowed top-level prefixes within wp-content
    $allowed = [
        'wp-content/plugins/'   => WP_PLUGIN_DIR   . DIRECTORY_SEPARATOR,
        'wp-content/themes/'    => get_theme_root() . DIRECTORY_SEPARATOR,
        'wp-content/mu-plugins/'=> WPMU_PLUGIN_DIR  . DIRECTORY_SEPARATOR,
        'wp-content/uploads/'   => wp_upload_dir()['basedir'] . DIRECTORY_SEPARATOR,
        // short forms
        'plugins/'   => WP_PLUGIN_DIR   . DIRECTORY_SEPARATOR,
        'themes/'    => get_theme_root() . DIRECTORY_SEPARATOR,
        'mu-plugins/'=> WPMU_PLUGIN_DIR  . DIRECTORY_SEPARATOR,
    ];

    foreach ($allowed as $prefix => $base) {
        if (strpos($rel, $prefix) === 0) {
            $target  = $base . str_replace('/', DIRECTORY_SEPARATOR, substr($rel, strlen($prefix)));
            $realDir = realpath(dirname($target));
            $realBase= realpath($base);
            if ($realBase && $realDir && strpos($realDir, $realBase) === 0) {
                return $target;
            }
            // Directory doesn't exist yet \u2014 validate parent chain
            if (strpos(dirname($target), realpath($base) ?: $base) === 0) {
                return $target;
            }
        }
    }
    return null;
}

// -- Apply a single change -----------------------------------------------------
function cvd_apply_change(array $change): array {
    require_once ABSPATH . 'wp-admin/includes/file.php';
    WP_Filesystem();
    global $wp_filesystem, $wpdb;

    $type = $change['type'] ?? 'file';

    if ($type === 'wp_action') {
        return cvd_apply_wp_action($change);
    }

    if ($type === 'db') {
        $sql = str_replace('{prefix}', $wpdb->prefix, $change['sql'] ?? '');
        // Block dangerous patterns
        $blocked = ['DROP TABLE', 'TRUNCATE', 'DROP DATABASE', 'ALTER TABLE'];
        $upper   = strtoupper($sql);
        foreach ($blocked as $b) {
            if (strpos($upper, $b) !== false && strpos(strtolower($change['sql'] ?? ''), 'yes, delete') === false) {
                return ['ok' => false, 'error' => "Blocked: contains $b. Add 'yes, delete' to your command to confirm."];
            }
        }
        $result = $wpdb->query($sql);
        if ($result === false) return ['ok' => false, 'error' => $wpdb->last_error];
        return ['ok' => true, 'rows_affected' => $result];
    }

    if ($type === 'plugin_install') {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
        require_once ABSPATH . 'wp-admin/includes/plugin.php';

        $slug         = sanitize_key($change['slug'] ?? '');
        $download_url = esc_url_raw($change['download_url'] ?? '');
        $do_activate  = ($change['activate'] ?? true) !== false;

        if (empty($slug) && empty($download_url)) {
            return ['ok' => false, 'error' => 'plugin_install requires slug or download_url'];
        }

        // Check if already installed
        if ($slug) {
            $all = get_plugins();
            foreach (array_keys($all) as $path) {
                if (strpos($path, $slug . '/') === 0 || $path === $slug . '.php') {
                    if ($do_activate && !is_plugin_active($path)) {
                        $activate = activate_plugin($path);
                        if (is_wp_error($activate)) {
                            return ['ok' => false, 'plugin' => $slug, 'error' => 'Already installed but could not activate: ' . $activate->get_error_message()];
                        }
                    }
                    return ['ok' => true, 'plugin' => $slug, 'note' => 'already_installed', 'activated' => $do_activate];
                }
            }
        }

        // Resolve download URL from wordpress.org if only slug provided
        if (empty($download_url) && $slug) {
            $api = plugins_api('plugin_information', ['slug' => $slug, 'fields' => ['downloadlink' => true, 'short_description' => false, 'sections' => false, 'tags' => false]]);
            if (is_wp_error($api)) {
                return ['ok' => false, 'plugin' => $slug, 'error' => 'Could not find plugin on wordpress.org: ' . $api->get_error_message()];
            }
            $download_url = $api->download_link;
        }

        // Silent upgrader skin \u2014 suppresses all output
        if (!class_exists('CVD_Silent_Skin')) {
            class CVD_Silent_Skin extends WP_Upgrader_Skin {
                public function feedback($string, ...$args) {}
                public function header() {}
                public function footer() {}
                public function before() {}
                public function after() {}
                public function error($errors) {}
            }
        }

        $upgrader = new Plugin_Upgrader(new CVD_Silent_Skin());
        $result   = $upgrader->install($download_url);

        if (is_wp_error($result)) {
            return ['ok' => false, 'plugin' => $slug, 'error' => $result->get_error_message()];
        }
        if ($result === false || $result === null) {
            return ['ok' => false, 'plugin' => $slug, 'error' => 'Installation failed (no result). Check server permissions on wp-content/plugins/.'];
        }

        $plugin_file = $upgrader->plugin_info();
        if (!$plugin_file) {
            return ['ok' => true, 'plugin' => $slug, 'installed' => true, 'activated' => false, 'note' => 'Installed but could not determine main plugin file for activation.'];
        }

        if ($do_activate) {
            $activate = activate_plugin($plugin_file);
            if (is_wp_error($activate)) {
                return ['ok' => true, 'plugin' => $slug, 'installed' => true, 'activated' => false, 'activate_error' => $activate->get_error_message()];
            }
        }

        return ['ok' => true, 'plugin' => $slug, 'installed' => true, 'activated' => $do_activate, 'plugin_file' => $plugin_file];
    }

    // File change
    $file   = $change['file'] ?? '';
    $action = $change['action'] ?? 'update';
    $abs    = cvd_resolve_path($file);

    if (!$abs) return ['ok' => false, 'file' => $file, 'error' => 'Path not in allowed directory'];

    // Block dangerous patterns in content
    $content = $change['content'] ?? '';
    $danger  = ['eval(', 'exec(', 'system(', 'shell_exec(', 'passthru(', 'proc_open('];
    foreach ($danger as $d) {
        if (stripos($content, $d) !== false) {
            return ['ok' => false, 'file' => $file, 'error' => "Blocked: generated code contains forbidden function '$d'"];
        }
    }

    if ($action === 'delete') {
        if (file_exists($abs)) $wp_filesystem->delete($abs);
        return ['ok' => true, 'file' => $file, 'action' => 'deleted'];
    }

    wp_mkdir_p(dirname($abs));
    $wrote = $wp_filesystem->put_contents($abs, $content, FS_CHMOD_FILE);
    if (!$wrote) return ['ok' => false, 'file' => $file, 'error' => 'Could not write file (permissions?)'];

    return ['ok' => true, 'file' => $file, 'action' => $action];
}

// -----------------------------------------------------------------------------
// WP DIRECT ACTIONS
// type: "wp_action" \u2014 create/update posts, upload images, SEO, menus, options
// -----------------------------------------------------------------------------

function cvd_apply_wp_action(array $change): array {
    $action = $change['action'] ?? '';
    $data   = $change['data']   ?? [];

    switch ($action) {

        // -- Post / Page CRUD ---------------------------------------------------
        case 'create_post':
        case 'create_page': {
            $args = array_merge([
                'post_status' => 'draft',
                'post_type'   => ($action === 'create_page') ? 'page' : 'post',
                'post_author' => get_current_user_id() ?: 1,
            ], $data);
            unset($args['ID']); // never allow accidental update path
            $id = wp_insert_post(wp_slash($args), true);
            if (is_wp_error($id)) return ['ok' => false, 'error' => $id->get_error_message()];
            return ['ok' => true, 'action' => 'created', 'post_id' => $id, 'post_type' => $args['post_type'], 'url' => get_permalink($id)];
        }

        case 'update_post': {
            if (empty($data['ID'])) return ['ok' => false, 'error' => 'update_post requires data.ID'];
            $id = wp_update_post(wp_slash($data), true);
            if (is_wp_error($id)) return ['ok' => false, 'error' => $id->get_error_message()];
            return ['ok' => true, 'action' => 'updated', 'post_id' => $id, 'url' => get_permalink($id)];
        }

        case 'delete_post': {
            $post_id = (int)($data['post_id'] ?? 0);
            $force   = (bool)($data['force'] ?? false);
            if (!$post_id) return ['ok' => false, 'error' => 'delete_post requires data.post_id'];
            $result = wp_delete_post($post_id, $force);
            return $result ? ['ok' => true, 'action' => 'deleted', 'post_id' => $post_id] : ['ok' => false, 'error' => 'Could not delete post'];
        }

        // -- Post meta (single or bulk) -----------------------------------------
        case 'update_post_meta': {
            $post_id = (int)($data['post_id'] ?? 0);
            $key     = sanitize_key($data['meta_key'] ?? '');
            $val     = $data['meta_value'] ?? '';
            if (!$post_id || !$key) return ['ok' => false, 'error' => 'update_post_meta requires data.post_id and data.meta_key'];
            update_post_meta($post_id, $key, $val);
            return ['ok' => true, 'action' => 'meta_updated', 'post_id' => $post_id, 'key' => $key];
        }

        case 'bulk_update_meta': {
            $post_id = (int)($data['post_id'] ?? 0);
            $meta    = (array)($data['meta'] ?? []);
            if (!$post_id || empty($meta)) return ['ok' => false, 'error' => 'bulk_update_meta requires post_id and meta'];
            foreach ($meta as $k => $v) update_post_meta($post_id, sanitize_key($k), $v);
            return ['ok' => true, 'action' => 'bulk_meta_updated', 'post_id' => $post_id, 'count' => count($meta)];
        }

        // -- SEO (auto-detects Yoast / RankMath / SEOPress / AIOSEO) -----------
        case 'update_seo': {
            $post_id  = (int)($data['post_id'] ?? 0);
            $title    = $data['title']       ?? '';
            $desc     = $data['description'] ?? '';
            $kw       = $data['keywords']    ?? '';
            $og_image = $data['og_image_url'] ?? '';
            if (!$post_id) return ['ok' => false, 'error' => 'update_seo requires data.post_id'];

            $installed = implode(' ', get_option('active_plugins', []));

            if (strpos($installed, 'wordpress-seo') !== false) {
                // Yoast SEO
                if ($title) update_post_meta($post_id, '_yoast_wpseo_title', $title);
                if ($desc)  update_post_meta($post_id, '_yoast_wpseo_metadesc', $desc);
                if ($kw)    update_post_meta($post_id, '_yoast_wpseo_focuskw', $kw);
                $detected = 'yoast';
            } elseif (strpos($installed, 'seo-by-rank-math') !== false) {
                // RankMath
                if ($title) update_post_meta($post_id, 'rank_math_title', $title);
                if ($desc)  update_post_meta($post_id, 'rank_math_description', $desc);
                if ($kw)    update_post_meta($post_id, 'rank_math_focus_keyword', $kw);
                $detected = 'rankmath';
            } elseif (strpos($installed, 'seopress') !== false) {
                // SEOPress
                if ($title) update_post_meta($post_id, '_seopress_titles_title', $title);
                if ($desc)  update_post_meta($post_id, '_seopress_titles_desc', $desc);
                $detected = 'seopress';
            } elseif (strpos($installed, 'all-in-one-seo') !== false) {
                // AIOSEO
                if ($title) update_post_meta($post_id, '_aioseo_title', $title);
                if ($desc)  update_post_meta($post_id, '_aioseo_description', $desc);
                if ($kw)    update_post_meta($post_id, '_aioseo_keywords', $kw);
                $detected = 'aioseo';
            } else {
                // No SEO plugin \u2014 write to native meta + generic keys
                if ($title) update_post_meta($post_id, '_seo_title', $title);
                if ($desc)  update_post_meta($post_id, '_seo_description', $desc);
                if ($desc)  update_post_meta($post_id, '_meta_description', $desc);
                $detected = 'native';
            }
            if ($og_image) update_post_meta($post_id, '_og_image', $og_image);
            return ['ok' => true, 'action' => 'seo_updated', 'post_id' => $post_id, 'seo_plugin' => $detected];
        }

        // -- Taxonomy: set categories / tags ------------------------------------
        case 'set_categories': {
            $post_id = (int)($data['post_id'] ?? 0);
            $cats    = (array)($data['categories'] ?? []);
            if (!$post_id) return ['ok' => false, 'error' => 'set_categories requires data.post_id'];
            wp_set_post_categories($post_id, $cats);
            return ['ok' => true, 'action' => 'categories_set', 'post_id' => $post_id];
        }

        case 'set_tags': {
            $post_id = (int)($data['post_id'] ?? 0);
            $tags    = (array)($data['tags'] ?? []);
            if (!$post_id) return ['ok' => false, 'error' => 'set_tags requires data.post_id'];
            wp_set_post_tags($post_id, $tags);
            return ['ok' => true, 'action' => 'tags_set', 'post_id' => $post_id];
        }

        // -- Media --------------------------------------------------------------
        case 'sideload_image': {
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';

            $url          = esc_url_raw($data['url'] ?? '');
            $post_id      = (int)($data['post_id'] ?? 0);
            $title        = sanitize_text_field($data['title'] ?? '');
            $alt          = sanitize_text_field($data['alt'] ?? $title);
            $set_featured = !empty($data['set_as_featured']);

            if (empty($url)) return ['ok' => false, 'error' => 'sideload_image requires data.url'];

            $att_id = media_sideload_image($url, $post_id, $title, 'id');
            if (is_wp_error($att_id)) return ['ok' => false, 'error' => $att_id->get_error_message()];

            if ($alt) update_post_meta($att_id, '_wp_attachment_image_alt', $alt);
            if ($set_featured && $post_id) set_post_thumbnail($post_id, $att_id);

            return [
                'ok'           => true,
                'action'       => 'image_sideloaded',
                'attachment_id'=> $att_id,
                'url'          => wp_get_attachment_url($att_id),
                'set_featured' => $set_featured && $post_id,
            ];
        }

        case 'set_featured_image': {
            $post_id = (int)($data['post_id'] ?? 0);
            $att_id  = (int)($data['attachment_id'] ?? 0);
            if (!$post_id || !$att_id) return ['ok' => false, 'error' => 'set_featured_image requires post_id and attachment_id'];
            set_post_thumbnail($post_id, $att_id);
            return ['ok' => true, 'action' => 'featured_image_set', 'post_id' => $post_id, 'attachment_id' => $att_id];
        }

        // -- Theme mods & options -----------------------------------------------
        case 'set_theme_mod': {
            $mod = sanitize_key($data['mod'] ?? '');
            $val = $data['value'] ?? '';
            if (!$mod) return ['ok' => false, 'error' => 'set_theme_mod requires data.mod'];
            set_theme_mod($mod, $val);
            return ['ok' => true, 'action' => 'theme_mod_set', 'mod' => $mod];
        }

        case 'update_option': {
            $option = sanitize_key($data['option'] ?? '');
            $val    = $data['value'] ?? '';
            if (!$option) return ['ok' => false, 'error' => 'update_option requires data.option'];
            // Block sensitive options that could break the site
            $blocked = ['siteurl', 'home', 'admin_email', 'blogadmin', 'default_role', 'active_plugins'];
            if (in_array($option, $blocked)) return ['ok' => false, 'error' => "Blocked: '$option' cannot be changed via agent for safety"];
            update_option($option, $val);
            return ['ok' => true, 'action' => 'option_updated', 'option' => $option];
        }

        // -- Navigation menus ---------------------------------------------------
        case 'add_menu_item': {
            $location   = sanitize_text_field($data['menu_location'] ?? '');
            $item       = $data['item'] ?? [];
            $locations  = get_nav_menu_locations();
            $menu_id    = $locations[$location] ?? 0;
            if (!$menu_id) return ['ok' => false, 'error' => "No menu assigned to location '$location'"];
            $item_id = wp_update_nav_menu_item($menu_id, 0, [
                'menu-item-title'     => sanitize_text_field($item['title'] ?? ''),
                'menu-item-url'       => esc_url_raw($item['url'] ?? ''),
                'menu-item-type'      => $item['type'] ?? 'custom',
                'menu-item-status'    => 'publish',
                'menu-item-parent-id' => (int)($item['parent'] ?? 0),
            ]);
            if (is_wp_error($item_id)) return ['ok' => false, 'error' => $item_id->get_error_message()];
            return ['ok' => true, 'action' => 'menu_item_added', 'item_id' => $item_id, 'location' => $location];
        }

        case 'remove_menu_item': {
            $item_id = (int)($data['item_id'] ?? 0);
            if (!$item_id) return ['ok' => false, 'error' => 'remove_menu_item requires data.item_id'];
            wp_delete_post($item_id, true);
            return ['ok' => true, 'action' => 'menu_item_removed', 'item_id' => $item_id];
        }

        // -- DB Cleanup & Optimization ------------------------------------------
        case 'db_cleanup': {
            global $wpdb;
            $types   = (array)($data['types'] ?? ['revisions','spam','transients','trashed','orphaned_meta']);
            $results = [];
            if (in_array('revisions', $types)) {
                $results['revisions_deleted'] = (int)$wpdb->query("DELETE FROM {$wpdb->posts} WHERE post_type = 'revision'");
            }
            if (in_array('spam', $types)) {
                $results['spam_deleted'] = (int)$wpdb->query("DELETE FROM {$wpdb->comments} WHERE comment_approved = 'spam'");
            }
            if (in_array('trashed', $types)) {
                $trashed_ids = $wpdb->get_col("SELECT ID FROM {$wpdb->posts} WHERE post_status = 'trash'");
                foreach ($trashed_ids as $tid) { wp_delete_post((int)$tid, true); }
                $results['trashed_deleted'] = count($trashed_ids);
            }
            if (in_array('transients', $types)) {
                $results['transients_deleted'] = (int)$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '\_transient\_%' OR option_name LIKE '\_site\_transient\_%'");
            }
            if (in_array('orphaned_meta', $types)) {
                $results['orphaned_postmeta'] = (int)$wpdb->query("DELETE pm FROM {$wpdb->postmeta} pm LEFT JOIN {$wpdb->posts} p ON p.ID = pm.post_id WHERE p.ID IS NULL");
                $results['orphaned_usermeta'] = (int)$wpdb->query("DELETE um FROM {$wpdb->usermeta} um LEFT JOIN {$wpdb->users} u ON u.ID = um.user_id WHERE u.ID IS NULL");
            }
            if (in_array('optimize_tables', $types)) {
                $tbls = $wpdb->get_col('SHOW TABLES');
                foreach ($tbls as $t) $wpdb->query("OPTIMIZE TABLE \`{$t}\`");
                $results['tables_optimized'] = count($tbls);
            }
            return ['ok' => true, 'action' => 'db_cleaned', 'results' => $results];
        }

        // -- Site Audit ---------------------------------------------------------
        case 'site_audit': {
            global $wpdb;
            $audit = [];
            $audit['wp_version']    = get_bloginfo('version');
            $audit['php_version']   = PHP_VERSION;
            $audit['php_ok']        = version_compare(PHP_VERSION, '8.0', '>=');
            $mem = wp_convert_hr_to_bytes(ini_get('memory_limit'));
            $audit['memory_limit']  = ini_get('memory_limit');
            $audit['memory_ok']     = $mem >= 64 * MB_IN_BYTES;
            $audit['debug_mode']    = defined('WP_DEBUG') && WP_DEBUG;
            $audit['ssl']           = is_ssl();
            $audit['siteurl_https'] = strpos(get_option('siteurl'), 'https') === 0;
            $audit['wp_config_writable'] = is_writable(ABSPATH . 'wp-config.php');
            $audit['uploads_writable']   = is_writable(wp_upload_dir()['basedir']);
            $audit['post_revisions']= (int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='revision'");
            $audit['spam_comments'] = (int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->comments} WHERE comment_approved='spam'");
            $audit['transients']    = (int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE '\_transient\_%'");
            $db_size = (float)$wpdb->get_var("SELECT SUM(data_length+index_length) FROM information_schema.tables WHERE table_schema=DATABASE()");
            $audit['db_size_mb']    = round($db_size / 1024 / 1024, 2);
            $audit['active_plugins']   = count(get_option('active_plugins', []));
            $all_plugins = get_plugins();
            $audit['inactive_plugins'] = count(array_diff(array_keys($all_plugins), get_option('active_plugins', [])));
            $update_p = get_site_transient('update_plugins');
            $update_t = get_site_transient('update_themes');
            $audit['plugin_updates'] = !empty($update_p->response) ? count($update_p->response) : 0;
            $audit['theme_updates']  = !empty($update_t->response) ? count($update_t->response) : 0;
            return ['ok' => true, 'action' => 'site_audited', 'audit' => $audit];
        }

        // -- Error Log ---------------------------------------------------------
        case 'read_error_log': {
            $log_path = $data['path'] ?? (ini_get('error_log') ?: WP_CONTENT_DIR . '/debug.log');
            $lines    = min((int)($data['lines'] ?? 100), 500);
            if (!file_exists($log_path))  return ['ok' => false, 'error' => "Log not found: $log_path"];
            if (!is_readable($log_path))  return ['ok' => false, 'error' => 'Log not readable (check permissions)'];
            $size = filesize($log_path);
            $handle = fopen($log_path, 'r');
            fseek($handle, -min($size, $lines * 250), SEEK_END);
            $content = fread($handle, min($size, $lines * 250));
            fclose($handle);
            $log_lines = array_slice(array_filter(explode("\n", $content)), -$lines);
            return ['ok' => true, 'action' => 'error_log_read', 'path' => $log_path, 'size_kb' => round($size / 1024, 1), 'lines' => array_values($log_lines)];
        }

        case 'clear_error_log': {
            $log_path = $data['path'] ?? (ini_get('error_log') ?: WP_CONTENT_DIR . '/debug.log');
            if (!file_exists($log_path)) return ['ok' => false, 'error' => "Log not found: $log_path"];
            file_put_contents($log_path, '');
            return ['ok' => true, 'action' => 'error_log_cleared', 'path' => $log_path];
        }

        // -- Cron Manager ------------------------------------------------------
        case 'list_cron_jobs': {
            $crons = _get_cron_array() ?: [];
            $jobs  = [];
            foreach ($crons as $timestamp => $hooks) {
                foreach ($hooks as $hook => $events) {
                    foreach ($events as $event) {
                        $jobs[] = [
                            'hook'     => $hook,
                            'next_run' => date('Y-m-d H:i:s', (int)$timestamp),
                            'schedule' => $event['schedule'] ?? 'once',
                            'interval' => $event['interval'] ?? null,
                            'args'     => $event['args'] ?? [],
                        ];
                    }
                }
            }
            usort($jobs, fn($a, $b) => $a['next_run'] <=> $b['next_run']);
            return ['ok' => true, 'action' => 'cron_listed', 'count' => count($jobs), 'jobs' => $jobs];
        }

        case 'clear_cron': {
            $hook = sanitize_key($data['hook'] ?? '');
            if (!$hook) return ['ok' => false, 'error' => 'clear_cron requires data.hook'];
            wp_clear_scheduled_hook($hook);
            return ['ok' => true, 'action' => 'cron_cleared', 'hook' => $hook];
        }

        case 'add_cron_job': {
            $hook     = sanitize_key($data['hook'] ?? '');
            $schedule = sanitize_key($data['schedule'] ?? 'daily');
            $start    = isset($data['start_time']) ? (int)$data['start_time'] : time();
            if (!$hook) return ['ok' => false, 'error' => 'add_cron_job requires data.hook'];
            if (!wp_next_scheduled($hook)) wp_schedule_event($start, $schedule, $hook);
            return ['ok' => true, 'action' => 'cron_added', 'hook' => $hook, 'schedule' => $schedule, 'next_run' => date('Y-m-d H:i:s', (int)wp_next_scheduled($hook))];
        }

        // -- WooCommerce -------------------------------------------------------
        // -- Theme Installer -------------------------------------------------------
        case 'theme_install': {
            $slug   = sanitize_key($data['slug'] ?? '');
            if (!$slug) return ['ok' => false, 'error' => 'theme_install requires data.slug (e.g. "storefront", "astra")'];
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
            require_once ABSPATH . 'wp-admin/includes/theme.php';
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/misc.php';

            // Check if already installed
            $themes = wp_get_themes();
            if (isset($themes[$slug])) {
                if (!empty($data['activate'])) {
                    switch_theme($slug);
                    return ['ok' => true, 'action' => 'theme_activated', 'slug' => $slug, 'note' => 'Theme was already installed; activated now.'];
                }
                return ['ok' => true, 'action' => 'theme_already_installed', 'slug' => $slug];
            }

            $api = themes_api('theme_information', ['slug' => $slug, 'fields' => ['sections' => false]]);
            if (is_wp_error($api)) return ['ok' => false, 'error' => "Theme '$slug' not found on wordpress.org: " . $api->get_error_message()];

            if (!class_exists('CVD_Theme_Skin')) {
                class CVD_Theme_Skin extends WP_Upgrader_Skin {
                    public function feedback($string, ...$args) {}
                    public function header() {}
                    public function footer() {}
                    public function error($errors) {}
                }
            }
            $upgrader = new Theme_Upgrader(new CVD_Theme_Skin());
            $result   = $upgrader->install($api->download_link);
            if (is_wp_error($result)) return ['ok' => false, 'error' => $result->get_error_message()];
            if (!$result) return ['ok' => false, 'error' => "Theme installation failed for '$slug'"];

            if (!empty($data['activate'])) switch_theme($slug);
            return ['ok' => true, 'action' => 'theme_installed', 'slug' => $slug, 'name' => $api->name, 'version' => $api->version, 'activated' => !empty($data['activate'])];
        }

        // -- WooCommerce Global Configuration -------------------------------------
        case 'wc_configure': {
            if (!class_exists('WooCommerce')) return ['ok' => false, 'error' => 'WooCommerce not active'];
            $updated = [];

            if (!empty($data['currency']))        { update_option('woocommerce_currency', strtoupper(sanitize_key($data['currency']))); $updated[] = 'currency'; }
            if (!empty($data['currency_pos']))    { update_option('woocommerce_currency_pos', sanitize_key($data['currency_pos'])); $updated[] = 'currency_pos'; }
            if (!empty($data['price_decimals']))  { update_option('woocommerce_price_num_decimals', (int)$data['price_decimals']); $updated[] = 'price_decimals'; }
            if (isset($data['tax_enabled']))      { update_option('woocommerce_calc_taxes', $data['tax_enabled'] ? 'yes' : 'no'); $updated[] = 'tax_enabled'; }
            if (isset($data['prices_include_tax'])) { update_option('woocommerce_prices_include_tax', $data['prices_include_tax'] ? 'yes' : 'no'); $updated[] = 'prices_include_tax'; }
            if (!empty($data['weight_unit']))     { update_option('woocommerce_weight_unit', sanitize_text_field($data['weight_unit'])); $updated[] = 'weight_unit'; }
            if (!empty($data['dimension_unit']))  { update_option('woocommerce_dimension_unit', sanitize_text_field($data['dimension_unit'])); $updated[] = 'dimension_unit'; }
            if (!empty($data['store_address']))   { update_option('woocommerce_store_address', sanitize_text_field($data['store_address'])); $updated[] = 'store_address'; }
            if (!empty($data['store_city']))      { update_option('woocommerce_store_city', sanitize_text_field($data['store_city'])); $updated[] = 'store_city'; }
            if (!empty($data['store_country']))   { update_option('woocommerce_default_country', sanitize_text_field($data['store_country'])); $updated[] = 'store_country'; }
            if (!empty($data['store_postcode']))  { update_option('woocommerce_store_postcode', sanitize_text_field($data['store_postcode'])); $updated[] = 'store_postcode'; }

            // Assign WooCommerce pages (shop, cart, checkout, my-account)
            foreach (['shop','cart','checkout','myaccount'] as $page_key) {
                if (!empty($data[$page_key . '_page_id'])) {
                    update_option('woocommerce_' . $page_key . '_page_id', (int)$data[$page_key . '_page_id']);
                    $updated[] = $page_key . '_page_id';
                }
            }

            // Enable/disable guest checkout
            if (isset($data['enable_guest_checkout'])) { update_option('woocommerce_enable_guest_checkout', $data['enable_guest_checkout'] ? 'yes' : 'no'); $updated[] = 'guest_checkout'; }

            // Auto-create standard WC pages if requested
            if (!empty($data['create_pages'])) {
                WC_Install::create_pages();
                $updated[] = 'pages_created';
            }

            return ['ok' => true, 'action' => 'wc_configured', 'updated' => $updated];
        }

        // -- WooCommerce Shipping --------------------------------------------------
        case 'wc_add_shipping_zone': {
            if (!class_exists('WooCommerce')) return ['ok' => false, 'error' => 'WooCommerce not active'];
            $zone = new WC_Shipping_Zone();
            $zone->set_zone_name(sanitize_text_field($data['name'] ?? 'Zone'));
            $zone->set_zone_order((int)($data['order'] ?? 0));
            $zone->save();

            // Add region locations
            if (!empty($data['regions'])) {
                foreach ((array)$data['regions'] as $region) {
                    $zone->add_location(sanitize_text_field($region['code']), sanitize_text_field($region['type'] ?? 'country'));
                }
            }

            // Add shipping methods
            $methods_added = [];
            foreach ((array)($data['methods'] ?? []) as $method) {
                $type = sanitize_key($method['type'] ?? 'flat_rate');
                $instance_id = $zone->add_shipping_method($type);
                if ($instance_id) {
                    $wc_method = WC_Shipping_Zones::get_shipping_method($instance_id);
                    if ($wc_method) {
                        $post_data = [];
                        if (isset($method['cost']))  $post_data['woocommerce_flat_rate_cost'] = (string)$method['cost'];
                        if (isset($method['title'])) $post_data['woocommerce_' . $type . '_title'] = sanitize_text_field($method['title']);
                        if ($post_data) { $_POST = array_merge($_POST, $post_data); $wc_method->process_admin_options(); }
                    }
                    $methods_added[] = ['type' => $type, 'instance_id' => $instance_id];
                }
            }

            $zone->save();
            return ['ok' => true, 'action' => 'shipping_zone_added', 'zone_id' => $zone->get_id(), 'name' => $zone->get_zone_name(), 'methods' => $methods_added];
        }

        case 'wc_list_shipping_zones': {
            if (!class_exists('WooCommerce')) return ['ok' => false, 'error' => 'WooCommerce not active'];
            $zones = WC_Shipping_Zones::get_zones();
            $out   = [];
            foreach ($zones as $z) {
                $zone  = new WC_Shipping_Zone($z['zone_id']);
                $out[] = ['zone_id' => $z['zone_id'], 'name' => $z['zone_name'], 'locations' => $z['zone_locations'], 'methods' => array_map(fn($m) => ['type' => $m->id, 'title' => $m->get_title(), 'enabled' => $m->is_enabled()], $zone->get_shipping_methods())];
            }
            return ['ok' => true, 'action' => 'shipping_zones', 'zones' => $out];
        }

        case 'wc_enable_payment': {
            if (!class_exists('WooCommerce')) return ['ok' => false, 'error' => 'WooCommerce not active'];
            $gateway_id = sanitize_key($data['gateway'] ?? '');
            if (!$gateway_id) return ['ok' => false, 'error' => 'wc_enable_payment requires data.gateway (e.g. "bacs", "cheque", "cod")'];
            $gateways = WC()->payment_gateways->payment_gateways();
            if (!isset($gateways[$gateway_id])) return ['ok' => false, 'error' => "Gateway '$gateway_id' not found. Available: " . implode(', ', array_keys($gateways))];
            $settings = get_option('woocommerce_' . $gateway_id . '_settings', []);
            $settings['enabled'] = $data['enabled'] ?? true ? 'yes' : 'no';
            if (!empty($data['title']))       $settings['title']       = sanitize_text_field($data['title']);
            if (!empty($data['description'])) $settings['description'] = sanitize_text_field($data['description']);
            update_option('woocommerce_' . $gateway_id . '_settings', $settings);
            return ['ok' => true, 'action' => 'payment_configured', 'gateway' => $gateway_id, 'enabled' => $settings['enabled']];
        }

        // -- WooCommerce Product Attributes & Variations ---------------------------
        case 'create_product_attribute': {
            if (!class_exists('WooCommerce')) return ['ok' => false, 'error' => 'WooCommerce not active'];
            $name   = sanitize_text_field($data['name'] ?? '');
            $slug   = sanitize_key($data['slug'] ?? $name);
            if (!$slug) return ['ok' => false, 'error' => 'create_product_attribute requires data.name'];
            $existing = wc_get_attribute_taxonomies();
            foreach ($existing as $attr) { if ($attr->attribute_name === $slug) return ['ok' => true, 'action' => 'attribute_exists', 'id' => $attr->attribute_id, 'slug' => $slug]; }
            $result = wc_create_attribute(['name' => $name, 'slug' => $slug, 'type' => 'select', 'order_by' => 'menu_order', 'has_archives' => false]);
            if (is_wp_error($result)) return ['ok' => false, 'error' => $result->get_error_message()];
            // Register taxonomy immediately so terms can be added right away
            $tax = wc_attribute_taxonomy_name($slug);
            if (!taxonomy_exists($tax)) register_taxonomy($tax, 'product');
            return ['ok' => true, 'action' => 'attribute_created', 'id' => $result, 'slug' => $slug, 'taxonomy' => $tax];
        }

        case 'add_product_variation': {
            if (!class_exists('WooCommerce')) return ['ok' => false, 'error' => 'WooCommerce not active'];
            $parent_id = (int)($data['product_id'] ?? 0);
            if (!$parent_id) return ['ok' => false, 'error' => 'add_product_variation requires data.product_id'];
            $parent = wc_get_product($parent_id);
            if (!$parent || $parent->get_type() !== 'variable') return ['ok' => false, 'error' => 'Product must be a variable product'];

            $variation = new WC_Product_Variation();
            $variation->set_parent_id($parent_id);
            if (isset($data['regular_price']))  $variation->set_regular_price((string)$data['regular_price']);
            if (isset($data['sale_price']))     $variation->set_sale_price((string)$data['sale_price']);
            if (!empty($data['sku']))           $variation->set_sku(sanitize_text_field($data['sku']));
            if (isset($data['stock_quantity'])) { $variation->set_manage_stock(true); $variation->set_stock_quantity((int)$data['stock_quantity']); }
            if (isset($data['weight']))         $variation->set_weight((string)$data['weight']);
            if (!empty($data['description']))   $variation->set_description($data['description']);

            // Set attributes: { "pa_brand": "Toyota", "pa_type": "OEM" }
            if (!empty($data['attributes'])) {
                $attrs = [];
                foreach ((array)$data['attributes'] as $tax => $val) {
                    $tax = wc_attribute_taxonomy_name(str_replace('pa_', '', sanitize_key($tax)));
                    $term = get_term_by('name', $val, $tax) ?: wp_insert_term($val, $tax);
                    if (!is_wp_error($term)) {
                        $slug = is_array($term) ? get_term($term['term_id'], $tax)->slug : $term->slug;
                        $attrs[$tax] = $slug;
                    }
                }
                $variation->set_attributes($attrs);
            }

            $vid = $variation->save();

            // Sync parent attributes so variations show on product page
            WC_Product_Variable::sync($parent_id);
            return ['ok' => true, 'action' => 'variation_added', 'variation_id' => $vid, 'parent_id' => $parent_id];
        }

        case 'wc_create_category': {
            if (!class_exists('WooCommerce')) return ['ok' => false, 'error' => 'WooCommerce not active'];
            $name        = sanitize_text_field($data['name'] ?? '');
            $description = sanitize_textarea_field($data['description'] ?? '');
            $parent      = (int)($data['parent_id'] ?? 0);
            if (!$name) return ['ok' => false, 'error' => 'wc_create_category requires data.name'];
            $existing = get_term_by('name', $name, 'product_cat');
            if ($existing) return ['ok' => true, 'action' => 'category_exists', 'term_id' => $existing->term_id, 'slug' => $existing->slug];
            $result = wp_insert_term($name, 'product_cat', ['description' => $description, 'parent' => $parent]);
            if (is_wp_error($result)) return ['ok' => false, 'error' => $result->get_error_message()];
            return ['ok' => true, 'action' => 'category_created', 'term_id' => $result['term_id'], 'name' => $name];
        }

        // -- create_product (enhanced with variable product + attributes) -----------
        case 'create_product': {
            if (!class_exists('WC_Product_Simple')) return ['ok' => false, 'error' => 'WooCommerce not active'];
            $type    = $data['type'] ?? 'simple';
            $product = $type === 'variable' ? new WC_Product_Variable() : new WC_Product_Simple();
            if (!empty($data['name']))              $product->set_name($data['name']);
            if (isset($data['regular_price']))      $product->set_regular_price((string)$data['regular_price']);
            if (isset($data['sale_price']))         $product->set_sale_price((string)$data['sale_price']);
            if (!empty($data['description']))       $product->set_description($data['description']);
            if (!empty($data['short_description'])) $product->set_short_description($data['short_description']);
            if (!empty($data['sku']))               $product->set_sku(sanitize_text_field($data['sku']));
            if (isset($data['stock_quantity']))     { $product->set_manage_stock(true); $product->set_stock_quantity((int)$data['stock_quantity']); }
            if (!empty($data['categories']))        $product->set_category_ids((array)$data['categories']);
            if (!empty($data['tags']))              $product->set_tag_ids((array)$data['tags']);
            if (isset($data['weight']))             $product->set_weight((string)$data['weight']);
            if (!empty($data['length']))            $product->set_length((string)$data['length']);
            if (!empty($data['width']))             $product->set_width((string)$data['width']);
            if (!empty($data['height']))            $product->set_height((string)$data['height']);
            $product->set_status($data['status'] ?? 'publish');

            // Set global attributes for variable products
            if (!empty($data['attributes']) && $type === 'variable') {
                $product_attrs = [];
                foreach ((array)$data['attributes'] as $attr_name => $attr_values) {
                    $tax   = wc_attribute_taxonomy_name(str_replace('pa_', '', sanitize_key($attr_name)));
                    $terms = [];
                    foreach ((array)$attr_values as $val) {
                        if (!taxonomy_exists($tax)) register_taxonomy($tax, 'product');
                        $term = get_term_by('name', $val, $tax);
                        if (!$term) { $r = wp_insert_term($val, $tax); $term = !is_wp_error($r) ? get_term($r['term_id'], $tax) : null; }
                        if ($term) { $terms[] = $term->term_id; }
                    }
                    if ($terms) wp_set_object_terms($product->get_id() ?: 0, $terms, $tax, true);
                    $product_attrs[$tax] = ['name' => $tax, 'value' => '', 'position' => 0, 'is_visible' => 1, 'is_variation' => 1, 'is_taxonomy' => 1];
                }
                $product->set_attributes($product_attrs);
            }

            $id = $product->save();

            // Re-set terms after save (ID now known)
            if (!empty($data['attributes']) && $type === 'variable') {
                foreach ((array)$data['attributes'] as $attr_name => $attr_values) {
                    $tax = wc_attribute_taxonomy_name(str_replace('pa_', '', sanitize_key($attr_name)));
                    $terms = [];
                    foreach ((array)$attr_values as $val) {
                        $term = get_term_by('name', $val, $tax);
                        if ($term) $terms[] = $term->term_id;
                    }
                    if ($terms) wp_set_object_terms($id, $terms, $tax, false);
                }
                WC_Product_Variable::sync($id);
            }

            return ['ok' => true, 'action' => 'product_created', 'product_id' => $id, 'url' => get_permalink($id)];
        }

        case 'update_product': {
            if (!class_exists('WooCommerce')) return ['ok' => false, 'error' => 'WooCommerce not active'];
            $pid = (int)($data['product_id'] ?? 0);
            if (!$pid) return ['ok' => false, 'error' => 'update_product requires data.product_id'];
            $product = wc_get_product($pid);
            if (!$product) return ['ok' => false, 'error' => 'Product not found'];
            if (!empty($data['name']))           $product->set_name($data['name']);
            if (isset($data['regular_price']))   $product->set_regular_price((string)$data['regular_price']);
            if (isset($data['sale_price']))      $product->set_sale_price((string)$data['sale_price']);
            if (isset($data['stock_quantity']))  { $product->set_manage_stock(true); $product->set_stock_quantity((int)$data['stock_quantity']); }
            if (!empty($data['description']))    $product->set_description($data['description']);
            if (!empty($data['status']))         $product->set_status($data['status']);
            if (isset($data['featured']))        $product->set_featured((bool)$data['featured']);
            $product->save();
            return ['ok' => true, 'action' => 'product_updated', 'product_id' => $pid];
        }

        case 'delete_product': {
            if (!class_exists('WooCommerce')) return ['ok' => false, 'error' => 'WooCommerce not active'];
            $pid = (int)($data['product_id'] ?? 0);
            if (!$pid) return ['ok' => false, 'error' => 'delete_product requires data.product_id'];
            $product = wc_get_product($pid);
            if (!$product) return ['ok' => false, 'error' => 'Product not found'];
            $product->delete((bool)($data['force'] ?? false));
            return ['ok' => true, 'action' => 'product_deleted', 'product_id' => $pid];
        }

        case 'create_coupon': {
            if (!class_exists('WC_Coupon')) return ['ok' => false, 'error' => 'WooCommerce not active'];
            $coupon = new WC_Coupon();
            $coupon->set_code(strtolower(sanitize_text_field($data['code'] ?? wp_generate_password(8, false))));
            $coupon->set_discount_type($data['type'] ?? 'percent');
            $coupon->set_amount((float)($data['amount'] ?? 10));
            if (!empty($data['expiry_date']))    $coupon->set_date_expires(strtotime($data['expiry_date']));
            if (isset($data['usage_limit']))     $coupon->set_usage_limit((int)$data['usage_limit']);
            if (isset($data['minimum_amount']))  $coupon->set_minimum_amount((string)$data['minimum_amount']);
            if (!empty($data['description']))    $coupon->set_description($data['description']);
            if (!empty($data['email_restrictions'])) $coupon->set_email_restrictions((array)$data['email_restrictions']);
            $id = $coupon->save();
            return ['ok' => true, 'action' => 'coupon_created', 'coupon_id' => $id, 'code' => $coupon->get_code(), 'type' => $coupon->get_discount_type(), 'amount' => $coupon->get_amount()];
        }

        case 'update_order': {
            if (!class_exists('WooCommerce')) return ['ok' => false, 'error' => 'WooCommerce not active'];
            $oid = (int)($data['order_id'] ?? 0);
            if (!$oid) return ['ok' => false, 'error' => 'update_order requires data.order_id'];
            $order = wc_get_order($oid);
            if (!$order) return ['ok' => false, 'error' => 'Order not found'];
            if (!empty($data['status'])) $order->update_status(sanitize_key($data['status']), $data['note'] ?? '', true);
            elseif (!empty($data['note'])) $order->add_order_note(sanitize_textarea_field($data['note']));
            $order->save();
            return ['ok' => true, 'action' => 'order_updated', 'order_id' => $oid, 'status' => $order->get_status()];
        }

        // -- User Management ---------------------------------------------------
        case 'create_user': {
            $username = sanitize_user($data['username'] ?? '');
            $email    = sanitize_email($data['email'] ?? '');
            $password = $data['password'] ?? wp_generate_password(14);
            $role     = sanitize_key($data['role'] ?? 'subscriber');
            if (!$username || !$email) return ['ok' => false, 'error' => 'create_user requires username and email'];
            $uid = wp_create_user($username, $password, $email);
            if (is_wp_error($uid)) return ['ok' => false, 'error' => $uid->get_error_message()];
            $user = new WP_User($uid);
            $user->set_role($role);
            if (!empty($data['first_name'])) update_user_meta($uid, 'first_name', sanitize_text_field($data['first_name']));
            if (!empty($data['last_name']))  update_user_meta($uid, 'last_name',  sanitize_text_field($data['last_name']));
            if (!empty($data['display_name'])) wp_update_user(['ID' => $uid, 'display_name' => sanitize_text_field($data['display_name'])]);
            return ['ok' => true, 'action' => 'user_created', 'user_id' => $uid, 'username' => $username, 'email' => $email, 'role' => $role, 'password_generated' => !isset($data['password'])];
        }

        case 'update_user': {
            $uid = (int)($data['user_id'] ?? 0);
            if (!$uid) return ['ok' => false, 'error' => 'update_user requires data.user_id'];
            $args = ['ID' => $uid];
            if (!empty($data['email']))        $args['user_email']    = sanitize_email($data['email']);
            if (!empty($data['display_name'])) $args['display_name']  = sanitize_text_field($data['display_name']);
            if (!empty($data['first_name']))   $args['first_name']    = sanitize_text_field($data['first_name']);
            if (!empty($data['last_name']))    $args['last_name']     = sanitize_text_field($data['last_name']);
            if (!empty($data['url']))          $args['user_url']      = esc_url_raw($data['url']);
            $result = wp_update_user($args);
            if (is_wp_error($result)) return ['ok' => false, 'error' => $result->get_error_message()];
            if (!empty($data['role'])) { $user = new WP_User($uid); $user->set_role(sanitize_key($data['role'])); }
            return ['ok' => true, 'action' => 'user_updated', 'user_id' => $uid];
        }

        case 'delete_user': {
            $uid      = (int)($data['user_id'] ?? 0);
            $reassign = isset($data['reassign']) ? (int)$data['reassign'] : null;
            if (!$uid) return ['ok' => false, 'error' => 'delete_user requires data.user_id'];
            require_once ABSPATH . 'wp-admin/includes/user.php';
            $ok = wp_delete_user($uid, $reassign);
            return $ok ? ['ok' => true, 'action' => 'user_deleted', 'user_id' => $uid] : ['ok' => false, 'error' => 'Could not delete user'];
        }

        case 'reset_user_password': {
            $uid      = (int)($data['user_id'] ?? 0);
            if (!$uid) return ['ok' => false, 'error' => 'reset_user_password requires data.user_id'];
            $new_pass = $data['password'] ?? wp_generate_password(14);
            wp_set_password($new_pass, $uid);
            $generated = !isset($data['password']);
            return ['ok' => true, 'action' => 'password_reset', 'user_id' => $uid, 'password_generated' => $generated, 'new_password' => $generated ? $new_pass : '(set by request)'];
        }

        case 'get_login_log': {
            $limit = min((int)($data['limit'] ?? 50), 200);
            $log   = array_slice(get_option('cvd_login_log', []), 0, $limit);
            foreach ($log as &$e) if (!empty($e['time'])) $e['time'] = date('Y-m-d H:i:s', (int)$e['time']);
            return ['ok' => true, 'action' => 'login_log', 'count' => count($log), 'log' => array_values($log)];
        }

        // -- Redirect Manager --------------------------------------------------
        case 'add_redirect': {
            $from = '/' . ltrim(sanitize_text_field($data['from'] ?? ''), '/');
            $to   = esc_url_raw($data['to'] ?? '');
            $code = in_array((int)($data['code'] ?? 301), [301, 302, 307]) ? (int)$data['code'] : 301;
            if (!$from || !$to) return ['ok' => false, 'error' => 'add_redirect requires data.from and data.to'];
            $redirects = get_option('cvd_redirects', []);
            $redirects[$from] = ['to' => $to, 'code' => $code, 'created' => date('Y-m-d')];
            update_option('cvd_redirects', $redirects);
            return ['ok' => true, 'action' => 'redirect_added', 'from' => $from, 'to' => $to, 'code' => $code];
        }

        case 'remove_redirect': {
            $from = '/' . ltrim(sanitize_text_field($data['from'] ?? ''), '/');
            $redirects = get_option('cvd_redirects', []);
            $existed = isset($redirects[$from]);
            unset($redirects[$from]);
            update_option('cvd_redirects', $redirects);
            return ['ok' => true, 'action' => 'redirect_removed', 'from' => $from, 'existed' => $existed];
        }

        case 'list_redirects': {
            return ['ok' => true, 'action' => 'redirects_listed', 'redirects' => get_option('cvd_redirects', []), 'count' => count(get_option('cvd_redirects', []))];
        }

        // -- Maintenance Mode --------------------------------------------------
        case 'set_maintenance_mode': {
            $enabled = (bool)($data['enabled'] ?? false);
            $message = sanitize_textarea_field($data['message'] ?? "We'll be back shortly. Thank you for your patience.");
            $allowed = array_map('sanitize_text_field', (array)($data['allowed_ips'] ?? []));
            update_option('cvd_maintenance_enabled', $enabled);
            update_option('cvd_maintenance_message', $message);
            update_option('cvd_maintenance_allowed_ips', $allowed);
            return ['ok' => true, 'action' => 'maintenance_' . ($enabled ? 'enabled' : 'disabled'), 'message' => $message];
        }

        // -- SSL / HTTPS Fixer -------------------------------------------------
        case 'fix_https_urls': {
            global $wpdb;
            $old = untrailingslashit(get_option('siteurl'));
            $new = str_replace('http://', 'https://', $old);
            if ($old === $new) return ['ok' => false, 'error' => 'Site is already on HTTPS or URL does not start with http://'];
            update_option('siteurl', $new);
            update_option('home', str_replace('http://', 'https://', get_option('home')));
            $posts = (int)$wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s), guid = REPLACE(guid, %s, %s)", $old, $new, $old, $new));
            $meta  = (int)$wpdb->query($wpdb->prepare("UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s) WHERE meta_value LIKE %s", $old, $new, '%' . $old . '%'));
            $opts  = (int)$wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value = REPLACE(option_value, %s, %s) WHERE option_value LIKE %s AND option_name NOT IN ('siteurl','home','cron')", $old, $new, '%' . $old . '%'));
            return ['ok' => true, 'action' => 'https_fixed', 'old_url' => $old, 'new_url' => $new, 'posts_updated' => $posts, 'meta_updated' => $meta, 'options_updated' => $opts];
        }

        // -- Image Tools -------------------------------------------------------
        case 'regenerate_thumbnails': {
            require_once ABSPATH . 'wp-admin/includes/image.php';
            $limit   = min((int)($data['limit'] ?? 50), 500);
            $images  = get_posts(['post_type' => 'attachment', 'post_mime_type' => 'image', 'numberposts' => $limit, 'post_status' => 'inherit']);
            $success = 0; $failed = 0;
            foreach ($images as $img) {
                $file = get_attached_file($img->ID);
                if (!$file || !file_exists($file)) { $failed++; continue; }
                $meta = wp_generate_attachment_metadata($img->ID, $file);
                if ($meta) { wp_update_attachment_metadata($img->ID, $meta); $success++; } else $failed++;
            }
            return ['ok' => true, 'action' => 'thumbnails_regenerated', 'success' => $success, 'failed' => $failed, 'total' => count($images)];
        }

        case 'convert_to_webp': {
            if (!function_exists('imagewebp')) return ['ok' => false, 'error' => 'WebP not supported on this server (GD extension required)'];
            $limit     = min((int)($data['limit'] ?? 20), 100);
            $quality   = min(max((int)($data['quality'] ?? 80), 1), 100);
            $images    = get_posts(['post_type' => 'attachment', 'post_mime_type' => ['image/jpeg','image/png'], 'numberposts' => $limit, 'post_status' => 'inherit']);
            $converted = 0; $skipped = 0; $failed = 0;
            foreach ($images as $img) {
                $file = get_attached_file($img->ID);
                if (!$file || !file_exists($file)) { $failed++; continue; }
                $info     = pathinfo($file);
                $webp_out = $info['dirname'] . '/' . $info['filename'] . '.webp';
                if (file_exists($webp_out)) { $skipped++; continue; }
                $mime = mime_content_type($file);
                $src  = $mime === 'image/jpeg' ? @imagecreatefromjpeg($file) : ($mime === 'image/png' ? @imagecreatefrompng($file) : false);
                if (!$src) { $failed++; continue; }
                $ok = imagewebp($src, $webp_out, $quality);
                imagedestroy($src);
                if ($ok) $converted++; else $failed++;
            }
            return ['ok' => true, 'action' => 'webp_converted', 'converted' => $converted, 'skipped' => $skipped, 'failed' => $failed, 'total' => count($images)];
        }

        // -- Broken Link Scanner -----------------------------------------------
        case 'scan_broken_links': {
            $limit    = min((int)($data['limit'] ?? 30), 100);
            $site_url = get_site_url();
            $posts    = get_posts(['numberposts' => $limit, 'post_status' => 'publish', 'post_type' => ['post','page']]);
            $broken   = [];
            foreach ($posts as $post) {
                preg_match_all('/<a[^>]+href=["\\\']([^"\\\' #][^"\\\']*)["\\\'][^>]*>/i', $post->post_content, $m);
                foreach ($m[1] as $link) {
                    if (strpos($link, 'mailto:') === 0 || strpos($link, 'tel:') === 0) continue;
                    $full = strpos($link, 'http') === 0 ? $link : $site_url . '/' . ltrim($link, '/');
                    if (strpos($full, $site_url) !== 0) continue; // external only if you want
                    $res  = wp_remote_head($full, ['timeout' => 5, 'redirection' => 2]);
                    $code = is_wp_error($res) ? 0 : (int)wp_remote_retrieve_response_code($res);
                    if ($code === 404 || $code === 0 || $code >= 500) {
                        $broken[] = ['post_id' => $post->ID, 'post_title' => $post->post_title, 'broken_url' => $link, 'status' => $code];
                        if (count($broken) >= 30) break 2;
                    }
                }
            }
            return ['ok' => true, 'action' => 'broken_links_scanned', 'posts_checked' => count($posts), 'broken_count' => count($broken), 'broken_links' => $broken];
        }

        // -- Data Export -------------------------------------------------------
        case 'export_csv': {
            global $wpdb;
            $type   = sanitize_key($data['type'] ?? 'posts');
            $limit  = min((int)($data['limit'] ?? 500), 2000);
            $rows   = []; $headers = [];

            switch ($type) {
                case 'posts': case 'pages':
                    $pt = $type === 'pages' ? 'page' : 'post';
                    $r  = $wpdb->get_results("SELECT ID,post_title,post_status,post_date,post_author,guid FROM {$wpdb->posts} WHERE post_type='$pt' AND post_status!='auto-draft' LIMIT $limit", ARRAY_A);
                    $headers = ['ID','Title','Status','Date','Author','URL'];
                    foreach ($r as $p) $rows[] = [$p['ID'],$p['post_title'],$p['post_status'],$p['post_date'],get_the_author_meta('display_name',(int)$p['post_author']),get_permalink((int)$p['ID'])];
                    break;
                case 'users':
                    $r = $wpdb->get_results("SELECT ID,user_login,user_email,user_registered,display_name FROM {$wpdb->users} LIMIT $limit", ARRAY_A);
                    $headers = ['ID','Username','Email','Registered','Display Name'];
                    foreach ($r as $u) $rows[] = [$u['ID'],$u['user_login'],$u['user_email'],$u['user_registered'],$u['display_name']];
                    break;
                case 'orders':
                    if (!class_exists('WooCommerce')) return ['ok' => false, 'error' => 'WooCommerce not active'];
                    $orders = wc_get_orders(['limit' => $limit]);
                    $headers = ['Order ID','Status','Customer','Email','Total','Date'];
                    foreach ($orders as $o) $rows[] = [$o->get_id(),$o->get_status(),$o->get_formatted_billing_full_name(),$o->get_billing_email(),$o->get_total(),$o->get_date_created()->date('Y-m-d H:i:s')];
                    break;
                case 'products':
                    if (!class_exists('WooCommerce')) return ['ok' => false, 'error' => 'WooCommerce not active'];
                    $products = wc_get_products(['limit' => $limit]);
                    $headers = ['ID','Name','Status','Regular Price','Stock','SKU'];
                    foreach ($products as $p) $rows[] = [$p->get_id(),$p->get_name(),$p->get_status(),$p->get_regular_price(),$p->get_stock_quantity(),$p->get_sku()];
                    break;
                default:
                    return ['ok' => false, 'error' => "Unknown export type '$type'. Use: posts, pages, users, orders, products"];
            }

            ob_start();
            $f = fopen('php://output', 'w');
            fputcsv($f, $headers);
            foreach ($rows as $row) fputcsv($f, $row);
            fclose($f);
            $csv = ob_get_clean();

            $uploads  = wp_upload_dir();
            $filename = 'cvd-export-' . $type . '-' . date('Y-m-d-His') . '.csv';
            $filepath = $uploads['basedir'] . '/' . $filename;
            file_put_contents($filepath, $csv);

            return ['ok' => true, 'action' => 'csv_exported', 'type' => $type, 'rows' => count($rows), 'download_url' => $uploads['baseurl'] . '/' . $filename];
        }

        // -- Webhooks ----------------------------------------------------------
        case 'add_webhook': {
            $url    = esc_url_raw($data['url'] ?? '');
            $event  = sanitize_text_field($data['event'] ?? '*');
            $secret = sanitize_text_field($data['secret'] ?? wp_generate_password(24, false));
            if (!$url) return ['ok' => false, 'error' => 'add_webhook requires data.url'];
            $webhooks = get_option('cvd_webhooks', []);
            $id = 'wh_' . substr(uniqid('', true), -8);
            $webhooks[$id] = ['url' => $url, 'event' => $event, 'secret' => $secret, 'created' => date('Y-m-d')];
            update_option('cvd_webhooks', $webhooks);
            return ['ok' => true, 'action' => 'webhook_added', 'webhook_id' => $id, 'event' => $event, 'url' => $url, 'secret' => $secret];
        }

        case 'remove_webhook': {
            $id = sanitize_key($data['webhook_id'] ?? '');
            $webhooks = get_option('cvd_webhooks', []);
            $existed  = isset($webhooks[$id]);
            unset($webhooks[$id]);
            update_option('cvd_webhooks', $webhooks);
            return ['ok' => true, 'action' => 'webhook_removed', 'webhook_id' => $id, 'existed' => $existed];
        }

        case 'list_webhooks': {
            $wh = get_option('cvd_webhooks', []);
            return ['ok' => true, 'action' => 'webhooks_listed', 'count' => count($wh), 'webhooks' => $wh];
        }

        // -- Scheduled Publish -------------------------------------------------
        case 'schedule_publish': {
            $pid  = (int)($data['post_id'] ?? 0);
            $date = sanitize_text_field($data['date'] ?? '');
            if (!$pid || !$date) return ['ok' => false, 'error' => 'schedule_publish requires data.post_id and data.date (Y-m-d H:i:s)'];
            $result = wp_update_post(['ID' => $pid, 'post_status' => 'future', 'post_date' => $date, 'post_date_gmt' => get_gmt_from_date($date)], true);
            if (is_wp_error($result)) return ['ok' => false, 'error' => $result->get_error_message()];
            return ['ok' => true, 'action' => 'post_scheduled', 'post_id' => $pid, 'publish_at' => $date];
        }

        default:
            return ['ok' => false, 'error' => "Unknown wp_action: '$action'"];
    }
}

// -- Collect site context ------------------------------------------------------
function cvd_site_context(string $command = ''): array {
    global $wpdb;
    $cmd = strtolower($command);

    // -- Plugins ----------------------------------------------------------------
    $active_plugin_files = get_option('active_plugins', []);
    $plugin_names        = [];
    foreach ($active_plugin_files as $p) {
        $data           = get_plugin_data(WP_PLUGIN_DIR . '/' . $p, false, false);
        $plugin_names[] = $data['Name'] ?: $p;
    }

    // -- Theme ------------------------------------------------------------------
    $theme     = wp_get_theme();
    $theme_dir = get_stylesheet_directory();
    $theme_info = [
        'name'       => $theme->get('Name'),
        'version'    => $theme->get('Version'),
        'template'   => $theme->get_template(),   // parent theme slug (if child)
        'stylesheet' => $theme->get_stylesheet(), // active theme slug
        'child'      => $theme->get('Template') !== '',
    ];

    // -- DB tables --------------------------------------------------------------
    $tables = $wpdb->get_col('SHOW TABLES');

    // -- Core WP settings ------------------------------------------------------
    $settings = [
        'site_title'         => get_bloginfo('name'),
        'tagline'            => get_bloginfo('description'),
        'language'           => get_locale(),
        'timezone'           => get_option('timezone_string') ?: get_option('gmt_offset') . ' UTC',
        'permalink_structure'=> get_option('permalink_structure') ?: 'plain',
        'date_format'        => get_option('date_format'),
        'uploads_url'        => wp_upload_dir()['baseurl'],
    ];

    // -- Custom post types ------------------------------------------------------
    $cpts = [];
    foreach (get_post_types(['_builtin' => false], 'objects') as $cpt) {
        $cpts[$cpt->name] = [
            'label'        => $cpt->label,
            'public'       => $cpt->public,
            'count'        => (int)(wp_count_posts($cpt->name)->publish ?? 0),
            'supports'     => get_all_post_type_supports($cpt->name),
            'taxonomies'   => get_object_taxonomies($cpt->name),
        ];
    }

    // -- Content summary --------------------------------------------------------
    $content = [
        'posts'    => (int)($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='post' AND post_status='publish'")),
        'pages'    => (int)($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='page' AND post_status='publish'")),
        'comments' => (int)(wp_count_comments()->total_comments ?? 0),
        'users'    => (int)($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->users}")),
        'media'    => (int)($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='attachment'")),
    ];

    // -- Registered nav menus ---------------------------------------------------
    $menus = [];
    foreach (get_registered_nav_menus() as $location => $description) {
        $assigned = get_nav_menu_locations();
        $menu_obj = isset($assigned[$location]) ? wp_get_nav_menu_object($assigned[$location]) : null;
        $menus[$location] = [
            'description' => $description,
            'menu_name'   => $menu_obj ? $menu_obj->name : null,
            'item_count'  => $menu_obj ? $menu_obj->count : 0,
        ];
    }

    // -- Widget areas ----------------------------------------------------------
    global $wp_registered_sidebars;
    $widget_areas = [];
    foreach (($wp_registered_sidebars ?? []) as $id => $sidebar) {
        $widgets = wp_get_sidebars_widgets();
        $widget_areas[$id] = [
            'name'         => $sidebar['name'],
            'widget_count' => count($widgets[$id] ?? []),
        ];
    }

    // -- Base context (always sent) ---------------------------------------------
    $ctx = [
        'wp_version'    => get_bloginfo('version'),
        'php_version'   => PHP_VERSION,
        'site_url'      => get_site_url(),
        'theme'         => $theme_info,
        'plugins'       => $plugin_names,
        'db_tables'     => $tables,
        'settings'      => $settings,
        'custom_post_types' => $cpts,
        'content'       => $content,
        'nav_menus'     => $menus,
        'widget_areas'  => $widget_areas,
        'stats'         => cvd_gather_stats($plugin_names),
    ];

    // -- Selective deep context (based on command keywords) --------------------
    // Theme files \u2014 sent when working on theme/templates/design
    $theme_keywords = ['theme', 'template', 'design', 'layout', 'header', 'footer', 'sidebar', 'style', 'css', 'page builder', 'elementor', 'divi'];
    foreach ($theme_keywords as $kw) {
        if (strpos($cmd, $kw) !== false) {
            $ctx['theme_files'] = cvd_list_theme_files($theme_dir);
            break;
        }
    }

    // Recent content \u2014 sent when working on posts/pages/content
    $content_keywords = ['post', 'page', 'content', 'article', 'blog', 'published', 'draft', 'category', 'tag'];
    foreach ($content_keywords as $kw) {
        if (strpos($cmd, $kw) !== false) {
            $ctx['recent_posts']  = cvd_recent_content('post', 8);
            $ctx['recent_pages']  = cvd_recent_content('page', 8);
            $ctx['categories']    = cvd_get_taxonomy_summary('category');
            $ctx['tags']          = cvd_get_taxonomy_summary('post_tag');
            break;
        }
    }

    // DB schema \u2014 sent when working on database/tables
    $db_keywords = ['database', 'table', 'query', 'sql', 'column', 'schema', 'migration', 'row', 'data'];
    foreach ($db_keywords as $kw) {
        if (strpos($cmd, $kw) !== false) {
            $ctx['db_schema'] = cvd_get_db_schema($tables);
            break;
        }
    }

    // Menu items \u2014 sent when working on navigation
    $menu_keywords = ['menu', 'navigation', 'nav', 'link'];
    foreach ($menu_keywords as $kw) {
        if (strpos($cmd, $kw) !== false) {
            $ctx['menu_items'] = cvd_get_menu_items();
            break;
        }
    }

    return $ctx;
}

// -- List theme files (paths only, not contents) -------------------------------
function cvd_list_theme_files(string $dir): array {
    $files = [];
    if (!is_dir($dir)) return $files;
    $iter = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS)
    );
    foreach ($iter as $f) {
        if (!$f->isFile()) continue;
        $ext = strtolower($f->getExtension());
        if (!in_array($ext, ['php', 'css', 'js', 'json', 'twig', 'html'])) continue;
        $files[] = str_replace($dir . DIRECTORY_SEPARATOR, '', $f->getPathname());
        if (count($files) >= 150) break;
    }
    sort($files);
    return $files;
}

// -- Recent posts/pages summary ------------------------------------------------
function cvd_recent_content(string $post_type, int $limit = 8): array {
    $posts = get_posts([
        'post_type'      => $post_type,
        'post_status'    => ['publish', 'draft'],
        'numberposts'    => $limit,
        'orderby'        => 'modified',
        'order'          => 'DESC',
    ]);
    $result = [];
    foreach ($posts as $p) {
        $result[] = [
            'id'       => $p->ID,
            'title'    => $p->post_title,
            'slug'     => $p->post_name,
            'status'   => $p->post_status,
            'modified' => $p->post_modified,
            'url'      => get_permalink($p->ID),
            'template' => get_page_template_slug($p->ID) ?: 'default',
        ];
    }
    return $result;
}

// -- Taxonomy summary ----------------------------------------------------------
function cvd_get_taxonomy_summary(string $taxonomy): array {
    $terms = get_terms(['taxonomy' => $taxonomy, 'hide_empty' => false, 'number' => 30]);
    if (is_wp_error($terms)) return [];
    $result = [];
    foreach ($terms as $t) {
        $result[] = ['id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'count' => $t->count];
    }
    return $result;
}

// -- DB schema (column names for all tables) -----------------------------------
function cvd_get_db_schema(array $tables): array {
    global $wpdb;
    $schema = [];
    foreach ($tables as $table) {
        $cols = $wpdb->get_col("DESCRIBE \`{$table}\`");
        $schema[$table] = $cols;
        if (count($schema) >= 40) break; // cap at 40 tables
    }
    return $schema;
}

// -- Full menu items -----------------------------------------------------------
function cvd_get_menu_items(): array {
    $locations = get_nav_menu_locations();
    $result    = [];
    foreach ($locations as $location => $menu_id) {
        if (!$menu_id) continue;
        $items = wp_get_nav_menu_items($menu_id);
        if (!$items) continue;
        $result[$location] = array_map(fn($i) => [
            'id'     => $i->ID,
            'title'  => $i->title,
            'url'    => $i->url,
            'type'   => $i->object,
            'parent' => $i->menu_item_parent ?: null,
        ], $items);
    }
    return $result;
}

// -- Gather live site statistics for AI context ---------------------------------
function cvd_gather_stats(array $plugin_names = []): array {
    global $wpdb;
    $stats = [];
    $today = date('Y-m-d');
    $month = date('Y-m');

    // -- Core WP stats ----------------------------------------------------------
    $post_counts = wp_count_posts();
    $stats['posts_published']   = (int)($post_counts->publish ?? 0);
    $stats['posts_draft']       = (int)($post_counts->draft ?? 0);
    $stats['pages_published']   = (int)(wp_count_posts('page')->publish ?? 0);
    $stats['total_comments']    = (int)(wp_count_comments()->total_comments ?? 0);
    $stats['registered_users']  = (int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->users}");

    // -- WooCommerce ------------------------------------------------------------
    if (class_exists('WooCommerce')) {
        $stats['woocommerce'] = true;
        $stats['wc_orders_today'] = (int)$wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->posts}
             WHERE post_type = 'shop_order'
               AND post_status IN ('wc-completed','wc-processing','wc-on-hold')
               AND DATE(post_date) = %s", $today
        ));
        $stats['wc_orders_month'] = (int)$wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->posts}
             WHERE post_type = 'shop_order'
               AND post_status IN ('wc-completed','wc-processing')
               AND DATE_FORMAT(post_date,'%%Y-%%m') = %s", $month
        ));
        $stats['wc_revenue_month'] = (float)$wpdb->get_var($wpdb->prepare(
            "SELECT SUM(pm.meta_value) FROM {$wpdb->posts} p
             JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID AND pm.meta_key = '_order_total'
             WHERE p.post_type = 'shop_order'
               AND p.post_status IN ('wc-completed','wc-processing')
               AND DATE_FORMAT(p.post_date,'%%Y-%%m') = %s", $month
        ));
        $stats['wc_products'] = (int)(wp_count_posts('product')->publish ?? 0);
    }

    // -- WP-Statistics ----------------------------------------------------------
    if ($wpdb->get_var("SHOW TABLES LIKE '{$wpdb->prefix}statistics_visit'")) {
        $stats['wp_statistics'] = true;
        $stats['visitors_today'] = (int)$wpdb->get_var($wpdb->prepare(
            "SELECT SUM(visit) FROM {$wpdb->prefix}statistics_visit WHERE last_counter = %s", $today
        ));
        $stats['visitors_yesterday'] = (int)$wpdb->get_var($wpdb->prepare(
            "SELECT SUM(visit) FROM {$wpdb->prefix}statistics_visit WHERE last_counter = %s",
            date('Y-m-d', strtotime('-1 day'))
        ));
        $stats['visitors_month'] = (int)$wpdb->get_var($wpdb->prepare(
            "SELECT SUM(visit) FROM {$wpdb->prefix}statistics_visit WHERE DATE_FORMAT(last_counter,'%%Y-%%m') = %s", $month
        ));
    }

    // -- Jetpack Stats ----------------------------------------------------------
    if (function_exists('stats_get_csv')) {
        $jetpack_today = stats_get_csv('postviews', ['days' => 1, 'limit' => 1]);
        if ($jetpack_today !== false) {
            $stats['jetpack_stats'] = true;
            $stats['visitors_today'] = $stats['visitors_today'] ?? array_sum(array_column((array)$jetpack_today, 'views'));
        }
    }

    // -- MonsterInsights / GADWP ------------------------------------------------
    if (in_array('Google Analytics by MonsterInsights', $plugin_names) ||
        in_array('Google Analytics Dashboard Plugin for WordPress by ExactMetrics', $plugin_names)) {
        $stats['monsterinsights'] = true;
        // Data is in Google Analytics \u2014 not directly queryable from WP
    }

    // -- Contact Form 7 submissions ---------------------------------------------
    if (in_array('Contact Form 7', $plugin_names)) {
        $stats['cf7_active'] = true;
    }

    // -- No analytics detected --------------------------------------------------
    if (!isset($stats['wp_statistics']) && !isset($stats['jetpack_stats']) && !isset($stats['monsterinsights'])) {
        $stats['no_visitor_tracking'] = true;
    }

    return $stats;
}

// -- AJAX: send command --------------------------------------------------------
add_action('wp_ajax_cvd_command', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);
    if (!cvd_rate_check())                   wp_send_json_error('Rate limit reached. Wait a moment.', 429);

    // -- License check (client gate \u2014 real enforcement is server-side) ---------
    if (!cvd_license_ok()) {
        $status = get_option('cvd_license_status', '');
        if ($status === 'revoked') {
            wp_send_json_error('This plugin license has been revoked. Contact CooVex support.', 403);
        }
        if ($status === 'site_mismatch') {
            wp_send_json_error('License is registered to a different domain.', 403);
        }
        wp_send_json_error('License not validated. Check your API key in Settings.', 402);
    }

    $api_key = get_option('cvd_api_key', '');
    if (empty($api_key)) wp_send_json_error('API key not configured. Go to CooVex Dev → Settings.', 400);

    $command = sanitize_textarea_field($_POST['command'] ?? '');
    if (empty($command)) wp_send_json_error('Empty command', 400);

    $raw_history = json_decode(stripslashes($_POST['history'] ?? '[]'), true) ?? [];
    $history     = array_slice($raw_history, -10);

    // Generate a one-time nonce for replay prevention
    $request_nonce = bin2hex(random_bytes(16));

    $site_context = cvd_site_context($command);

    // If command is security-related, run scan and include results in context
    $sec_keywords = ['security', 'malware', 'hack', 'hacked', 'scan', 'inject', 'suspicious', 'virus', 'infected', 'clean my', 'vulnerability', 'vulnerab'];
    $cmd_lower    = strtolower($command);
    foreach ($sec_keywords as $kw) {
        if (strpos($cmd_lower, $kw) !== false) {
            $site_context['security_scan'] = cvd_security_scan();
            break;
        }
    }
    $body         = wp_json_encode([
        'api_key'        => $api_key,
        'command'        => $command,
        'history'        => $history,
        'site_info'      => $site_context,
        'request_nonce'  => $request_nonce,
    ]);

    $response = wp_remote_post(CVD_API_URL, [
        'timeout' => 90,
        'headers' => [
            'Content-Type' => 'application/json',
            'User-Agent'   => 'CooVex-Dev/' . CVD_VERSION . ' WordPress/' . get_bloginfo('version'),
        ],
        'body' => $body,
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error('Could not reach CooVex: ' . $response->get_error_message());
    }

    $code         = wp_remote_retrieve_response_code($response);
    $raw_body     = wp_remote_retrieve_body($response);
    $sig          = wp_remote_retrieve_header($response, 'x-cvd-sig');
    $returned_nonce = wp_remote_retrieve_header($response, 'x-cvd-nonce');
    $payload      = json_decode($raw_body, true);

    if ($code === 402) {
        wp_send_json_error($payload['error'] ?? 'Insufficient credits.', 402);
    }
    if ($code === 403) {
        wp_send_json_error($payload['error'] ?? 'Access denied.', 403);
    }
    if ($code !== 200 || empty($payload['ok'])) {
        wp_send_json_error($payload['error'] ?? 'API error (HTTP ' . $code . ')');
    }

    // -- Verify HMAC signature -------------------------------------------------
    // The server signs the response with the daily license token.
    // If the nonce doesn't match what we sent, or the signature is wrong,
    // the response was tampered with or forged \u2014 reject it entirely.
    if (!empty($sig)) {
        if ($returned_nonce !== $request_nonce) {
            wp_send_json_error('Response nonce mismatch \u2014 possible replay attack detected.', 400);
        }
        if (!cvd_verify_response($raw_body, $sig, $request_nonce)) {
            // Signature failed: try refreshing license token (in case it just rotated at midnight)
            cvd_license_validate();
            if (!cvd_verify_response($raw_body, $sig, $request_nonce)) {
                wp_send_json_error('Response integrity check failed. Do not apply changes.', 400);
            }
        }
    }

    $changes       = $payload['changes'] ?? [];
    $results       = [];
    $files_touched = [];

    if (!empty($changes)) {
        foreach ($changes as $ch) {
            if (($ch['type'] ?? 'file') === 'file' && !empty($ch['file'])) {
                $files_touched[] = $ch['file'];
            }
        }

        // Snapshot BEFORE applying
        $snap_id = cvd_snapshot_take($files_touched, $command);

        foreach ($changes as $ch) {
            $results[] = cvd_apply_change($ch);
        }
    }

    cvd_audit_log([
        'command'   => $command,
        'changes'   => count($changes),
        'snap_id'   => $snap_id ?? null,
        'sig_ok'    => !empty($sig),
        'user'      => wp_get_current_user()->user_login,
        'time'      => time(),
    ]);

    wp_send_json_success([
        'message'           => $payload['message'],
        'changes'           => $results,
        'snap_id'           => $snap_id ?? null,
        'credits_used'      => $payload['credits_used'] ?? null,
        'credits_remaining' => $payload['credits_remaining'] ?? null,
        'read_only'         => $payload['read_only'] ?? false,
    ]);
});

// ── AJAX: get_context (browser gets credentials for direct SSE streaming) ─────
add_action('wp_ajax_cvd_get_context', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);
    if (!cvd_rate_check())                   wp_send_json_error('Rate limit reached.', 429);

    if (!cvd_license_ok()) {
        $status = get_option('cvd_license_status', '');
        if ($status === 'revoked')       wp_send_json_error('License revoked.', 403);
        if ($status === 'site_mismatch') wp_send_json_error('License domain mismatch.', 403);
        wp_send_json_error('License not validated. Check your API key in Settings.', 402);
    }

    $api_key = get_option('cvd_api_key', '');
    if (empty($api_key)) wp_send_json_error('API key not configured.', 400);

    $command       = sanitize_textarea_field($_POST['command'] ?? '');
    $request_nonce = bin2hex(random_bytes(16));
    $site_context  = cvd_site_context($command);

    $cmd_lower    = strtolower($command);
    $sec_keywords = ['security','malware','hack','hacked','scan','inject','suspicious','virus','infected','clean my','vulnerability'];
    foreach ($sec_keywords as $kw) {
        if (strpos($cmd_lower, $kw) !== false) {
            $site_context['security_scan'] = cvd_security_scan();
            break;
        }
    }

    $raw_history = json_decode(stripslashes($_POST['history'] ?? '[]'), true) ?? [];
    $history     = array_slice($raw_history, -10);

    wp_send_json_success([
        'api_key'       => $api_key,
        'stream_url'    => CVD_API_URL,
        'site_info'     => $site_context,
        'history'       => $history,
        'request_nonce' => $request_nonce,
    ]);
});

// ── AJAX: apply_changes (browser sends SSE result; PHP verifies + applies) ────
add_action('wp_ajax_cvd_apply_changes', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);

    $changes   = json_decode(stripslashes($_POST['changes']   ?? '[]'), true) ?? [];
    $sig       = sanitize_text_field($_POST['sig']       ?? '');
    $sig_nonce = sanitize_text_field($_POST['sig_nonce'] ?? '');
    $raw_body  = wp_unslash($_POST['raw_body'] ?? '');
    $command   = sanitize_textarea_field($_POST['command'] ?? '');

    if (!empty($sig) && !empty($raw_body)) {
        if (!cvd_verify_response($raw_body, $sig, $sig_nonce)) {
            cvd_license_validate();
            if (!cvd_verify_response($raw_body, $sig, $sig_nonce)) {
                wp_send_json_error('Response integrity check failed. Changes not applied.', 400);
            }
        }
    }

    $files_touched = [];
    foreach ($changes as $ch) {
        if (($ch['type'] ?? 'file') === 'file' && !empty($ch['file'])) {
            $files_touched[] = $ch['file'];
        }
    }

    $snap_id = !empty($files_touched) ? cvd_snapshot_take($files_touched, $command) : null;

    $results = [];
    foreach ($changes as $ch) {
        $results[] = cvd_apply_change($ch);
    }

    cvd_audit_log([
        'command' => $command,
        'changes' => count($changes),
        'snap_id' => $snap_id,
        'sig_ok'  => !empty($sig),
        'user'    => wp_get_current_user()->user_login,
        'time'    => time(),
    ]);

    wp_send_json_success([
        'results' => $results,
        'snap_id' => $snap_id,
    ]);
});

// -- AJAX: rollback ------------------------------------------------------------
add_action('wp_ajax_cvd_rollback', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);

    $snap_id = sanitize_text_field($_POST['snap_id'] ?? '');
    $result  = cvd_snapshot_rollback($snap_id);

    if ($result['ok']) {
        cvd_audit_log(['command' => 'ROLLBACK to ' . $snap_id, 'user' => wp_get_current_user()->user_login, 'time' => time()]);
        wp_send_json_success($result);
    } else {
        wp_send_json_error($result['error']);
    }
});

// -- Floating AI Widget --------------------------------------------------------
function cvd_render_floating_widget(): void {
    $nonce = wp_create_nonce('cvd_nonce');
    $ajax  = admin_url('admin-ajax.php');
    ?>
<style id="cvd-float-css">
#cvd-w,#cvd-w *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
#cvd-w{position:fixed;bottom:24px;right:24px;z-index:2147483647}
#cvd-wb{width:54px;height:54px;border-radius:50%;background:#2563eb;border:none;cursor:pointer;
  box-shadow:0 4px 24px rgba(37,99,235,.55);display:flex;align-items:center;justify-content:center;
  padding:0;transition:transform .18s,box-shadow .18s}
#cvd-wb:hover{transform:scale(1.08);box-shadow:0 6px 32px rgba(37,99,235,.7)}
#cvd-wb svg{width:26px;height:26px}
#cvd-wp{position:absolute;bottom:66px;right:0;width:360px;background:#fff;border-radius:16px;
  box-shadow:0 12px 60px rgba(0,0,0,.18);display:none;flex-direction:column;
  overflow:hidden;max-height:530px;border:1px solid rgba(0,0,0,.07)}
#cvd-wh{background:#2563eb;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
#cvd-whl{display:flex;align-items:center;gap:8px;color:#fff;font-size:14px;font-weight:600}
#cvd-wdot{width:8px;height:8px;border-radius:50%;background:#4ade80;animation:cvdp 2s infinite}
@keyframes cvdp{0%,100%{opacity:1}50%{opacity:.35}}
#cvd-wcls{background:none;border:none;color:rgba(255,255,255,.65);cursor:pointer;font-size:20px;
  padding:0;line-height:1;transition:color .12s;display:flex;align-items:center}
#cvd-wcls:hover{color:#fff}
#cvd-wctx{background:#1d4ed8;padding:5px 14px;font-size:11px;color:rgba(255,255,255,.7);
  flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cvd-wm{flex:1;overflow-y:auto;padding:14px 14px 6px;display:flex;flex-direction:column;gap:10px;min-height:60px}
#cvd-wm::-webkit-scrollbar{width:3px}
#cvd-wm::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:2px}
.cvd-msg{max-width:88%;padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.55;word-break:break-word}
.cvd-u{align-self:flex-end;background:#2563eb;color:#fff;border-bottom-right-radius:3px}
.cvd-a{align-self:flex-start;background:#f1f5f9;color:#1e293b;border-bottom-left-radius:3px;white-space:pre-wrap}
.cvd-err{background:#fef2f2!important;color:#991b1b!important}
.cvd-thumb{max-width:100%;border-radius:8px;margin-bottom:6px;display:block}
#cvd-wprv{padding:8px 14px;border-top:1px solid #f8fafc;display:none;align-items:center;gap:10px;flex-shrink:0}
#cvd-wpi{height:44px;border-radius:6px;object-fit:cover;border:1px solid #e2e8f0;display:none}
#cvd-wfc{display:none;align-items:center;gap:8px;background:#f8fafc;border-radius:8px;padding:5px 10px;flex:1;min-width:0}
#cvd-wfi{width:28px;height:28px;border-radius:6px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px}
#cvd-wfn{font-size:12px;font-weight:500;color:#1e293b;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#cvd-wfs{font-size:11px;color:#94a3b8;flex-shrink:0;white-space:nowrap}
#cvd-wpl{font-size:12px;color:#64748b;flex-shrink:0}
#cvd-wrm{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;padding:2px;
  line-height:1;transition:color .12s;display:flex}
#cvd-wrm:hover{color:#ef4444}
#cvd-wi{border-top:1px solid #f1f5f9;padding:10px 12px;display:flex;gap:8px;align-items:flex-end;flex-shrink:0}
#cvd-wtx{flex:1;border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 11px;font-size:13px;
  resize:none;outline:none;font-family:inherit;line-height:1.45;max-height:96px;overflow-y:auto;
  color:#1e293b;background:#fff;transition:border-color .15s}
#cvd-wtx:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
#cvd-wtx::placeholder{color:#94a3b8}
#cvd-wil{cursor:pointer;color:#94a3b8;display:flex;align-items:center;transition:color .12s;padding:4px}
#cvd-wil:hover{color:#2563eb}
#cvd-wil svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#cvd-wsd{background:#2563eb;border:none;border-radius:9px;width:36px;height:36px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s}
#cvd-wsd:hover:not(:disabled){background:#1d4ed8}
#cvd-wsd:disabled{background:#bfdbfe;cursor:not-allowed}
#cvd-wsd svg{width:15px;height:15px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.cvd-typing span{display:inline-block;width:6px;height:6px;background:#94a3b8;border-radius:50%;
  margin:0 2px;animation:cvdt .9s infinite both}
.cvd-typing span:nth-child(2){animation-delay:.15s}
.cvd-typing span:nth-child(3){animation-delay:.3s}
@keyframes cvdt{0%,80%,100%{transform:scale(.6);opacity:.5}40%{transform:scale(1);opacity:1}}
</style>
<div id="cvd-w">
  <div id="cvd-wp">
    <div id="cvd-wh">
      <div id="cvd-whl"><div id="cvd-wdot"></div>CooVex AI</div>
      <button id="cvd-wcls" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div id="cvd-wctx">Loading...</div>
    <div id="cvd-wm">
      <div class="cvd-msg cvd-a">Hi! I can see your WordPress site. Type a command or paste a screenshot (Ctrl+V).</div>
    </div>
    <div id="cvd-wprv">
      <img id="cvd-wpi" src="" alt="screenshot">
      <div id="cvd-wfc"><div id="cvd-wfi"></div><span id="cvd-wfn"></span><span id="cvd-wfs"></span></div>
      <span id="cvd-wpl">Attached</span>
      <button id="cvd-wrm" aria-label="Remove attachment">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap:round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div id="cvd-wi">
      <textarea id="cvd-wtx" rows="1" placeholder="Ask anything... paste screenshot (Ctrl+V) or attach file"></textarea>
      <label id="cvd-wil" title="Attach file or screenshot">
        <svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        <input type="file" id="cvd-wf" accept="image/*,.csv,.txt,.json,.pdf,.doc,.docx,.xls,.xlsx,.md,.log,.tsv" style="display:none">
      </label>
      <button id="cvd-wsd" disabled aria-label="Send">
        <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  </div>
  <button id="cvd-wb" aria-label="CooVex AI Agent">
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="8" width="18" height="13" rx="3" fill="white" opacity=".9"/>
      <circle cx="8.5" cy="14" r="1.5" fill="#2563eb"/>
      <circle cx="15.5" cy="14" r="1.5" fill="#2563eb"/>
      <path d="M9 17.5s1.2 1 3 1 3-1 3-1" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <path d="M8 8V6a4 4 0 018 0v2" stroke="white" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <circle cx="12" cy="4.5" r="1" fill="white"/>
    </svg>
  </button>
</div>
<script>
(function(){
  'use strict';
  var AJAX='<?php echo esc_js($ajax); ?>';
  var NONCE='<?php echo esc_js($nonce); ?>';
  var isAdmin=<?php echo is_admin() ? 'true' : 'false'; ?>;
  var screenshot=null, fileData=null, open=false;

  var $=function(id){return document.getElementById(id);};
  var panel=$('cvd-wp'), btn=$('cvd-wb'), cls=$('cvd-wcls');
  var msgs=$('cvd-wm'), txt=$('cvd-wtx'), snd=$('cvd-wsd');
  var prv=$('cvd-wprv'), pi=$('cvd-wpi'), rm=$('cvd-wrm');
  var fc=$('cvd-wfc'), fi=$('cvd-wfi'), fn=$('cvd-wfn'), fs=$('cvd-wfs'), fp=$('cvd-wpl');
  var file=$('cvd-wf'), ctx=$('cvd-wctx');

  var screenCtx=(isAdmin?'WP Admin \u2014 ':'')+document.title.replace(' \u2039 '+document.title.split(' \u2039 ').pop(),'');
  ctx.textContent=screenCtx; ctx.title=screenCtx;

  function hasAttachment(){ return !!(screenshot||fileData); }

  function toggle(){
    open=!open;
    panel.style.display=open?'flex':'none';
    if(open)setTimeout(function(){txt.focus();},80);
  }
  btn.addEventListener('click',toggle);
  cls.addEventListener('click',function(){open=false;panel.style.display='none';});

  txt.addEventListener('input',function(){
    this.style.height='auto';
    this.style.height=Math.min(this.scrollHeight,96)+'px';
    snd.disabled=!(this.value.trim()||hasAttachment());
  });
  txt.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!snd.disabled)send();}
  });

  // -- Helpers --------------------------------------------------------------
  function fmtSize(b){
    if(b<1024)return b+' B';
    if(b<1048576)return (b/1024).toFixed(1)+' KB';
    return (b/1048576).toFixed(1)+' MB';
  }
  function fileIcon(type,name){
    if(/pdf/i.test(type))return 'PDF';
    if(/csv|tsv/i.test(type)||/\.(csv|tsv)$/i.test(name))return 'CSV';
    if(/sheet|excel|xlsx|xls/i.test(type+name))return 'XLS';
    if(/word|docx|doc/i.test(type+name))return 'DOC';
    if(/json/i.test(type+name))return 'JSON';
    if(/xml/i.test(type+name))return 'XML';
    return 'FILE';
  }

  function clearAttachment(){
    screenshot=null; fileData=null;
    pi.style.display='none'; pi.src='';
    fc.style.display='none';
    prv.style.display='none';
    snd.disabled=!txt.value.trim();
  }

  function showImgPreview(dataUrl){
    fc.style.display='none';
    pi.src=dataUrl; pi.style.display='block';
    fp.textContent='Screenshot attached';
    prv.style.display='flex';
    snd.disabled=!(txt.value.trim()||hasAttachment());
  }

  function showFileChip(name,size,type){
    pi.style.display='none';
    fi.textContent=fileIcon(type,name);
    fn.textContent=name;
    fs.textContent=fmtSize(size);
    fc.style.display='flex';
    fp.textContent='File attached';
    prv.style.display='flex';
    snd.disabled=!(txt.value.trim()||hasAttachment());
  }

  // -- Screenshot compression ------------------------------------------------
  function setShot(dataUrl){
    var img=new Image();
    img.onload=function(){
      var mw=1280,mh=900,w=img.width,h=img.height;
      if(w>mw){h=h*mw/w;w=mw;}
      if(h>mh){w=w*mh/h;h=mh;}
      var c=document.createElement('canvas');
      c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      screenshot=c.toDataURL('image/jpeg',0.82);
      fileData=null;
      showImgPreview(screenshot);
    };
    img.src=dataUrl;
  }

  // -- File handler: routes image vs text vs binary --------------------------
  function handleFile(f){
    var MAX_TEXT=512*1024, MAX_BIN=10*1024*1024;
    var name=f.name, type=f.type||'', size=f.size;
    if(size>MAX_BIN){alert('File too large (max 10 MB).');return;}
    if(type.startsWith('image/')){
      var r=new FileReader();r.onload=function(e){setShot(e.target.result);};r.readAsDataURL(f);return;
    }
    var isText=type.startsWith('text/')||/\.(csv|tsv|txt|json|xml|md|log)$/i.test(name);
    if(isText){
      var r=new FileReader();
      r.onload=function(e){
        var content=e.target.result;
        if(content.length>MAX_TEXT)content=content.substring(0,MAX_TEXT)+'\n[... truncated at 500 KB ...]';
        screenshot=null;
        fileData={name:name,type:type||'text/plain',encoding:'text',content:content,size:size};
        showFileChip(name,size,type);
      };
      r.readAsText(f);return;
    }
    // Binary (PDF, DOCX, XLSX, etc.) → base64
    var r=new FileReader();
    r.onload=function(e){
      var dataUrl=e.target.result;
      var b64=dataUrl.replace(/^data:[^;]+;base64,/,'');
      if(b64.length>14*1024*1024){alert('File too large after encoding.');return;}
      screenshot=null;
      fileData={name:name,type:type||'application/octet-stream',encoding:'base64',content:b64,size:size};
      showFileChip(name,size,type);
    };
    r.readAsDataURL(f);
  }

  file.addEventListener('change',function(){if(this.files[0])handleFile(this.files[0]);this.value='';});
  rm.addEventListener('click',clearAttachment);

  // Paste image
  document.addEventListener('paste',function(e){
    if(!open)return;
    var items=(e.clipboardData||{}).items||[];
    for(var i=0;i<items.length;i++){
      if(items[i].type.indexOf('image')!==-1){
        var r=new FileReader();r.onload=function(ev){setShot(ev.target.result);};
        r.readAsDataURL(items[i].getAsFile());e.preventDefault();break;
      }
    }
  });

  // Drag-and-drop files onto widget panel
  panel.addEventListener('dragover',function(e){e.preventDefault();panel.style.outline='2px dashed #2563eb';});
  panel.addEventListener('dragleave',function(){panel.style.outline='';});
  panel.addEventListener('drop',function(e){
    e.preventDefault();panel.style.outline='';
    var f=e.dataTransfer&&e.dataTransfer.files[0];
    if(f)handleFile(f);
  });

  // -- Message rendering -----------------------------------------------------
  function addMsg(html,cls,thumb){
    var d=document.createElement('div');d.className='cvd-msg '+cls;
    if(thumb){var im=document.createElement('img');im.className='cvd-thumb';im.src=thumb;d.appendChild(im);}
    if(cls==='cvd-a'&&html==='\u2026'){
      var t=document.createElement('div');t.className='cvd-typing';
      t.innerHTML='<span></span><span></span><span></span>';d.appendChild(t);
    }else{d.appendChild(document.createTextNode(html));}
    msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d;
  }

  // -- Send ------------------------------------------------------------------
  function send(){
    var cmd=txt.value.trim();
    if(!cmd&&!hasAttachment())return;
    var label=cmd||(screenshot?'[screenshot]':fileData?('['+fileData.name+']'):'');
    addMsg(label,'cvd-u',screenshot||null);
    txt.value='';txt.style.height='auto';
    var shot=screenshot,fd=fileData;
    clearAttachment();
    snd.disabled=true;
    var typing=addMsg('\u2026','cvd-a');

    var defaultCmd=shot
      ?'Analyze this screenshot and tell me what you see. Suggest what I can do or ask me for a specific task.'
      :(fd?'I have attached a file called "'+fd.name+'". Please analyze it and perform the task I described, or tell me what it contains and what you can do with it.'
          :'');

    var p=new URLSearchParams();
    p.append('action','cvd_float_command');
    p.append('nonce',NONCE);
    p.append('command',cmd||defaultCmd);
    p.append('screen_context',screenCtx);
    p.append('current_url',location.href);
    if(shot)p.append('screenshot',shot);
    if(fd)p.append('file_data',JSON.stringify(fd));

    fetch(AJAX,{method:'POST',body:p})
      .then(function(r){return r.json();})
      .then(function(res){
        msgs.removeChild(typing);
        if(res.success){
          addMsg((res.data&&res.data.message)||'Done.','cvd-a');
          var app=res.data&&res.data.applied?res.data.applied.filter(function(c){return c.ok;}).length:0;
          if(app)addMsg('\u2714 '+app+' change'+(app>1?'s':'')+' applied.','cvd-a');
        }else{addMsg(res.data||'Something went wrong.','cvd-a cvd-err');}
        snd.disabled=!txt.value.trim();
      })
      .catch(function(){
        msgs.removeChild(typing);
        addMsg('Network error \u2014 please try again.','cvd-a cvd-err');
        snd.disabled=!txt.value.trim();
      });
  }
  snd.addEventListener('click',send);
})();
</script>
    <?php
}

// Inject widget on ALL admin pages (except the main CooVex Dev page to avoid duplicates)
add_action('admin_footer', function () {
    if (!cvd_license_ok()) return;
    $screen = get_current_screen();
    if ($screen && strpos($screen->id, 'coovex-dev') !== false) return;
    cvd_render_floating_widget();
});

// Inject widget on the FRONTEND when an admin is logged in
add_action('wp_footer', function () {
    if (!is_user_logged_in() || !current_user_can('manage_options')) return;
    if (!cvd_license_ok()) return;
    cvd_render_floating_widget();
});

// -- AJAX: floating widget command (no CVD session required \u2014 WP admin cap is enough) --
add_action('wp_ajax_cvd_float_command', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);
    if (!cvd_license_ok())                  wp_send_json_error('License not active. Open CooVex Dev to configure.', 402);
    if (!cvd_rate_check())                  wp_send_json_error('Rate limit reached. Wait a moment.', 429);

    $command    = sanitize_textarea_field(wp_unslash($_POST['command'] ?? ''));
    $screen_ctx = sanitize_text_field(wp_unslash($_POST['screen_context'] ?? ''));
    $curr_url   = esc_url_raw(wp_unslash($_POST['current_url'] ?? ''));
    $screenshot = wp_unslash($_POST['screenshot'] ?? '');
    $file_raw   = wp_unslash($_POST['file_data'] ?? '');

    // Validate screenshot
    if ($screenshot && !preg_match('/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+\/=\r\n]+$/', trim($screenshot))) $screenshot = '';
    if (strlen($screenshot) > 3 * 1024 * 1024) $screenshot = '';

    // Validate file_data JSON
    $file_data = null;
    if ($file_raw) {
        $fd = json_decode($file_raw, true);
        $allowed_types = ['text/plain','text/csv','text/tsv','application/json','application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/msword','application/vnd.ms-excel','application/octet-stream',''];
        if (is_array($fd) && !empty($fd['name']) && !empty($fd['encoding']) && isset($fd['content'])) {
            // Size limits: text 1MB, binary 10MB base64
            $max = ($fd['encoding'] === 'text') ? 1024 * 1024 : 12 * 1024 * 1024;
            if (strlen($fd['content']) <= $max) {
                $file_data = [
                    'name'     => sanitize_file_name($fd['name']),
                    'type'     => sanitize_text_field($fd['type'] ?? ''),
                    'encoding' => $fd['encoding'] === 'base64' ? 'base64' : 'text',
                    'content'  => $fd['content'],
                    'size'     => (int)($fd['size'] ?? 0),
                ];
            }
        }
    }

    if (empty($command)) {
        if ($screenshot) $command = 'Analyze this screenshot of my WordPress admin and tell me what you see. Suggest what I should do.';
        elseif ($file_data) $command = 'I have attached a file called "' . $file_data['name'] . '". Analyze it and tell me what it contains and what you can do with it.';
        else wp_send_json_error('Empty command', 400);
    }

    $api_key = get_option('cvd_api_key', '');
    if (empty($api_key)) wp_send_json_error('API key not configured. Open CooVex Dev to set it up.', 400);

    $site_info = cvd_site_context($command);
    if ($screen_ctx) $site_info['current_screen'] = $screen_ctx;
    if ($curr_url)   $site_info['current_url']    = $curr_url;

    $payload = wp_json_encode([
        'api_key'        => $api_key,
        'command'        => $command,
        'history'        => [],
        'site_info'      => $site_info,
        'screenshot'     => $screenshot,
        'file_data'      => $file_data,
        'request_nonce'  => bin2hex(random_bytes(16)),
    ]);

    $response = wp_remote_post(CVD_API_URL, [
        'timeout' => 90,
        'headers' => ['Content-Type' => 'application/json', 'User-Agent' => 'CooVex-Dev-Float/' . CVD_VERSION],
        'body'    => $payload,
    ]);

    if (is_wp_error($response)) wp_send_json_error('Could not reach CooVex: ' . $response->get_error_message());

    $code     = wp_remote_retrieve_response_code($response);
    $raw_body = wp_remote_retrieve_body($response);
    $data     = json_decode($raw_body, true);

    if ($code === 402) wp_send_json_error($data['error'] ?? 'Insufficient credits.', 402);
    if ($code !== 200) wp_send_json_error($data['error'] ?? 'Server error ('.$code.').', $code);

    // Apply any changes the AI requested
    $changes = $data['changes'] ?? [];
    $applied = [];
    if (!empty($changes) && !($data['read_only'] ?? false)) {
        foreach ($changes as $change) {
            $result    = cvd_apply_change($change);
            $applied[] = array_merge($change, ['ok' => ($result['ok'] ?? false), 'result' => $result]);
        }
    }

    wp_send_json_success(['message' => $data['message'] ?? '', 'applied' => $applied]);
});

// -- AJAX: get file tree -------------------------------------------------------
add_action('wp_ajax_cvd_file_tree', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);

    $base = sanitize_text_field($_POST['base'] ?? 'plugins');
    $root = ($base === 'themes') ? get_theme_root() : WP_PLUGIN_DIR;
    $path = sanitize_text_field($_POST['path'] ?? '');

    $dir   = $root . ($path ? DIRECTORY_SEPARATOR . $path : '');
    $items = [];

    if (is_dir($dir)) {
        foreach (scandir($dir) as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $full  = $dir . DIRECTORY_SEPARATOR . $entry;
            $items[] = [
                'name' => $entry,
                'type' => is_dir($full) ? 'dir' : 'file',
                'size' => is_file($full) ? filesize($full) : null,
            ];
        }
    }

    wp_send_json_success(['items' => $items]);
});

// -- AJAX: read file -----------------------------------------------------------
add_action('wp_ajax_cvd_read_file', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);

    $rel = sanitize_text_field($_POST['file'] ?? '');
    $abs = cvd_resolve_path($rel);
    if (!$abs || !file_exists($abs)) wp_send_json_error('File not found');

    $size = filesize($abs);
    if ($size > 500 * 1024) wp_send_json_error('File too large to read (> 500 KB)');

    wp_send_json_success(['content' => file_get_contents($abs), 'size' => $size]);
});

// -- Audit log -----------------------------------------------------------------
function cvd_audit_log(array $entry): void {
    $log   = get_option('cvd_audit_log', []);
    array_unshift($log, $entry);
    update_option('cvd_audit_log', array_slice($log, 0, 200), false);
}

// -- Security & malware scanner ------------------------------------------------
function cvd_security_scan(): array {
    global $wpdb;

    $findings = [];
    $clean    = true;
    $scanned  = 0;

    // 1. PHP malware pattern scan across plugins + themes
    $patterns = [
        '/eval\s*\(\s*base64_decode/i'                        => 'eval+base64_decode (obfuscated payload)',
        '/eval\s*\(\s*gzinflate/i'                            => 'eval+gzinflate (compressed payload)',
        '/eval\s*\(\s*str_rot13/i'                            => 'eval+str_rot13 (obfuscation)',
        '/assert\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)/i'       => 'assert() with user input (code injection)',
        '/preg_replace\s*\([\\\'""].*\/e[\\\'""\s,)]/i'       => 'preg_replace /e flag (RCE)',
        '/file_get_contents\s*\(\s*\$_(GET|POST|REQUEST)/i'   => 'file_get_contents with user input (LFI)',
        '/\bpassthru\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)/i'   => 'passthru() with user input (RCE)',
        '/\bsystem\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)/i'     => 'system() with user input (RCE)',
    ];

    $scan_dirs    = [WP_PLUGIN_DIR, get_theme_root()];
    $infected     = [];

    foreach ($scan_dirs as $dir) {
        if (!is_dir($dir)) continue;
        $iter = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS)
        );
        foreach ($iter as $f) {
            if (!$f->isFile() || strtolower($f->getExtension()) !== 'php') continue;
            if ($f->getSize() > 512 * 1024) continue;
            if (++$scanned > 3000) break 2;

            $src = @file_get_contents($f->getPathname());
            if (!$src) continue;

            foreach ($patterns as $regex => $label) {
                if (preg_match($regex, $src)) {
                    $rel       = str_replace(
                        [WP_PLUGIN_DIR . DIRECTORY_SEPARATOR, get_theme_root() . DIRECTORY_SEPARATOR],
                        ['plugins/', 'themes/'],
                        $f->getPathname()
                    );
                    $infected[] = ['file' => $rel, 'pattern' => $label];
                    $clean      = false;
                    break;
                }
            }
        }
    }
    if (!empty($infected)) {
        $findings[] = ['severity' => 'critical', 'type' => 'malware_detected', 'items' => array_slice($infected, 0, 20)];
    }

    // 2. Known-malicious file names (webshells left behind)
    $bad_names  = ['wp-feed.php', 'wp-tmp.php', 'wp-options.php', 'wp-xmlrpc.php', 'wp-cache.php'];
    $found_bad  = [];
    $check_dirs = array_merge($scan_dirs, [wp_upload_dir()['basedir']]);
    foreach ($check_dirs as $dir) {
        foreach ($bad_names as $name) {
            $p = $dir . DIRECTORY_SEPARATOR . $name;
            if (file_exists($p)) {
                $rel       = str_replace(
                    [WP_PLUGIN_DIR . DIRECTORY_SEPARATOR, get_theme_root() . DIRECTORY_SEPARATOR, wp_upload_dir()['basedir'] . DIRECTORY_SEPARATOR],
                    ['plugins/', 'themes/', 'uploads/'],
                    $p
                );
                $found_bad[] = $rel;
                $clean = false;
            }
        }
    }
    if (!empty($found_bad)) {
        $findings[] = ['severity' => 'critical', 'type' => 'suspicious_files', 'files' => $found_bad];
    }

    // 3. Recently modified PHP files in plugins/themes (last 72 h)
    $recent = [];
    foreach ($scan_dirs as $dir) {
        if (!is_dir($dir)) continue;
        $iter = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS)
        );
        foreach ($iter as $f) {
            if (!$f->isFile() || strtolower($f->getExtension()) !== 'php') continue;
            if ((time() - $f->getMTime()) < 72 * 3600) {
                $rel     = str_replace(
                    [WP_PLUGIN_DIR . DIRECTORY_SEPARATOR, get_theme_root() . DIRECTORY_SEPARATOR],
                    ['plugins/', 'themes/'],
                    $f->getPathname()
                );
                $recent[] = ['file' => $rel, 'modified' => date('Y-m-d H:i:s', $f->getMTime())];
            }
        }
    }
    if (!empty($recent)) {
        $findings[] = ['severity' => 'info', 'type' => 'recently_modified', 'count' => count($recent), 'files' => array_slice($recent, 0, 15)];
    }

    // 4. New admin accounts (registered in last 7 days)
    $new_admins = $wpdb->get_results($wpdb->prepare(
        "SELECT u.ID, u.user_login, u.user_email, u.user_registered
         FROM {$wpdb->users} u
         JOIN {$wpdb->usermeta} um ON um.user_id = u.ID
         WHERE um.meta_key = %s AND um.meta_value LIKE %s
           AND u.user_registered > DATE_SUB(NOW(), INTERVAL 7 DAY)",
        $wpdb->prefix . 'capabilities', '%administrator%'
    ), ARRAY_A);
    if (!empty($new_admins)) {
        $findings[] = ['severity' => 'warning', 'type' => 'new_admin_accounts', 'accounts' => $new_admins];
        $clean = false;
    }

    // 5. DB option injection (siteurl/home/blogdescription)
    $injected_opts = [];
    foreach (['siteurl', 'home', 'blogdescription', 'blogname'] as $opt) {
        $val = get_option($opt, '');
        if (preg_match('/<script|javascript:|data:text\/html/i', $val)) {
            $injected_opts[] = $opt;
            $clean = false;
        }
    }
    if (!empty($injected_opts)) {
        $findings[] = ['severity' => 'critical', 'type' => 'option_injection', 'options' => $injected_opts];
    }

    // 6. Published posts with suspicious JS/PHP injection
    $bad_posts = (int)$wpdb->get_var(
        "SELECT COUNT(*) FROM {$wpdb->posts}
         WHERE post_status = 'publish'
           AND (post_content LIKE '%eval(%' OR post_content LIKE '%base64_decode%'
                OR (post_content LIKE '%<script%' AND post_content LIKE '%document.write%'))"
    );
    if ($bad_posts > 0) {
        $findings[] = ['severity' => 'critical', 'type' => 'post_injection', 'affected_posts' => $bad_posts];
        $clean = false;
    }

    // 7. wp-config.php permissions (should not be world-readable)
    $wp_config = ABSPATH . 'wp-config.php';
    if (file_exists($wp_config)) {
        $perms = fileperms($wp_config) & 0777;
        if ($perms > 0640) {
            $findings[] = ['severity' => 'warning', 'type' => 'wp_config_permissions', 'current' => decoct($perms), 'recommended' => '640'];
            $clean = false;
        }
    }

    // 8. Debug mode on in production
    if (defined('WP_DEBUG') && WP_DEBUG) {
        $findings[] = ['severity' => 'warning', 'type' => 'debug_mode_on'];
    }

    return [
        'clean'       => $clean,
        'scanned_php' => $scanned,
        'findings'    => $findings,
        'scan_time'   => date('c'),
    ];
}

// -----------------------------------------------------------------------------
// TELEGRAM INTEGRATION
// -----------------------------------------------------------------------------

function cvd_telegram_send(string $token, $chat_id, string $text, ?int $reply_to = null): void {
    $params = ['chat_id' => $chat_id, 'text' => $text, 'parse_mode' => 'Markdown'];
    if ($reply_to) $params['reply_to_message_id'] = $reply_to;
    wp_remote_post(CVD_TELEGRAM_API . $token . '/sendMessage', [
        'timeout'  => 10,
        'blocking' => false,
        'headers'  => ['Content-Type' => 'application/json'],
        'body'     => wp_json_encode($params),
    ]);
}

function cvd_telegram_run_command(string $command, $chat_id, int $reply_to = 0): void {
    $token   = get_option('cvd_telegram_bot_token', '');
    $api_key = get_option('cvd_api_key', '');
    if (empty($token) || empty($api_key)) {
        cvd_telegram_send($token, $chat_id, '[!] CooVex Dev is not configured. Check plugin settings.', $reply_to ?: null);
        return;
    }

    $tg_context      = cvd_site_context($command);
    $tg_sec_keywords = ['security', 'malware', 'hack', 'hacked', 'scan', 'inject', 'suspicious', 'virus', 'infected', 'vulnerability'];
    $tg_cmd_lower    = strtolower($command);
    foreach ($tg_sec_keywords as $kw) {
        if (strpos($tg_cmd_lower, $kw) !== false) {
            $tg_context['security_scan'] = cvd_security_scan();
            break;
        }
    }

    $response = wp_remote_post(CVD_API_URL, [
        'timeout' => 120,
        'headers' => ['Content-Type' => 'application/json', 'User-Agent' => 'CooVex-Dev-Telegram/' . CVD_VERSION],
        'body'    => wp_json_encode(['api_key' => $api_key, 'command' => $command, 'site_info' => $tg_context]),
    ]);

    if (is_wp_error($response)) {
        cvd_telegram_send($token, $chat_id, 'âŒ ' . $response->get_error_message(), $reply_to ?: null);
        return;
    }

    $code    = wp_remote_retrieve_response_code($response);
    $payload = json_decode(wp_remote_retrieve_body($response), true);

    if ($code === 402) { cvd_telegram_send($token, $chat_id, '[!] ' . ($payload['error'] ?? 'Insufficient credits.'), $reply_to ?: null); return; }
    if ($code !== 200 || empty($payload['ok'])) { cvd_telegram_send($token, $chat_id, 'âŒ ' . ($payload['error'] ?? 'Error'), $reply_to ?: null); return; }

    $changes = $payload['changes'] ?? [];
    $snap_id = null;
    $applied = [];

    if (!empty($changes)) {
        $files   = array_values(array_filter(array_map(fn($c) => ($c['type'] ?? 'file') === 'file' ? ($c['file'] ?? '') : '', $changes)));
        $snap_id = cvd_snapshot_take($files, $command);
        foreach ($changes as $ch) $applied[] = cvd_apply_change($ch);
    }

    $msg   = $payload['message'] ?? 'Done.';
    $ok    = count(array_filter($applied, fn($r) => $r['ok'] ?? false));
    $fail  = count($applied) - $ok;

    if (!empty($applied)) {
        $msg .= "\n\n[OK] {$ok} change(s) applied.";
        if ($fail) $msg .= " [!] {$fail} failed.";
        if ($snap_id) $msg .= "\n_Commit \`{$snap_id}\` \u2014 rollback in WP admin._";
    }
    if ($payload['credits_used'] ?? null) $msg .= "\n_Credits used: " . $payload['credits_used'] . "_";

    cvd_audit_log(['command' => $command, 'source' => 'telegram', 'chat_id' => $chat_id, 'time' => time()]);

    if (mb_strlen($msg) > 4000) $msg = mb_substr($msg, 0, 4000) . '\u2026';
    cvd_telegram_send($token, $chat_id, $msg, $reply_to ?: null);
}

add_action('rest_api_init', function () {
    register_rest_route('coovex-dev/v1', '/telegram', [
        'methods'             => 'POST',
        'callback'            => 'cvd_telegram_webhook_handler',
        'permission_callback' => '__return_true',
    ]);
});

function cvd_telegram_webhook_handler(WP_REST_Request $request): WP_REST_Response {
    $token        = get_option('cvd_telegram_bot_token', '');
    $allowed_chat = (string)get_option('cvd_telegram_chat_id', '');
    $stored_secret= get_option('cvd_telegram_webhook_secret', '');

    $secret = $request->get_header('X-Telegram-Bot-Api-Secret-Token') ?? '';
    if (!empty($stored_secret) && !hash_equals($stored_secret, $secret)) {
        return new WP_REST_Response(['ok' => true]);
    }

    $update  = $request->get_json_params();
    $message = $update['message'] ?? $update['edited_message'] ?? null;
    if (!$message) return new WP_REST_Response(['ok' => true]);

    $chat_id = (string)($message['chat']['id'] ?? '');
    $text    = trim($message['text'] ?? '');
    $msg_id  = (int)($message['message_id'] ?? 0);

    if (!empty($allowed_chat) && $chat_id !== $allowed_chat) {
        cvd_telegram_send($token, $chat_id, '[Blocked] Unauthorized.', $msg_id);
        return new WP_REST_Response(['ok' => true]);
    }
    if (empty($text)) return new WP_REST_Response(['ok' => true]);

    if ($text === '/start') {
        cvd_telegram_send($token, $chat_id,
            "*CooVex Dev* connected!\n\nSend me tasks in plain language and I’ll execute them on your WordPress site.\n\n*Examples:*\n- _How many visitors today?_\n- _Add a Buy Now button next to Add to Cart_\n- _Create a login activity log plugin_\n- _Show WooCommerce sales this month_",
        $msg_id);
        return new WP_REST_Response(['ok' => true]);
    }

    // Acknowledge immediately, process in background
    cvd_telegram_send($token, $chat_id, '\u26A1 *Working on it...*', $msg_id);
    cvd_telegram_run_command($text, $chat_id, $msg_id);

    return new WP_REST_Response(['ok' => true]);
}

add_action('cvd_telegram_async', 'cvd_telegram_run_command', 10, 3);

add_action('wp_ajax_cvd_telegram_register', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);
    $token = get_option('cvd_telegram_bot_token', '');
    if (empty($token)) wp_send_json_error('Save your bot token first.');

    $secret = wp_generate_password(32, false, false);
    update_option('cvd_telegram_webhook_secret', $secret);

    $res = wp_remote_post(CVD_TELEGRAM_API . $token . '/setWebhook', [
        'timeout' => 15,
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => wp_json_encode([
            'url'             => rest_url('coovex-dev/v1/telegram'),
            'secret_token'    => $secret,
            'allowed_updates' => ['message', 'edited_message'],
        ]),
    ]);

    if (is_wp_error($res)) wp_send_json_error($res->get_error_message());
    $body = json_decode(wp_remote_retrieve_body($res), true);
    if ($body['ok'] ?? false) {
        update_option('cvd_telegram_webhook_registered', true);
        wp_send_json_success(['url' => rest_url('coovex-dev/v1/telegram'), 'desc' => $body['description'] ?? '']);
    } else {
        wp_send_json_error($body['description'] ?? 'Telegram error');
    }
});

add_action('wp_ajax_cvd_telegram_unregister', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);
    $token = get_option('cvd_telegram_bot_token', '');
    if ($token) wp_remote_post(CVD_TELEGRAM_API . $token . '/deleteWebhook', ['timeout' => 10, 'headers' => ['Content-Type' => 'application/json'], 'body' => wp_json_encode([])]);
    delete_option('cvd_telegram_webhook_registered');
    delete_option('cvd_telegram_webhook_secret');
    wp_send_json_success();
});

// -----------------------------------------------------------------------------
// ADMIN PAGES
// -----------------------------------------------------------------------------

// -- Settings page -------------------------------------------------------------
function cvd_page_settings() {
    if (!current_user_can('manage_options')) return;

    settings_errors('cvd_options');
    ?>
    <div class="wrap">
        <h1 style="display:flex;align-items:center;gap:8px;">
            <span class="dashicons dashicons-editor-code" style="font-size:24px;color:#2563eb;"></span>
            CooVex Dev \u2014 Settings
        </h1>

        <?php echo $pw_notice; ?>

        <form method="post" action="options.php" style="margin-top:24px;">
            <?php settings_fields('cvd_options'); ?>
            <table class="form-table">
                <tr>
                    <th><label for="cvd_api_key">CooVex API Key</label></th>
                    <td>
                        <input type="password" id="cvd_api_key" name="cvd_api_key"
                            value="<?php echo esc_attr(get_option('cvd_api_key','')); ?>"
                            class="regular-text" autocomplete="new-password" />
                        <p class="description">
                            Find it in <a href="https://app.coovex.com/settings/integrations" target="_blank">CooVex → Settings → Integrations</a>.
                            Credits are deducted per command based on actual usage (100 credits = $1).
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button('Save Settings'); ?>
        </form>

        <?php
        $validate_err = get_option('cvd_validate_error', '');
        $license_ok   = !empty(get_option('cvd_license_token', ''));
        if ($license_ok): ?>
        <div style="margin-top:12px;padding:10px 14px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;color:#166534;font-size:13px;">
            License active — connected to CooVex.
        </div>
        <?php elseif ($validate_err): ?>
        <div style="margin-top:12px;padding:10px 14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;color:#991b1b;font-size:13px;">
            <strong>Validation failed:</strong> <?php echo esc_html($validate_err); ?>
        </div>
        <?php elseif (!empty(get_option('cvd_api_key', ''))): ?>
        <div style="margin-top:12px;padding:10px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;color:#92400e;font-size:13px;">
            Validating license with CooVex server...
        </div>
        <?php endif; ?>

        <?php
        $api_key = get_option('cvd_api_key', '');
        if ($api_key): ?>
        <div style=”margin-top:24px;padding:12px 16px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;color:#166534;”>
            API key saved. <a href=”<?php echo admin_url('admin.php?page=coovex-dev'); ?>”>Open Dev Agent &rarr;</a>
        </div>
        <?php else: ?>
        <div style=”margin-top:24px;padding:12px 16px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;color:#991b1b;”>
            API key not set &mdash; the agent cannot connect to CooVex.
        </div>
        <?php endif; ?>

        <hr style="margin:32px 0;" />

        <h2>Telegram Integration</h2>
        <p style="color:#64748b;">
            Connect a Telegram bot to control CooVex Dev directly from Telegram.
            <a href="https://t.me/BotFather" target="_blank">Create a bot with @BotFather</a> to get a token.
        </p>

        <form method="post" action="options.php">
            <?php settings_fields('cvd_options'); ?>
            <table class="form-table">
                <tr>
                    <th><label for="cvd_telegram_bot_token">Bot Token</label></th>
                    <td>
                        <input type="password" id="cvd_telegram_bot_token" name="cvd_telegram_bot_token"
                            value="<?php echo esc_attr(get_option('cvd_telegram_bot_token','')); ?>"
                            class="regular-text" autocomplete="new-password" />
                        <p class="description">From @BotFather: <code>/newbot</code> → copy the token.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="cvd_telegram_chat_id">Allowed Chat ID</label></th>
                    <td>
                        <input type="text" id="cvd_telegram_chat_id" name="cvd_telegram_chat_id"
                            value="<?php echo esc_attr(get_option('cvd_telegram_chat_id','')); ?>"
                            class="regular-text" placeholder="e.g. 123456789" />
                        <p class="description">
                            Your personal Telegram numeric ID. Only this chat can send commands.
                            Get it from <a href="https://t.me/userinfobot" target="_blank">@userinfobot</a>.
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button('Save Telegram Settings'); ?>
        </form>

        <?php
        $tg_token      = get_option('cvd_telegram_bot_token', '');
        $tg_registered = get_option('cvd_telegram_webhook_registered', false);
        $tg_nonce      = wp_create_nonce('cvd_nonce');
        ?>
        <div style="margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <?php if ($tg_token): ?>
            <button id="cvd-tg-register" class="button button-primary">
                <?php echo $tg_registered ? ' Re-register Webhook' : 'Register Telegram Webhook'; ?>
            </button>
            <?php if ($tg_registered): ?>
            <button id="cvd-tg-unregister" class="button button-secondary">Remove Webhook</button>
            <?php endif; ?>
            <?php else: ?>
            <p style="color:#92400e;background:#fef3c7;padding:8px 12px;border-radius:6px;margin:0;">
                Save your bot token first to register the webhook.
            </p>
            <?php endif; ?>
            <span id="cvd-tg-status" style="color:#64748b;font-size:13px;"></span>
        </div>

        <?php if ($tg_registered): ?>
        <div style="margin-top:16px;padding:12px 16px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;color:#166534;">
            \u2714 Telegram webhook active.
            Webhook URL: <code><?php echo esc_html(rest_url('coovex-dev/v1/telegram')); ?></code>
        </div>
        <?php endif; ?>

        <script>
        (function(){
            var nonce = <?php echo json_encode($tg_nonce); ?>;

            var regBtn = document.getElementById('cvd-tg-register');
            if (regBtn) regBtn.addEventListener('click', function() {
                var status = document.getElementById('cvd-tg-status');
                regBtn.disabled = true; status.textContent = 'Registering...';
                fetch(ajaxurl, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body:'action=cvd_telegram_register&nonce=' + encodeURIComponent(nonce)})
                .then(r => r.json()).then(function(d) {
                    if (d.success) {
                        status.textContent = '\u2714 Webhook registered! Send /start to your bot.';
                        status.style.color = 'green';
                        location.reload();
                    } else {
                        status.textContent = '\u2717 ' + (d.data || 'Error');
                        status.style.color = 'red';
                        regBtn.disabled = false;
                    }
                });
            });

            var unregBtn = document.getElementById('cvd-tg-unregister');
            if (unregBtn) unregBtn.addEventListener('click', function() {
                if (!confirm('Remove Telegram webhook?')) return;
                unregBtn.disabled = true;
                fetch(ajaxurl, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
                    body:'action=cvd_telegram_unregister&nonce=' + encodeURIComponent(nonce)})
                .then(r => r.json()).then(function() { location.reload(); });
            });
        })();
        </script>
    </div>
    <?php
}

// -- Commit History page -------------------------------------------------------
function cvd_page_history() {
    if (!current_user_can('manage_options')) return;
    $snaps = get_option('cvd_snapshots', []);
    ?>
    <div class="wrap">
        <h1 style="display:flex;align-items:center;gap:8px;">
            <span class="dashicons dashicons-backup" style="font-size:24px;color:#2563eb;"></span>
            CooVex Dev \u2014 Commit History
        </h1>
        <p style="color:#64748b;">Every change made by CooVex Dev is snapshotted before applying. Roll back any commit instantly.</p>
        <?php if (empty($snaps)): ?>
            <p>No commits yet.</p>
        <?php else: ?>
        <table class="wp-list-table widefat fixed striped" style="margin-top:16px;">
            <thead>
                <tr>
                    <th>Commit ID</th>
                    <th>Time</th>
                    <th>Command</th>
                    <th>Files snapshotted</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($snaps as $s): ?>
                <tr>
                    <td><code><?php echo esc_html($s['id']); ?></code></td>
                    <td><?php echo esc_html(wp_date('Y-m-d H:i:s', $s['time'])); ?></td>
                    <td><?php echo esc_html(wp_trim_words($s['label'], 12, '\u2026')); ?></td>
                    <td><?php echo count($s['files']); ?> file(s)</td>
                    <td>
                        <button class="button button-secondary cvd-rollback-btn"
                            data-snap="<?php echo esc_attr($s['id']); ?>"
                            data-label="<?php echo esc_attr($s['label']); ?>">
                            \u21A9 Roll back
                        </button>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>

    <script>
    (function(){
        var nonce = <?php echo json_encode(wp_create_nonce('cvd_nonce')); ?>;
        document.querySelectorAll('.cvd-rollback-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var snap = btn.dataset.snap;
                var label = btn.dataset.label;
                if (!confirm('Roll back to commit ' + snap + '?\n\nThis will restore all files from before:\n"' + label + '"')) return;

                btn.disabled = true;
                btn.textContent = 'Rolling back...';

                fetch(ajaxurl, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: 'action=cvd_rollback&nonce=' + encodeURIComponent(nonce) + '&snap_id=' + encodeURIComponent(snap)
                })
                .then(r => r.json())
                .then(function(d) {
                    if (d.success) {
                        btn.textContent = '\u2714 Rolled back';
                        btn.style.color = 'green';
                        alert('Restored ' + (d.data.restored || []).length + ' file(s) from commit ' + snap);
                    } else {
                        btn.textContent = '\u21A9 Roll back';
                        btn.disabled = false;
                        alert('Rollback failed: ' + (d.data || 'Unknown error'));
                    }
                });
            });
        });
    })();
    </script>
    <?php
}

// -- Dev Agent page (main chat) ------------------------------------------------
function cvd_page_agent() {
    if (!current_user_can('manage_options')) return;

    $api_key = get_option('cvd_api_key', '');

    if (!$api_key) {
        echo '<div class=”wrap”><div style=”margin-top:48px;max-width:480px;”>';
        echo '<h2>CooVex Dev &mdash; Setup Required</h2>';
        echo '<p>Add your <strong>CooVex API key</strong> in <a href=”' . admin_url('admin.php?page=coovex-dev-settings') . '”>Settings</a>.</p>';
        echo '</div></div>';
        return;
    }

    $nonce          = wp_create_nonce('cvd_nonce');
    ?>
    <style>
    #wpcontent { background: #f8fafc !important; }
    #wpbody-content { padding: 0 !important; }
    #cvd-app {
        display: flex;
        height: calc(100vh - 46px);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #f8fafc;
        color: #0f172a;
    }
    /* -- Sidebar -- */
    #cvd-sidebar {
        width: 260px;
        min-width: 260px;
        background: #f1f5f9;
        border-right: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    #cvd-sidebar-header {
        padding: 16px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 10px;
        background: #ffffff;
    }
    #cvd-sidebar-header .cvd-logo {
        font-size: 15px;
        font-weight: 700;
        color: #2563eb;
        letter-spacing: -.3px;
    }
    #cvd-sidebar-header .cvd-version {
        margin-left: auto;
        font-size: 10px;
        color: #64748b;
        background: #e2e8f0;
        padding: 2px 6px;
        border-radius: 4px;
    }
    #cvd-credits-bar {
        padding: 10px 16px;
        font-size: 12px;
        color: #64748b;
        border-bottom: 1px solid #e2e8f0;
        background: #ffffff;
    }
    #cvd-credits-bar span { color: #0f172a; font-weight: 600; }
    #cvd-snap-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
    }
    #cvd-snap-list .snap-item {
        padding: 8px 16px;
        cursor: pointer;
        border-left: 3px solid transparent;
        transition: background .15s;
    }
    #cvd-snap-list .snap-item:hover { background: #e2e8f0; }
    #cvd-snap-list .snap-item .snap-id {
        font-size: 11px;
        font-family: monospace;
        color: #2563eb;
    }
    #cvd-snap-list .snap-item .snap-label {
        font-size: 12px;
        color: #374151;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    #cvd-snap-list .snap-item .snap-time {
        font-size: 10px;
        color: #94a3b8;
        margin-top: 2px;
    }
    #cvd-sidebar-footer {
        padding: 12px 16px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        gap: 8px;
        background: #ffffff;
    }
    #cvd-sidebar-footer button {
        font-size: 11px;
        padding: 5px 10px;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
        background: transparent;
        color: #475569;
        cursor: pointer;
    }
    #cvd-sidebar-footer button:hover { background: #e2e8f0; color: #0f172a; }
    /* -- Main -- */
    #cvd-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: #ffffff;
    }
    #cvd-topbar {
        padding: 12px 20px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 10px;
        background: #ffffff;
    }
    #cvd-topbar .status-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow: 0 0 6px #22c55e80;
    }
    #cvd-topbar .status-dot.offline { background: #ef4444; box-shadow: none; }
    #cvd-topbar .status-label { font-size: 12px; color: #64748b; }
    #cvd-topbar .session-timer {
        margin-left: auto;
        font-size: 11px;
        color: #94a3b8;
        font-family: monospace;
    }
    /* -- Messages -- */
    #cvd-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        background: #ffffff;
    }
    .cvd-msg {
        display: flex;
        flex-direction: column;
        max-width: 80%;
    }
    .cvd-msg.user { align-self: flex-end; align-items: flex-end; }
    .cvd-msg.agent { align-self: flex-start; align-items: flex-start; }
    .cvd-msg .avatar {
        width: 28px; height: 28px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700;
        margin-bottom: 4px;
        flex-shrink: 0;
    }
    .cvd-msg.user .avatar { background: #2563eb; color: #ffffff; }
    .cvd-msg.agent .avatar { background: #e2e8f0; color: #2563eb; font-size: 14px; }
    .cvd-msg .bubble {
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 13.5px;
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
    }
    .cvd-msg.user .bubble { background: #2563eb; color: #ffffff; border-bottom-right-radius: 4px; }
    .cvd-msg.agent .bubble { background: #f1f5f9; color: #0f172a; border-bottom-left-radius: 4px; }
    .cvd-msg.agent.error .bubble { background: #fef2f2; color: #b91c1c; }
    /* -- Changes block -- */
    .cvd-changes { margin-top: 8px; width: 100%; }
    .cvd-change-item {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-top: 6px;
        overflow: hidden;
    }
    .cvd-change-header {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px;
        cursor: pointer;
        user-select: none;
    }
    .cvd-change-header .badge {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: .5px;
    }
    .badge-create { background: #dcfce7; color: #166534; }
    .badge-update { background: #dbeafe; color: #1d4ed8; }
    .badge-delete { background: #fee2e2; color: #991b1b; }
    .badge-db     { background: #ede9fe; color: #6d28d9; }
    .cvd-change-header .filepath {
        font-family: monospace;
        font-size: 12px;
        color: #475569;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .cvd-change-header .toggle-icon { color: #94a3b8; font-size: 11px; }
    .cvd-change-body {
        display: none;
        padding: 0 12px 12px;
    }
    .cvd-change-body pre {
        margin: 0;
        padding: 10px;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', monospace;
        font-size: 11px;
        line-height: 1.5;
        color: #374151;
        overflow-x: auto;
        max-height: 300px;
    }
    .cvd-change-item.open .cvd-change-body { display: block; }
    .cvd-change-item.ok .cvd-change-header { background: #f0fdf4; }
    .cvd-change-item.fail .cvd-change-header { background: #fef2f2; }
    .cvd-rollback-inline {
        margin-top: 6px;
        font-size: 11px;
        color: #2563eb;
        cursor: pointer;
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 8px;
        border: 1px solid #bfdbfe;
        border-radius: 5px;
        background: transparent;
    }
    .cvd-rollback-inline:hover { background: #eff6ff; }
    /* -- Typing indicator -- */
    .cvd-typing { display: flex; align-items: center; gap: 4px; padding: 8px 14px; }
    .cvd-typing span {
        width: 6px; height: 6px;
        background: #2563eb;
        border-radius: 50%;
        animation: cvd-bounce .8s infinite;
    }
    .cvd-typing span:nth-child(2) { animation-delay: .15s; }
    .cvd-typing span:nth-child(3) { animation-delay: .3s; }
    @keyframes cvd-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
    /* -- Input -- */
    #cvd-input-area {
        padding: 16px 20px;
        border-top: 1px solid #e2e8f0;
        background: #ffffff;
        display: flex; gap: 10px; align-items: flex-end;
    }
    #cvd-textarea {
        flex: 1;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        color: #0f172a;
        font-size: 13.5px;
        line-height: 1.5;
        padding: 10px 14px;
        resize: none;
        min-height: 42px;
        max-height: 140px;
        outline: none;
        font-family: inherit;
    }
    #cvd-textarea:focus { border-color: #2563eb; }
    #cvd-textarea::placeholder { color: #94a3b8; }
    #cvd-send-btn {
        background: #2563eb;
        border: none;
        border-radius: 10px;
        color: white;
        padding: 10px 18px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        height: 42px;
    }
    #cvd-send-btn:hover:not(:disabled) { background: #1d4ed8; }
    #cvd-send-btn:disabled { opacity: .4; cursor: not-allowed; }
    #cvd-input-hint { font-size: 11px; color: #cbd5e1; padding: 0 20px 8px; text-align: right; }
    /* Scrollbar */
    #cvd-messages::-webkit-scrollbar, #cvd-snap-list::-webkit-scrollbar, #cvd-activity-list::-webkit-scrollbar { width: 4px; }
    #cvd-messages::-webkit-scrollbar-track, #cvd-snap-list::-webkit-scrollbar-track, #cvd-activity-list::-webkit-scrollbar-track { background: transparent; }
    #cvd-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
    #cvd-activity-list::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
    /* -- Activity panel -- */
    #cvd-activity {
        width: 300px;
        min-width: 300px;
        background: #f8fafc;
        border-left: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: width .25s ease, min-width .25s ease;
    }
    #cvd-activity.cvd-act-hidden {
        width: 0;
        min-width: 0;
        border-left: none;
    }
    #cvd-activity-header {
        padding: 10px 14px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
        background: #ffffff;
    }
    #cvd-activity-header .cvd-act-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: #94a3b8;
        flex: 1;
    }
    #cvd-activity-close {
        background: none;
        border: none;
        color: #cbd5e1;
        cursor: pointer;
        font-size: 14px;
        padding: 2px 4px;
        line-height: 1;
        border-radius: 4px;
    }
    #cvd-activity-close:hover { color: #475569; background: #f1f5f9; }
    #cvd-activity-status {
        padding: 10px 14px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #64748b;
        flex-shrink: 0;
        min-height: 38px;
        background: #ffffff;
    }
    .cvd-act-spinner {
        width: 12px;
        height: 12px;
        border: 2px solid #e2e8f0;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: cvd-spin .7s linear infinite;
        flex-shrink: 0;
    }
    @keyframes cvd-spin { to { transform: rotate(360deg); } }
    #cvd-activity-list {
        flex: 1;
        overflow-y: auto;
    }
    .cvd-act-item {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        padding: 8px 14px;
        border-bottom: 1px solid #f1f5f9;
        transition: background .12s;
    }
    .cvd-act-item:hover { background: #f1f5f9; }
    .cvd-act-icon {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1.5px solid #cbd5e1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        flex-shrink: 0;
        margin-top: 1px;
        color: #94a3b8;
        transition: all .2s;
    }
    .cvd-act-icon.applying {
        border-color: #2563eb;
        border-top-color: transparent;
        animation: cvd-spin .7s linear infinite;
        color: transparent;
    }
    .cvd-act-icon.done {
        background: #dcfce7;
        border-color: #22c55e;
        color: #166534;
    }
    .cvd-act-icon.fail {
        background: #fee2e2;
        border-color: #ef4444;
        color: #b91c1c;
    }
    .cvd-act-info { flex: 1; min-width: 0; }
    .cvd-act-badge {
        display: inline-block;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: .5px;
        text-transform: uppercase;
        padding: 1px 5px;
        border-radius: 3px;
        margin-bottom: 3px;
    }
    .cvd-act-badge-file   { background: #dbeafe; color: #1d4ed8; }
    .cvd-act-badge-db     { background: #ede9fe; color: #6d28d9; }
    .cvd-act-badge-plugin { background: #dcfce7; color: #166534; }
    .cvd-act-badge-wp     { background: #fef9c3; color: #a16207; }
    .cvd-act-desc {
        font-family: monospace;
        font-size: 11px;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .cvd-act-desc.ok   { color: #374151; }
    .cvd-act-desc.fail { color: #ef4444; }
    #cvd-activity-footer {
        padding: 8px 14px;
        border-top: 1px solid #e2e8f0;
        font-size: 11px;
        color: #cbd5e1;
        flex-shrink: 0;
        min-height: 30px;
        background: #ffffff;
    }
    </style>

    <div id="cvd-app" style="position:relative;">


        <!-- Sidebar -->
        <div id="cvd-sidebar">
            <div id="cvd-sidebar-header">
                <span class="dashicons dashicons-editor-code" style="color:#60a5fa;font-size:18px;"></span>
                <span class="cvd-logo">CooVex Dev</span>
                <span class="cvd-version">v<?php echo CVD_VERSION; ?></span>
            </div>
            <div id="cvd-credits-bar">Credits remaining: <span id="cvd-credits-val">&mdash;</span></div>
            <div id="cvd-snap-list">
                <?php
                $snaps = get_option('cvd_snapshots', []);
                foreach (array_slice($snaps, 0, 20) as $s):
                ?>
                <div class="snap-item" data-snap="<?php echo esc_attr($s['id']); ?>">
                    <div class="snap-id"># <?php echo esc_html($s['id']); ?></div>
                    <div class="snap-label"><?php echo esc_html(wp_trim_words($s['label'], 8, '\u2026')); ?></div>
                    <div class="snap-time"><?php echo esc_html(human_time_diff($s['time'])); ?> ago</div>
                </div>
                <?php endforeach; ?>
            </div>
            <div id="cvd-sidebar-footer">
                <button id="cvd-clear-btn">Clear chat</button>
                <button id="cvd-history-btn" onclick="location.href='<?php echo admin_url('admin.php?page=coovex-dev-history'); ?>'">All commits</button>
            </div>
        </div>

        <!-- Main chat -->
        <div id="cvd-main">
            <div id="cvd-topbar">
                <span class="status-dot" id="cvd-status-dot"></span>
                <span class="status-label" id="cvd-status-label">Connected</span>
            </div>

            <div id="cvd-messages">
                <div class="cvd-msg agent">
                    <div class="avatar">\u26A1</div>
                    <div class="bubble">Welcome to CooVex Dev. I can write code, install plugins, edit themes, and modify your database.

What would you like to build or change?</div>
                </div>
            </div>

            <div id="cvd-input-area">
                <textarea id="cvd-textarea" rows="1" placeholder="Tell me what to build or change... (Ctrl+Enter to send)"></textarea>
                <button id="cvd-send-btn">Send</button>
            </div>
            <div id="cvd-input-hint">Ctrl+Enter to send &middot; credits deducted per use</div>
        </div>

        <!-- Activity panel -->
        <div id="cvd-activity" class="cvd-act-hidden">
            <div id="cvd-activity-header">
                <span class="cvd-act-title">Activity</span>
                <button id="cvd-activity-close" title="Close">&#215;</button>
            </div>
            <div id="cvd-activity-status">
                <div class="cvd-act-spinner" id="cvd-act-spinner"></div>
                <span id="cvd-act-status-text">Waiting...</span>
            </div>
            <div id="cvd-activity-list"></div>
            <div id="cvd-activity-footer"></div>
        </div>

    </div>

    <script>
    (function() {
        var NONCE = <?php echo json_encode($nonce); ?>;
        var AJAXURL = <?php echo json_encode(admin_url('admin-ajax.php')); ?>;
        var history = [];

        // -- Send command ------------------------------------------------------
        var textarea  = document.getElementById('cvd-textarea');
        var sendBtn   = document.getElementById('cvd-send-btn');
        var messages  = document.getElementById('cvd-messages');
        var creditsEl = document.getElementById('cvd-credits-val');

        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 140) + 'px';
        });

        textarea.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') sendCommand();
        });

        sendBtn.addEventListener('click', sendCommand);

        // ── Activity panel refs ───────────────────────────────────────────────
        var actPanel      = document.getElementById('cvd-activity');
        var actList       = document.getElementById('cvd-activity-list');
        var actFooter     = document.getElementById('cvd-activity-footer');
        var actStatusText = document.getElementById('cvd-act-status-text');
        var actSpinner    = document.getElementById('cvd-act-spinner');

        function actOpen()  { actPanel.classList.remove('cvd-act-hidden'); }
        function actClose() { actPanel.classList.add('cvd-act-hidden'); }
        function actStatus(text, spin) {
            actStatusText.textContent = text;
            actSpinner.style.display = spin ? '' : 'none';
        }

        function actChangeBadge(ch) {
            var t = ch.type || 'file';
            if (t === 'db') return ['SQL', 'cvd-act-badge-db'];
            if (t === 'plugin_install') return ['PLUG', 'cvd-act-badge-plugin'];
            if (t === 'wp_action') return ['WP', 'cvd-act-badge-wp'];
            return [(ch.action || 'FILE').toUpperCase().slice(0,6), 'cvd-act-badge-file'];
        }
        function actChangeDesc(ch) {
            var t = ch.type || 'file';
            if (t === 'file') return ch.file || 'file';
            if (t === 'db') return ch.description || 'SQL query';
            if (t === 'plugin_install') return ch.slug || 'plugin';
            if (t === 'wp_action') return (ch.action || '') + (ch.data && ch.data.name ? ': ' + ch.data.name : ch.data && ch.data.post_title ? ': ' + ch.data.post_title : '');
            return ch.type || 'change';
        }

        function actRenderChanges(changes) {
            actList.innerHTML = '';
            changes.forEach(function(ch, i) {
                var row = document.createElement('div');
                row.className = 'cvd-act-item';
                row.dataset.idx = i;

                var icon = document.createElement('div');
                icon.className = 'cvd-act-icon';
                icon.innerHTML = '&#9675;';

                var info = document.createElement('div');
                info.className = 'cvd-act-info';

                var badgeInfo = actChangeBadge(ch);
                var badge = document.createElement('span');
                badge.className = 'cvd-act-badge ' + badgeInfo[1];
                badge.textContent = badgeInfo[0];

                var desc = document.createElement('div');
                desc.className = 'cvd-act-desc';
                desc.textContent = actChangeDesc(ch);
                desc.title = actChangeDesc(ch);

                info.appendChild(badge);
                info.appendChild(desc);
                row.appendChild(icon);
                row.appendChild(info);
                actList.appendChild(row);
            });
            actList.scrollTop = 0;
        }

        function actMarkDone(results) {
            var rows = actList.querySelectorAll('.cvd-act-item');
            rows.forEach(function(row, i) {
                var icon = row.querySelector('.cvd-act-icon');
                var desc = row.querySelector('.cvd-act-desc');
                var res  = results[i];
                if (!res) { icon.className = 'cvd-act-icon fail'; icon.innerHTML = '&#10005;'; return; }
                if (res.ok !== false) {
                    icon.className = 'cvd-act-icon done';
                    icon.innerHTML = '&#10003;';
                    desc.className = 'cvd-act-desc ok';
                } else {
                    icon.className = 'cvd-act-icon fail';
                    icon.innerHTML = '&#10005;';
                    desc.className = 'cvd-act-desc fail';
                    if (res.error) desc.title = res.error;
                }
            });
        }

        document.getElementById('cvd-activity-close').addEventListener('click', actClose);

        function addCreditsNote(used) {
            if (used == null) return;
            var note = document.createElement('span');
            note.style.cssText = 'color:#475569;margin-left:6px;font-size:10px;';
            note.textContent = '(' + used + ' used)';
            document.getElementById('cvd-credits-bar').appendChild(note);
            setTimeout(function(){ note.remove(); }, 5000);
        }

        function sendCommand() {
            var cmd = textarea.value.trim();
            if (!cmd || sendBtn.disabled) return;

            addMessage('user', cmd);
            history.push({role: 'user', content: cmd});
            textarea.value = '';
            textarea.style.height = '';
            sendBtn.disabled = true;

            // Show typing bubble + open activity panel
            var typingEl = addTyping();
            actList.innerHTML = '';
            actFooter.textContent = '';
            actOpen();
            actStatus('Preparing...', true);

            // Step 1: get credentials from PHP (fast)
            ajax('cvd_get_context', {command: cmd, history: JSON.stringify(history)})
            .then(function(ctxR) {
                if (!ctxR.success) {
                    typingEl.remove();
                    actClose();
                    addMessage('agent error', ctxR.data || 'Failed to prepare request.');
                    return;
                }
                var ctx = ctxR.data;
                actStatus('Connecting...', true);

                // Step 2: stream directly from Next.js
                return fetch(ctx.stream_url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Accept': 'text/event-stream'},
                    body: JSON.stringify({
                        api_key:       ctx.api_key,
                        command:       cmd,
                        history:       ctx.history,
                        site_info:     ctx.site_info,
                        request_nonce: ctx.request_nonce,
                    }),
                })
                .then(function(res) {
                    if (!res.ok || !res.body) {
                        return res.text().then(function(t) {
                            var msg = t;
                            try { msg = JSON.parse(t).error || t; } catch(e) {}
                            throw new Error('HTTP ' + res.status + ': ' + msg.slice(0, 120));
                        });
                    }

                    var reader  = res.body.getReader();
                    var decoder = new TextDecoder();
                    var buf     = '';

                    function pump() {
                        return reader.read().then(function(chunk) {
                            if (chunk.done) return;
                            buf += decoder.decode(chunk.value, {stream: true});

                            var parts = buf.split('\\n\\n');
                            buf = parts.pop() || '';

                            var applyPromise = Promise.resolve();

                            parts.forEach(function(part) {
                                if (!part.startsWith('data: ')) return;
                                var d;
                                try { d = JSON.parse(part.slice(6).trim()); } catch(e) { return; }

                                if (d.type === 'status') {
                                    actStatus(d.message, true);
                                } else if (d.type === 'token') {
                                    actStatus('Generating...', true);
                                } else if (d.type === 'result') {
                                    typingEl.remove();
                                    if (d.credits_remaining != null) creditsEl.textContent = d.credits_remaining;
                                    addCreditsNote(d.credits_used);

                                    var changes = d.changes || [];
                                    if (changes.length === 0) {
                                        actClose();
                                        addAgentMessage(d.message, [], null);
                                    } else {
                                        actStatus('Applying ' + changes.length + ' change' + (changes.length > 1 ? 's' : '') + '...', true);
                                        actRenderChanges(changes);

                                        applyPromise = ajax('cvd_apply_changes', {
                                            changes:   JSON.stringify(changes),
                                            sig:       d.sig || '',
                                            sig_nonce: d.nonce || '',
                                            raw_body:  d.raw_body || '',
                                            command:   cmd,
                                        }).then(function(applyR) {
                                            var results = applyR.success ? (applyR.data.results || []) : [];
                                            var snap_id = applyR.success ? (applyR.data.snap_id || null) : null;

                                            actMarkDone(results);
                                            var okCount   = results.filter(function(r){ return r && r.ok !== false; }).length;
                                            actStatus(okCount + '/' + results.length + ' applied', false);
                                            actFooter.textContent = snap_id ? 'Snapshot: #' + snap_id : '';

                                            var merged = changes.map(function(ch, i) {
                                                return Object.assign({}, ch, results[i] || {});
                                            });
                                            addAgentMessage(d.message, merged, snap_id);
                                            if (snap_id) addSnapToSidebar(snap_id, cmd);
                                        });
                                    }

                                    history.push({role: 'assistant', content: d.message});
                                    if (history.length > 20) history = history.slice(-20);

                                } else if (d.type === 'error') {
                                    typingEl.remove();
                                    actClose();
                                    addMessage('agent error', d.message || 'An error occurred.');
                                }
                            });

                            return applyPromise.then(pump);
                        });
                    }

                    return pump();
                });
            })
            .catch(function(err) {
                typingEl.remove();
                actClose();
                addMessage('agent error', 'Error: ' + err.message);
            })
            .finally(function() {
                sendBtn.disabled = false;
                textarea.focus();
            });
        }

        function addMessage(role, text) {
            var isUser  = role === 'user';
            var isError = role.indexOf('error') !== -1;

            var wrap = document.createElement('div');
            wrap.className = 'cvd-msg ' + (isUser ? 'user' : 'agent') + (isError ? ' error' : '');

            var avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.textContent = isUser ? wp_username_initial : '\u26A1';

            var bubble = document.createElement('div');
            bubble.className = 'bubble';
            bubble.textContent = text;

            wrap.appendChild(avatar);
            wrap.appendChild(bubble);
            messages.appendChild(wrap);
            messages.scrollTop = messages.scrollHeight;
            return wrap;
        }

        var wp_username_initial = <?php echo json_encode(strtoupper(substr(wp_get_current_user()->user_login, 0, 1))); ?>;

        function addAgentMessage(text, changes, snap_id) {
            var wrap = addMessage('agent', text);

            if (changes && changes.length > 0) {
                var changesWrap = document.createElement('div');
                changesWrap.className = 'cvd-changes';

                changes.forEach(function(ch) {
                    var item = document.createElement('div');
                    var type   = ch.type || 'file';
                    var action = ch.action || 'update';
                    var label  = type === 'db' ? 'SQL' : (ch.file || '');
                    var ok     = ch.ok !== false;

                    item.className = 'cvd-change-item ' + (ok ? 'ok' : 'fail');

                    var header = document.createElement('div');
                    header.className = 'cvd-change-header';

                    var badge = document.createElement('span');
                    badge.className = 'badge badge-' + (type === 'db' ? 'db' : action);
                    badge.textContent = type === 'db' ? 'SQL' : action.toUpperCase();

                    var filepath = document.createElement('span');
                    filepath.className = 'filepath';
                    filepath.textContent = ok ? label : ('\u2717 ' + label + ' \u2014 ' + (ch.error || 'failed'));

                    var toggleIcon = document.createElement('span');
                    toggleIcon.className = 'toggle-icon';
                    toggleIcon.textContent = '\u25BC';

                    header.appendChild(badge);
                    header.appendChild(filepath);
                    header.appendChild(toggleIcon);

                    var body = document.createElement('div');
                    body.className = 'cvd-change-body';

                    if (ok && (ch.content || ch.sql)) {
                        var pre = document.createElement('pre');
                        pre.textContent = ch.content || ch.sql || '';
                        body.appendChild(pre);
                    } else if (type === 'db' && ch.rows_affected != null) {
                        var p = document.createElement('p');
                        p.style.cssText = 'margin:0;font-size:12px;color:#86efac;';
                        p.textContent = 'Query OK \u2014 ' + ch.rows_affected + ' row(s) affected.';
                        body.appendChild(p);
                    }

                    header.addEventListener('click', function() {
                        item.classList.toggle('open');
                        toggleIcon.textContent = item.classList.contains('open') ? '\u25B2' : '\u25BC';
                    });

                    item.appendChild(header);
                    item.appendChild(body);
                    changesWrap.appendChild(item);
                });

                if (snap_id) {
                    var rbBtn = document.createElement('button');
                    rbBtn.className = 'cvd-rollback-inline';
                    rbBtn.innerHTML = '\u21A9 Roll back this change';
                    rbBtn.addEventListener('click', function() {
                        if (!confirm('Roll back to before this change?')) return;
                        rbBtn.disabled = true;
                        ajax('cvd_rollback', {snap_id: snap_id}).then(function(r) {
                            if (r.success) {
                                rbBtn.textContent = '\u2714 Rolled back';
                                rbBtn.style.color = '#86efac';
                            } else {
                                alert('Rollback failed: ' + r.data);
                                rbBtn.disabled = false;
                            }
                        });
                    });
                    changesWrap.appendChild(rbBtn);
                }

                wrap.appendChild(changesWrap);
            }

            messages.scrollTop = messages.scrollHeight;
            return wrap;
        }

        function addTyping() {
            var wrap = document.createElement('div');
            wrap.className = 'cvd-msg agent';
            var avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.textContent = '\u26A1';
            var bubble = document.createElement('div');
            bubble.className = 'bubble';
            bubble.innerHTML = '<div class="cvd-typing"><span></span><span></span><span></span></div>';
            wrap.appendChild(avatar);
            wrap.appendChild(bubble);
            messages.appendChild(wrap);
            messages.scrollTop = messages.scrollHeight;
            return wrap;
        }

        function addSnapToSidebar(snap_id, label) {
            var list = document.getElementById('cvd-snap-list');
            var item = document.createElement('div');
            item.className = 'snap-item';
            item.dataset.snap = snap_id;
            item.innerHTML =
                '<div class="snap-id"># ' + escHtml(snap_id) + '</div>' +
                '<div class="snap-label">' + escHtml(label.substring(0, 50)) + '</div>' +
                '<div class="snap-time">just now</div>';
            list.insertBefore(item, list.firstChild);
        }

        // Sidebar rollback on click
        document.getElementById('cvd-snap-list').addEventListener('click', function(e) {
            var item = e.target.closest('.snap-item');
            if (!item) return;
            if (!confirm('Roll back to commit ' + item.dataset.snap + '?')) return;
            ajax('cvd_rollback', {snap_id: item.dataset.snap}).then(function(r) {
                if (r.success) {
                    addMessage('agent', '\u2714 Rolled back ' + (r.data.restored || []).length + ' file(s) from commit ' + item.dataset.snap + '.');
                } else {
                    alert('Rollback failed: ' + r.data);
                }
            });
        });

        // Clear chat
        document.getElementById('cvd-clear-btn').addEventListener('click', function() {
            messages.innerHTML = '';
            history = [];
        });

        // -- AJAX helper -------------------------------------------------------
        function ajax(action, data) {
            var params = new URLSearchParams();
            params.set('action', action);
            params.set('nonce', NONCE);
            for (var k in data) params.set(k, data[k]);
            return fetch(AJAXURL, {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: params.toString(),
            }).then(function(r) { return r.json(); });
        }

        function escHtml(s) {
            return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        // Focus textarea after load
        setTimeout(function(){ textarea.focus(); }, 100);
    })();
    </script>
    <?php
}

// -- Admin notice for license issues -------------------------------------------
add_action('admin_notices', function () {
    if (!current_user_can('manage_options')) return;
    $screen = get_current_screen();
    if (!$screen || strpos($screen->id, 'coovex-dev') === false) return;

    $status = get_option('cvd_license_status', '');
    if ($status === 'revoked') {
        echo '<div class="notice notice-error"><p><strong>CooVex Dev:</strong> This plugin license has been revoked. Contact <a href="https://coovex.com/support" target="_blank">CooVex support</a>.</p></div>';
    } elseif ($status === 'site_mismatch') {
        echo '<div class="notice notice-error"><p><strong>CooVex Dev:</strong> License domain mismatch. This plugin file was configured for a different site. <a href="' . admin_url('admin.php?page=coovex-dev-settings') . '">Re-download from your CooVex account</a>.</p></div>';
    }
});

// -- Deactivation: unschedule cron ---------------------------------------------
register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('cvd_cleanup_exports');
    wp_clear_scheduled_hook('cvd_daily_license_check');
    wp_clear_scheduled_hook('cvd_telegram_async');
});

// -- Uninstall cleanup ---------------------------------------------------------
// Must be a named function \u2014 register_uninstall_hook() serialises the callback
// to the DB; PHP cannot serialise anonymous functions (Closure).
function cvd_uninstall_cleanup(): void {
    delete_option('cvd_api_key');
    delete_option('cvd_snapshots');
    delete_option('cvd_audit_log');
    delete_option('cvd_license_token');
    delete_option('cvd_license_expires');
    delete_option('cvd_license_status');
    delete_option('cvd_telegram_bot_token');
    delete_option('cvd_telegram_chat_id');
    delete_option('cvd_telegram_webhook_secret');
    delete_option('cvd_telegram_webhook_registered');
    delete_option('cvd_maintenance_enabled');
    delete_option('cvd_redirects');
    delete_option('cvd_webhooks');
    delete_option('cvd_login_log');
    wp_clear_scheduled_hook('cvd_cleanup_exports');
    wp_clear_scheduled_hook('cvd_daily_license_check');
}
register_uninstall_hook(__FILE__, 'cvd_uninstall_cleanup');
`

export async function GET(_req: Request) {
  // Require authentication \u2014 the plugin is only available to CooVex users
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse(
      JSON.stringify({ error: 'Sign in to your CooVex account to download the plugin.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Fetch the user's API key to pre-fill in the plugin
  const { createServiceClient } = await import('@/lib/supabase/service')
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single()

  let prefillApiKey = ''
  if (profile?.current_workspace_id) {
    const { data: business } = await service
      .from('businesses')
      .select('api_key')
      .eq('workspace_id', profile.current_workspace_id)
      .maybeSingle()
    prefillApiKey = business?.api_key ?? ''
  }

  // Embed the user's API key directly in the plugin
  // This ties the plugin to their account and makes sharing useless
  let pluginCode = COOVEX_DEV_PHP
  if (prefillApiKey) {
    pluginCode = pluginCode.replace(
      "define('CVD_VERSION',",
      `// Pre-configured for account: ${user.email}\ndefine('CVD_PREFILL_KEY', '${prefillApiKey}');\ndefine('CVD_VERSION',`
    )
    // Auto-install the API key on first activation
    pluginCode = pluginCode.replace(
      "if (!defined('ABSPATH')) exit;",
      `if (!defined('ABSPATH')) exit;\n\n// Auto-configure on install (always overwrite so reinstalls use the correct key)\nregister_activation_hook(__FILE__, function() {\n    if (defined('CVD_PREFILL_KEY')) {\n        update_option('cvd_api_key', CVD_PREFILL_KEY);\n        delete_option('cvd_license_token');\n        delete_option('cvd_license_expires');\n        delete_option('cvd_license_status');\n        delete_option('cvd_validate_error');\n    }\n});`
    )
  }

  // Serve as a ZIP so WordPress installs it in the correct folder structure:
  // wp-content/plugins/coovex-dev/coovex-dev.php
  // This is required for auto-updates to work (folder slug must match plugin slug).
  const zip = buildZip([
    { name: 'coovex-dev/coovex-dev.php', data: Buffer.from(pluginCode, 'utf8') },
  ])

  return new Response(zip, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="coovex-dev.zip"',
      'Cache-Control': 'no-store, no-cache, private',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}



