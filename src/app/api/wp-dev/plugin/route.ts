import { NextResponse } from 'next/server'

/* eslint-disable no-useless-escape */

const COOVEX_DEV_PHP = `<?php
/**
 * Plugin Name: CooVex Dev
 * Plugin URI:  https://coovex.com/dev
 * Description: AI agent that writes, edits, and manages your WordPress site. Speak plain language — CooVex Dev delivers working code.
 * Version:     1.0.0
 * Author:      CooVex
 * Author URI:  https://coovex.com
 * License:     GPL2
 * Requires at least: 5.9
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

// ── Constants ─────────────────────────────────────────────────────────────────
define('CVD_VERSION',         '1.0.0');
define('CVD_API_URL',         'https://app.coovex.com/api/wp-dev/command');
define('CVD_SESSION_TTL',     30 * MINUTE_IN_SECONDS); // 30 minutes
define('CVD_MAX_SNAPSHOTS',   25);
define('CVD_RATE_LIMIT',      12); // max commands per 5 minutes
define('CVD_COOKIE',          'cvd_session');

// ── Admin menu ────────────────────────────────────────────────────────────────
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

// ── Settings registration ─────────────────────────────────────────────────────
add_action('admin_init', function () {
    register_setting('cvd_options', 'cvd_api_key',        ['sanitize_callback' => 'sanitize_text_field']);
    register_setting('cvd_options', 'cvd_workspace_id',   ['sanitize_callback' => 'sanitize_text_field']);
    register_setting('cvd_options', 'cvd_password_hash',  ['sanitize_callback' => 'sanitize_text_field']);
});

// ── Session helpers ───────────────────────────────────────────────────────────
function cvd_session_key(string $token): string {
    return 'cvd_sess_' . substr(hash('sha256', $token), 0, 20);
}

function cvd_session_start(string $password): ?string {
    $hash = get_option('cvd_password_hash', '');
    if (empty($hash)) return null;
    if (!wp_check_password($password, $hash)) return null;

    $token = bin2hex(random_bytes(24));
    set_transient(cvd_session_key($token), [
        'uid'  => get_current_user_id(),
        'ip'   => sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? ''),
        'born' => time(),
    ], CVD_SESSION_TTL);

    setcookie(CVD_COOKIE, $token, [
        'expires'  => 0,
        'path'     => '/wp-admin/',
        'secure'   => is_ssl(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    return $token;
}

function cvd_session_valid(): bool {
    $token = sanitize_text_field($_COOKIE[CVD_COOKIE] ?? '');
    if (empty($token)) return false;
    $key  = cvd_session_key($token);
    $data = get_transient($key);
    if (!$data) return false;
    if ((int)($data['uid'] ?? 0) !== get_current_user_id()) return false;
    // Refresh TTL (activity = reset clock)
    set_transient($key, $data, CVD_SESSION_TTL);
    return true;
}

function cvd_session_destroy(): void {
    $token = sanitize_text_field($_COOKIE[CVD_COOKIE] ?? '');
    if ($token) delete_transient(cvd_session_key($token));
    setcookie(CVD_COOKIE, '', time() - 3600, '/wp-admin/');
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
function cvd_rate_check(): bool {
    $key   = 'cvd_rate_' . get_current_user_id();
    $count = (int) get_transient($key);
    if ($count >= CVD_RATE_LIMIT) return false;
    set_transient($key, $count + 1, 5 * MINUTE_IN_SECONDS);
    return true;
}

// ── Snapshot system ───────────────────────────────────────────────────────────
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

// ── File resolution (path security) ──────────────────────────────────────────
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
            // Directory doesn't exist yet — validate parent chain
            if (strpos(dirname($target), realpath($base) ?: $base) === 0) {
                return $target;
            }
        }
    }
    return null;
}

// ── Apply a single change ─────────────────────────────────────────────────────
function cvd_apply_change(array $change): array {
    require_once ABSPATH . 'wp-admin/includes/file.php';
    WP_Filesystem();
    global $wp_filesystem, $wpdb;

    $type = $change['type'] ?? 'file';

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

// ── Collect site context ──────────────────────────────────────────────────────
function cvd_site_context(): array {
    global $wpdb;

    $active_plugins = get_option('active_plugins', []);
    $plugin_names   = [];
    foreach ($active_plugins as $p) {
        $data = get_plugin_data(WP_PLUGIN_DIR . '/' . $p, false, false);
        $plugin_names[] = $data['Name'] ?: $p;
    }

    $tables = $wpdb->get_col("SHOW TABLES");

    return [
        'wp_version'   => get_bloginfo('version'),
        'php_version'  => PHP_VERSION,
        'site_url'     => get_site_url(),
        'active_theme' => wp_get_theme()->get('Name') . ' ' . wp_get_theme()->get('Version'),
        'plugins'      => $plugin_names,
        'db_tables'    => $tables,
    ];
}

// ── AJAX: authenticate ────────────────────────────────────────────────────────
add_action('wp_ajax_cvd_auth', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);

    $password = sanitize_text_field($_POST['password'] ?? '');
    $token    = cvd_session_start($password);

    if ($token) {
        wp_send_json_success(['authenticated' => true]);
    } else {
        wp_send_json_error('Incorrect password.');
    }
});

// ── AJAX: logout ──────────────────────────────────────────────────────────────
add_action('wp_ajax_cvd_logout', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    cvd_session_destroy();
    wp_send_json_success();
});

// ── AJAX: send command ────────────────────────────────────────────────────────
add_action('wp_ajax_cvd_command', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);
    if (!cvd_session_valid())                wp_send_json_error('Session expired. Please re-enter your CooVex Dev password.', 401);
    if (!cvd_rate_check())                   wp_send_json_error('Rate limit reached. Wait a moment.', 429);

    $api_key = get_option('cvd_api_key', '');
    if (empty($api_key)) wp_send_json_error('API key not configured. Go to CooVex Dev → Settings.', 400);

    $command = sanitize_textarea_field($_POST['command'] ?? '');
    if (empty($command)) wp_send_json_error('Empty command', 400);

    $raw_history = json_decode(stripslashes($_POST['history'] ?? '[]'), true) ?? [];
    $history     = array_slice($raw_history, -10); // last 10 turns for context

    $site_context = cvd_site_context();
    $body         = wp_json_encode([
        'api_key'   => $api_key,
        'command'   => $command,
        'history'   => $history,
        'site_info' => $site_context,
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

    $code    = wp_remote_retrieve_response_code($response);
    $payload = json_decode(wp_remote_retrieve_body($response), true);

    if ($code === 402) {
        wp_send_json_error($payload['error'] ?? 'Insufficient credits.', 402);
    }
    if ($code !== 200 || empty($payload['ok'])) {
        wp_send_json_error($payload['error'] ?? 'API error (HTTP ' . $code . ')');
    }

    $changes      = $payload['changes'] ?? [];
    $results      = [];
    $files_touched = [];

    if (!empty($changes)) {
        // Collect file paths for snapshot (before applying)
        foreach ($changes as $ch) {
            if (($ch['type'] ?? 'file') === 'file' && !empty($ch['file'])) {
                $files_touched[] = $ch['file'];
            }
        }

        // Take snapshot BEFORE applying
        $snap_id = cvd_snapshot_take($files_touched, $command);

        // Apply changes
        foreach ($changes as $ch) {
            $results[] = cvd_apply_change($ch);
        }
    }

    // Build audit log entry
    cvd_audit_log([
        'command'   => $command,
        'changes'   => count($changes),
        'snap_id'   => $snap_id ?? null,
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

// ── AJAX: rollback ────────────────────────────────────────────────────────────
add_action('wp_ajax_cvd_rollback', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);
    if (!cvd_session_valid())                wp_send_json_error('Session expired.', 401);

    $snap_id = sanitize_text_field($_POST['snap_id'] ?? '');
    $result  = cvd_snapshot_rollback($snap_id);

    if ($result['ok']) {
        cvd_audit_log(['command' => 'ROLLBACK to ' . $snap_id, 'user' => wp_get_current_user()->user_login, 'time' => time()]);
        wp_send_json_success($result);
    } else {
        wp_send_json_error($result['error']);
    }
});

// ── AJAX: session check (heartbeat) ──────────────────────────────────────────
add_action('wp_ajax_cvd_ping', function () {
    wp_send_json(['authenticated' => cvd_session_valid()]);
});

// ── AJAX: get file tree ───────────────────────────────────────────────────────
add_action('wp_ajax_cvd_file_tree', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);
    if (!cvd_session_valid())                wp_send_json_error('Session expired.', 401);

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

// ── AJAX: read file ───────────────────────────────────────────────────────────
add_action('wp_ajax_cvd_read_file', function () {
    check_ajax_referer('cvd_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Forbidden', 403);
    if (!cvd_session_valid())                wp_send_json_error('Session expired.', 401);

    $rel = sanitize_text_field($_POST['file'] ?? '');
    $abs = cvd_resolve_path($rel);
    if (!$abs || !file_exists($abs)) wp_send_json_error('File not found');

    $size = filesize($abs);
    if ($size > 500 * 1024) wp_send_json_error('File too large to read (> 500 KB)');

    wp_send_json_success(['content' => file_get_contents($abs), 'size' => $size]);
});

// ── Audit log ─────────────────────────────────────────────────────────────────
function cvd_audit_log(array $entry): void {
    $log   = get_option('cvd_audit_log', []);
    array_unshift($log, $entry);
    update_option('cvd_audit_log', array_slice($log, 0, 200), false);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PAGES
// ─────────────────────────────────────────────────────────────────────────────

// ── Settings page ─────────────────────────────────────────────────────────────
function cvd_page_settings() {
    if (!current_user_can('manage_options')) return;

    // Handle password set
    $pw_notice = '';
    if (isset($_POST['cvd_set_password']) && check_admin_referer('cvd_set_pw')) {
        $pw  = $_POST['cvd_new_password'] ?? '';
        $pw2 = $_POST['cvd_confirm_password'] ?? '';
        if (strlen($pw) < 8) {
            $pw_notice = '<div class="notice notice-error"><p>Password must be at least 8 characters.</p></div>';
        } elseif ($pw !== $pw2) {
            $pw_notice = '<div class="notice notice-error"><p>Passwords do not match.</p></div>';
        } else {
            update_option('cvd_password_hash', wp_hash_password($pw));
            $pw_notice = '<div class="notice notice-success"><p>Dev password updated.</p></div>';
        }
    }

    settings_errors('cvd_options');
    ?>
    <div class="wrap">
        <h1 style="display:flex;align-items:center;gap:8px;">
            <span class="dashicons dashicons-editor-code" style="font-size:24px;color:#2563eb;"></span>
            CooVex Dev — Settings
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

        <hr style="margin:32px 0;" />

        <h2>Dev Password</h2>
        <p style="color:#64748b;">
            This password is separate from your WordPress login and your CooVex account.
            It protects the CooVex Dev agent from unauthorized use.
            Sessions expire after <strong>30 minutes of inactivity</strong>.
        </p>

        <form method="post" action="">
            <?php wp_nonce_field('cvd_set_pw'); ?>
            <table class="form-table">
                <tr>
                    <th><label for="cvd_new_password">New Dev Password</label></th>
                    <td><input type="password" id="cvd_new_password" name="cvd_new_password" class="regular-text" autocomplete="new-password" /></td>
                </tr>
                <tr>
                    <th><label for="cvd_confirm_password">Confirm Password</label></th>
                    <td><input type="password" id="cvd_confirm_password" name="cvd_confirm_password" class="regular-text" /></td>
                </tr>
            </table>
            <p><input type="submit" name="cvd_set_password" class="button button-primary" value="<?php echo empty(get_option('cvd_password_hash')) ? 'Set Dev Password' : 'Change Dev Password'; ?>" /></p>
        </form>

        <?php
        $api_key = get_option('cvd_api_key', '');
        $has_pw  = !empty(get_option('cvd_password_hash', ''));
        if ($api_key && $has_pw): ?>
        <div style="margin-top:24px;padding:12px 16px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;color:#166534;">
            ✓ CooVex Dev is configured. <a href="<?php echo admin_url('admin.php?page=coovex-dev'); ?>">Open Dev Agent →</a>
        </div>
        <?php elseif (!$api_key): ?>
        <div style="margin-top:24px;padding:12px 16px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;color:#991b1b;">
            API key not set — the agent cannot connect to CooVex.
        </div>
        <?php elseif (!$has_pw): ?>
        <div style="margin-top:24px;padding:12px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412;">
            Dev password not set — set a password to enable the agent.
        </div>
        <?php endif; ?>
    </div>
    <?php
}

// ── Commit History page ───────────────────────────────────────────────────────
function cvd_page_history() {
    if (!current_user_can('manage_options')) return;
    $snaps = get_option('cvd_snapshots', []);
    ?>
    <div class="wrap">
        <h1 style="display:flex;align-items:center;gap:8px;">
            <span class="dashicons dashicons-backup" style="font-size:24px;color:#2563eb;"></span>
            CooVex Dev — Commit History
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
                    <td><?php echo esc_html(wp_trim_words($s['label'], 12, '…')); ?></td>
                    <td><?php echo count($s['files']); ?> file(s)</td>
                    <td>
                        <button class="button button-secondary cvd-rollback-btn"
                            data-snap="<?php echo esc_attr($s['id']); ?>"
                            data-label="<?php echo esc_attr($s['label']); ?>">
                            ↩ Roll back
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
                btn.textContent = 'Rolling back…';

                fetch(ajaxurl, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: 'action=cvd_rollback&nonce=' + encodeURIComponent(nonce) + '&snap_id=' + encodeURIComponent(snap)
                })
                .then(r => r.json())
                .then(function(d) {
                    if (d.success) {
                        btn.textContent = '✓ Rolled back';
                        btn.style.color = 'green';
                        alert('Restored ' + (d.data.restored || []).length + ' file(s) from commit ' + snap);
                    } else {
                        btn.textContent = '↩ Roll back';
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

// ── Dev Agent page (main chat) ────────────────────────────────────────────────
function cvd_page_agent() {
    if (!current_user_can('manage_options')) return;

    $api_key = get_option('cvd_api_key', '');
    $has_pw  = !empty(get_option('cvd_password_hash', ''));

    if (!$api_key || !$has_pw) {
        echo '<div class="wrap"><div style="margin-top:48px;max-width:480px;">';
        echo '<h2>CooVex Dev — Setup Required</h2>';
        if (!$api_key) echo '<p>Add your <strong>CooVex API key</strong> in <a href="' . admin_url('admin.php?page=coovex-dev-settings') . '">Settings</a>.</p>';
        if (!$has_pw)  echo '<p>Set a <strong>dev password</strong> in <a href="' . admin_url('admin.php?page=coovex-dev-settings') . '">Settings</a>.</p>';
        echo '</div></div>';
        return;
    }

    $nonce           = wp_create_nonce('cvd_nonce');
    $already_authed  = cvd_session_valid() ? 'true' : 'false';
    $session_ttl_min = CVD_SESSION_TTL / 60;
    ?>
    <style>
    #wpcontent { background: #0f172a !important; }
    #wpbody-content { padding: 0 !important; }
    #cvd-app {
        display: flex;
        height: calc(100vh - 46px);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #0f172a;
        color: #e2e8f0;
    }
    /* ── Sidebar ── */
    #cvd-sidebar {
        width: 260px;
        min-width: 260px;
        background: #0a0f1e;
        border-right: 1px solid #1e293b;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    #cvd-sidebar-header {
        padding: 16px;
        border-bottom: 1px solid #1e293b;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    #cvd-sidebar-header .cvd-logo {
        font-size: 15px;
        font-weight: 700;
        color: #60a5fa;
        letter-spacing: -.3px;
    }
    #cvd-sidebar-header .cvd-version {
        margin-left: auto;
        font-size: 10px;
        color: #475569;
        background: #1e293b;
        padding: 2px 6px;
        border-radius: 4px;
    }
    #cvd-credits-bar {
        padding: 10px 16px;
        font-size: 12px;
        color: #64748b;
        border-bottom: 1px solid #1e293b;
    }
    #cvd-credits-bar span { color: #94a3b8; }
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
    #cvd-snap-list .snap-item:hover { background: #1e293b; }
    #cvd-snap-list .snap-item .snap-id {
        font-size: 11px;
        font-family: monospace;
        color: #60a5fa;
    }
    #cvd-snap-list .snap-item .snap-label {
        font-size: 12px;
        color: #cbd5e1;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    #cvd-snap-list .snap-item .snap-time {
        font-size: 10px;
        color: #475569;
        margin-top: 2px;
    }
    #cvd-sidebar-footer {
        padding: 12px 16px;
        border-top: 1px solid #1e293b;
        display: flex;
        gap: 8px;
    }
    #cvd-sidebar-footer button {
        font-size: 11px;
        padding: 5px 10px;
        border-radius: 6px;
        border: 1px solid #334155;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
    }
    #cvd-sidebar-footer button:hover { background: #1e293b; color: #e2e8f0; }
    /* ── Main ── */
    #cvd-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    #cvd-topbar {
        padding: 12px 20px;
        border-bottom: 1px solid #1e293b;
        display: flex;
        align-items: center;
        gap: 10px;
        background: #0f172a;
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
        color: #475569;
        font-family: monospace;
    }
    /* ── Messages ── */
    #cvd-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
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
    .cvd-msg.user .avatar { background: #1d4ed8; color: #bfdbfe; }
    .cvd-msg.agent .avatar { background: #1e293b; color: #60a5fa; font-size: 14px; }
    .cvd-msg .bubble {
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 13.5px;
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
    }
    .cvd-msg.user .bubble { background: #1e3a8a; color: #e0f2fe; border-bottom-right-radius: 4px; }
    .cvd-msg.agent .bubble { background: #1e293b; color: #e2e8f0; border-bottom-left-radius: 4px; }
    .cvd-msg.agent.error .bubble { background: #450a0a; color: #fca5a5; }
    /* ── Changes block ── */
    .cvd-changes { margin-top: 8px; width: 100%; }
    .cvd-change-item {
        background: #0f2441;
        border: 1px solid #1e3a5f;
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
    .badge-create { background: #14532d; color: #86efac; }
    .badge-update { background: #1e3a5f; color: #60a5fa; }
    .badge-delete { background: #450a0a; color: #fca5a5; }
    .badge-db     { background: #2d1b69; color: #c4b5fd; }
    .cvd-change-header .filepath {
        font-family: monospace;
        font-size: 12px;
        color: #94a3b8;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .cvd-change-header .toggle-icon { color: #475569; font-size: 11px; }
    .cvd-change-body {
        display: none;
        padding: 0 12px 12px;
    }
    .cvd-change-body pre {
        margin: 0;
        padding: 10px;
        background: #020617;
        border-radius: 6px;
        font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', monospace;
        font-size: 11px;
        line-height: 1.5;
        color: #94a3b8;
        overflow-x: auto;
        max-height: 300px;
    }
    .cvd-change-item.open .cvd-change-body { display: block; }
    .cvd-change-item.ok .cvd-change-header { background: #0a1628; }
    .cvd-change-item.fail .cvd-change-header { background: #1a0a0a; }
    .cvd-rollback-inline {
        margin-top: 6px;
        font-size: 11px;
        color: #60a5fa;
        cursor: pointer;
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 8px;
        border: 1px solid #1e3a5f;
        border-radius: 5px;
        background: transparent;
    }
    .cvd-rollback-inline:hover { background: #1e293b; }
    /* ── Typing indicator ── */
    .cvd-typing { display: flex; align-items: center; gap: 4px; padding: 8px 14px; }
    .cvd-typing span {
        width: 6px; height: 6px;
        background: #60a5fa;
        border-radius: 50%;
        animation: cvd-bounce .8s infinite;
    }
    .cvd-typing span:nth-child(2) { animation-delay: .15s; }
    .cvd-typing span:nth-child(3) { animation-delay: .3s; }
    @keyframes cvd-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
    /* ── Input ── */
    #cvd-input-area {
        padding: 16px 20px;
        border-top: 1px solid #1e293b;
        background: #0f172a;
        display: flex; gap: 10px; align-items: flex-end;
    }
    #cvd-textarea {
        flex: 1;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 12px;
        color: #e2e8f0;
        font-size: 13.5px;
        line-height: 1.5;
        padding: 10px 14px;
        resize: none;
        min-height: 42px;
        max-height: 140px;
        outline: none;
        font-family: inherit;
    }
    #cvd-textarea:focus { border-color: #3b82f6; }
    #cvd-textarea::placeholder { color: #475569; }
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
    #cvd-input-hint { font-size: 11px; color: #334155; padding: 0 20px 8px; text-align: right; }
    /* ── Auth overlay ── */
    #cvd-auth-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,.75);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    #cvd-auth-box {
        background: #0f172a;
        border: 1px solid #1e293b;
        border-radius: 16px;
        padding: 36px 40px;
        width: 360px;
        text-align: center;
    }
    #cvd-auth-box .icon { font-size: 40px; margin-bottom: 12px; }
    #cvd-auth-box h2 { font-size: 20px; color: #e2e8f0; margin: 0 0 4px; }
    #cvd-auth-box p { font-size: 13px; color: #64748b; margin: 0 0 24px; }
    #cvd-auth-input {
        width: 100%;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 10px;
        color: #e2e8f0;
        font-size: 15px;
        padding: 12px 14px;
        outline: none;
        box-sizing: border-box;
    }
    #cvd-auth-input:focus { border-color: #3b82f6; }
    #cvd-auth-btn {
        width: 100%;
        background: #2563eb;
        border: none;
        border-radius: 10px;
        color: white;
        font-size: 14px;
        font-weight: 600;
        padding: 12px;
        cursor: pointer;
        margin-top: 12px;
    }
    #cvd-auth-btn:hover { background: #1d4ed8; }
    #cvd-auth-error { color: #f87171; font-size: 12px; margin-top: 8px; min-height: 18px; }
    #cvd-auth-links { margin-top: 20px; }
    #cvd-auth-links a { font-size: 12px; color: #475569; text-decoration: none; }
    #cvd-auth-links a:hover { color: #94a3b8; }
    /* Scrollbar */
    #cvd-messages::-webkit-scrollbar, #cvd-snap-list::-webkit-scrollbar { width: 4px; }
    #cvd-messages::-webkit-scrollbar-track, #cvd-snap-list::-webkit-scrollbar-track { background: transparent; }
    #cvd-messages::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
    </style>

    <div id="cvd-app" style="position:relative;">

        <!-- Auth overlay -->
        <div id="cvd-auth-overlay" style="display: <?php echo $already_authed === 'true' ? 'none' : 'flex'; ?>;">
            <div id="cvd-auth-box">
                <div class="icon">🔑</div>
                <h2>CooVex Dev</h2>
                <p>Enter your dev password to start this session.<br>Sessions expire after <?php echo $session_ttl_min; ?> minutes of inactivity.</p>
                <input type="password" id="cvd-auth-input" placeholder="Dev password" autocomplete="current-password" />
                <button id="cvd-auth-btn">Unlock</button>
                <div id="cvd-auth-error"></div>
                <div id="cvd-auth-links">
                    <a href="<?php echo admin_url('admin.php?page=coovex-dev-settings'); ?>">Forgot password? Reset in Settings →</a>
                </div>
            </div>
        </div>

        <!-- Sidebar -->
        <div id="cvd-sidebar">
            <div id="cvd-sidebar-header">
                <span class="dashicons dashicons-editor-code" style="color:#60a5fa;font-size:18px;"></span>
                <span class="cvd-logo">CooVex Dev</span>
                <span class="cvd-version">v<?php echo CVD_VERSION; ?></span>
            </div>
            <div id="cvd-credits-bar">Credits remaining: <span id="cvd-credits-val">—</span></div>
            <div id="cvd-snap-list">
                <?php
                $snaps = get_option('cvd_snapshots', []);
                foreach (array_slice($snaps, 0, 20) as $s):
                ?>
                <div class="snap-item" data-snap="<?php echo esc_attr($s['id']); ?>">
                    <div class="snap-id"># <?php echo esc_html($s['id']); ?></div>
                    <div class="snap-label"><?php echo esc_html(wp_trim_words($s['label'], 8, '…')); ?></div>
                    <div class="snap-time"><?php echo esc_html(human_time_diff($s['time'])); ?> ago</div>
                </div>
                <?php endforeach; ?>
            </div>
            <div id="cvd-sidebar-footer">
                <button id="cvd-clear-btn">Clear chat</button>
                <button id="cvd-history-btn" onclick="location.href='<?php echo admin_url('admin.php?page=coovex-dev-history'); ?>'">All commits</button>
                <button id="cvd-logout-btn">Lock</button>
            </div>
        </div>

        <!-- Main chat -->
        <div id="cvd-main">
            <div id="cvd-topbar">
                <span class="status-dot" id="cvd-status-dot"></span>
                <span class="status-label" id="cvd-status-label">Connected</span>
                <span class="session-timer" id="cvd-session-timer"></span>
            </div>

            <div id="cvd-messages">
                <div class="cvd-msg agent">
                    <div class="avatar">⚡</div>
                    <div class="bubble">Welcome to CooVex Dev. I can write code, install plugins, edit themes, and modify your database.

What would you like to build or change?</div>
                </div>
            </div>

            <div id="cvd-input-area">
                <textarea id="cvd-textarea" rows="1" placeholder="Tell me what to build or change… (Ctrl+Enter to send)"></textarea>
                <button id="cvd-send-btn">Send</button>
            </div>
            <div id="cvd-input-hint">Ctrl+Enter to send · credits deducted per use</div>
        </div>

    </div>

    <script>
    (function() {
        var NONCE = <?php echo json_encode($nonce); ?>;
        var AJAXURL = <?php echo json_encode(admin_url('admin-ajax.php')); ?>;
        var SESSION_TTL_MS = <?php echo CVD_SESSION_TTL * 1000; ?>;
        var authenticated = <?php echo $already_authed; ?>;
        var history = [];
        var lastActivity = Date.now();
        var sessionStart = Date.now();

        // ── Auth ──────────────────────────────────────────────────────────────
        var authInput  = document.getElementById('cvd-auth-input');
        var authBtn    = document.getElementById('cvd-auth-btn');
        var authError  = document.getElementById('cvd-auth-error');
        var authOverlay= document.getElementById('cvd-auth-overlay');

        function doAuth() {
            var pw = authInput.value;
            if (!pw) return;
            authBtn.disabled = true;
            authBtn.textContent = 'Unlocking…';

            ajax('cvd_auth', {password: pw})
            .then(function(r) {
                if (r.success) {
                    authOverlay.style.display = 'none';
                    authenticated = true;
                    sessionStart = Date.now();
                    lastActivity = Date.now();
                    document.getElementById('cvd-textarea').focus();
                } else {
                    authError.textContent = r.data || 'Incorrect password.';
                }
            })
            .finally(function() {
                authBtn.disabled = false;
                authBtn.textContent = 'Unlock';
                authInput.value = '';
            });
        }

        authBtn.addEventListener('click', doAuth);
        authInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doAuth(); });

        // ── Logout / lock ─────────────────────────────────────────────────────
        document.getElementById('cvd-logout-btn').addEventListener('click', function() {
            ajax('cvd_logout', {}).then(function() {
                authenticated = false;
                authError.textContent = '';
                authOverlay.style.display = 'flex';
            });
        });

        // ── Session timer ─────────────────────────────────────────────────────
        var timerEl = document.getElementById('cvd-session-timer');
        setInterval(function() {
            if (!authenticated) return;
            var remaining = SESSION_TTL_MS - (Date.now() - lastActivity);
            if (remaining <= 0) {
                authenticated = false;
                authOverlay.style.display = 'flex';
                timerEl.textContent = '';
                return;
            }
            var mins = Math.floor(remaining / 60000);
            var secs = Math.floor((remaining % 60000) / 1000);
            timerEl.textContent = 'Session: ' + mins + ':' + (secs < 10 ? '0' : '') + secs;
            if (remaining < 5 * 60 * 1000) timerEl.style.color = '#f59e0b';
            else timerEl.style.color = '';
        }, 1000);

        // ── Send command ──────────────────────────────────────────────────────
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

        function sendCommand() {
            if (!authenticated) { authOverlay.style.display = 'flex'; return; }
            var cmd = textarea.value.trim();
            if (!cmd || sendBtn.disabled) return;

            lastActivity = Date.now();
            addMessage('user', cmd);
            history.push({role: 'user', content: cmd});
            textarea.value = '';
            textarea.style.height = '';

            sendBtn.disabled = true;
            var typingEl = addTyping();

            ajax('cvd_command', {command: cmd, history: JSON.stringify(history)})
            .then(function(r) {
                typingEl.remove();
                if (r.success) {
                    var d = r.data;
                    if (d.credits_remaining != null) creditsEl.textContent = d.credits_remaining;
                    if (d.credits_used != null) {
                        var usedNote = document.createElement('span');
                        usedNote.style.cssText = 'color:#475569;margin-left:6px;font-size:10px;';
                        usedNote.textContent = '(' + d.credits_used + ' used)';
                        document.getElementById('cvd-credits-bar').appendChild(usedNote);
                        setTimeout(function(){ usedNote.remove(); }, 5000);
                    }
                    addAgentMessage(d.message, d.changes, d.snap_id);
                    history.push({role: 'assistant', content: d.message});
                    if (history.length > 20) history = history.slice(-20);
                    if (d.snap_id) addSnapToSidebar(d.snap_id, cmd);
                } else {
                    var errCode = typeof r.data === 'object' ? r.data : {message: r.data};
                    if (errCode === 401) { authenticated = false; authOverlay.style.display = 'flex'; return; }
                    addMessage('agent error', r.data || 'An error occurred.');
                }
            })
            .catch(function(err) {
                typingEl.remove();
                addMessage('agent error', 'Network error: ' + err.message);
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
            avatar.textContent = isUser ? wp_username_initial : '⚡';

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
                    filepath.textContent = ok ? label : ('✗ ' + label + ' — ' + (ch.error || 'failed'));

                    var toggleIcon = document.createElement('span');
                    toggleIcon.className = 'toggle-icon';
                    toggleIcon.textContent = '▼';

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
                        p.textContent = 'Query OK — ' + ch.rows_affected + ' row(s) affected.';
                        body.appendChild(p);
                    }

                    header.addEventListener('click', function() {
                        item.classList.toggle('open');
                        toggleIcon.textContent = item.classList.contains('open') ? '▲' : '▼';
                    });

                    item.appendChild(header);
                    item.appendChild(body);
                    changesWrap.appendChild(item);
                });

                if (snap_id) {
                    var rbBtn = document.createElement('button');
                    rbBtn.className = 'cvd-rollback-inline';
                    rbBtn.innerHTML = '↩ Roll back this change';
                    rbBtn.addEventListener('click', function() {
                        if (!confirm('Roll back to before this change?')) return;
                        rbBtn.disabled = true;
                        ajax('cvd_rollback', {snap_id: snap_id}).then(function(r) {
                            if (r.success) {
                                rbBtn.textContent = '✓ Rolled back';
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
            avatar.textContent = '⚡';
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
                    addMessage('agent', '✓ Rolled back ' + (r.data.restored || []).length + ' file(s) from commit ' + item.dataset.snap + '.');
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

        // ── Ping heartbeat (every 2 minutes) ──────────────────────────────────
        setInterval(function() {
            if (!authenticated) return;
            fetch(AJAXURL + '?action=cvd_ping')
            .then(function(r){ return r.json(); })
            .then(function(d) {
                if (!d.authenticated) {
                    authenticated = false;
                    authOverlay.style.display = 'flex';
                }
            });
        }, 2 * 60 * 1000);

        // ── AJAX helper ───────────────────────────────────────────────────────
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
        if (authenticated) setTimeout(function(){ textarea.focus(); }, 100);
    })();
    </script>
    <?php
}

// ── Uninstall cleanup ─────────────────────────────────────────────────────────
register_uninstall_hook(__FILE__, function () {
    delete_option('cvd_api_key');
    delete_option('cvd_password_hash');
    delete_option('cvd_snapshots');
    delete_option('cvd_audit_log');
    // Transient sessions expire naturally
});
`

export async function GET() {
  return new NextResponse(COOVEX_DEV_PHP, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="coovex-dev.php"',
      'Cache-Control': 'no-store',
    },
  })
}
