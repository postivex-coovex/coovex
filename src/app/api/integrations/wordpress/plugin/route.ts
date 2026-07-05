import { NextResponse } from 'next/server'

const PLUGIN_PHP = `<?php
/**
 * Plugin Name: CooVex AI Business Agent
 * Plugin URI:  https://coovex.com
 * Description: Connect your WordPress site to CooVex — embed the AI chat widget, sync published posts, and monitor site health.
 * Version:     1.0.0
 * Author:      CooVex
 * License:     GPL2
 */

if (!defined('ABSPATH')) exit;

define('COOVEX_VERSION', '1.0.0');
define('COOVEX_PLUGIN_FILE', __FILE__);

// ─── Admin settings page ──────────────────────────────────────────────────────

add_action('admin_menu', function () {
    add_options_page('CooVex', 'CooVex', 'manage_options', 'coovex', 'coovex_settings_page');
});

add_action('admin_init', function () {
    register_setting('coovex_options', 'coovex_api_key');
    register_setting('coovex_options', 'coovex_workspace_id');
    register_setting('coovex_options', 'coovex_chatbot_id');
    register_setting('coovex_options', 'coovex_chat_enabled');
    register_setting('coovex_options', 'coovex_auto_sync');
});

function coovex_settings_page() {
    $api_key      = get_option('coovex_api_key', '');
    $workspace_id = get_option('coovex_workspace_id', '');
    $chatbot_id   = get_option('coovex_chatbot_id', '');
    $chat_enabled = get_option('coovex_chat_enabled', '1');
    $auto_sync    = get_option('coovex_auto_sync', '1');
    ?>
    <div class="wrap">
        <h1>⚡ CooVex Settings</h1>
        <form method="post" action="options.php">
            <?php settings_fields('coovex_options'); ?>
            <table class="form-table">
                <tr>
                    <th><label for="coovex_api_key">API Key</label></th>
                    <td>
                        <input type="password" id="coovex_api_key" name="coovex_api_key"
                            value="<?php echo esc_attr($api_key); ?>" class="regular-text" />
                        <p class="description">Find your API key in CooVex → Settings → Integrations.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="coovex_workspace_id">Workspace ID</label></th>
                    <td>
                        <input type="text" id="coovex_workspace_id" name="coovex_workspace_id"
                            value="<?php echo esc_attr($workspace_id); ?>" class="regular-text" />
                    </td>
                </tr>
                <tr>
                    <th><label for="coovex_chatbot_id">Chatbot ID</label></th>
                    <td>
                        <input type="text" id="coovex_chatbot_id" name="coovex_chatbot_id"
                            value="<?php echo esc_attr($chatbot_id); ?>" class="regular-text" />
                        <p class="description">From CooVex → Chatbot Builder → Embed Code. Leave blank to disable chat widget.</p>
                    </td>
                </tr>
                <tr>
                    <th>Chat Widget</th>
                    <td>
                        <label>
                            <input type="checkbox" name="coovex_chat_enabled" value="1"
                                <?php checked($chat_enabled, '1'); ?> />
                            Show AI chat widget on all pages
                        </label>
                    </td>
                </tr>
                <tr>
                    <th>Auto-sync Posts</th>
                    <td>
                        <label>
                            <input type="checkbox" name="coovex_auto_sync" value="1"
                                <?php checked($auto_sync, '1'); ?> />
                            Automatically sync published posts to CooVex content calendar
                        </label>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>

        <hr />
        <h2>Manual Actions</h2>
        <p>
            <button id="coovex-test-connection" class="button button-secondary">Test Connection</button>
            <button id="coovex-sync-now" class="button button-secondary" style="margin-left:8px;">Sync Recent Posts Now</button>
            <span id="coovex-action-result" style="margin-left:12px;"></span>
        </p>

        <script>
        document.getElementById('coovex-test-connection').addEventListener('click', function() {
            var result = document.getElementById('coovex-action-result');
            result.textContent = 'Testing...';
            fetch('<?php echo esc_url(admin_url('admin-ajax.php')); ?>', {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: 'action=coovex_test_connection'
            }).then(r => r.json()).then(d => {
                result.textContent = d.success ? '✓ Connected successfully!' : '✗ ' + (d.data || 'Connection failed');
                result.style.color = d.success ? 'green' : 'red';
            });
        });

        document.getElementById('coovex-sync-now').addEventListener('click', function() {
            var result = document.getElementById('coovex-action-result');
            result.textContent = 'Syncing...';
            fetch('<?php echo esc_url(admin_url('admin-ajax.php')); ?>', {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: 'action=coovex_sync_posts'
            }).then(r => r.json()).then(d => {
                result.textContent = d.success ? '✓ ' + d.data : '✗ Sync failed';
                result.style.color = d.success ? 'green' : 'red';
            });
        });
        </script>
    </div>
    <?php
}

// ─── AJAX handlers ────────────────────────────────────────────────────────────

add_action('wp_ajax_coovex_test_connection', function () {
    $api_key      = get_option('coovex_api_key', '');
    $workspace_id = get_option('coovex_workspace_id', '');

    if (empty($api_key) || empty($workspace_id)) {
        wp_send_json_error('API key and workspace ID required.');
    }

    $response = wp_remote_get('https://coovex.com/api/webhooks/zapier?secret=' . urlencode($api_key), [
        'timeout' => 10,
        'headers' => ['x-webhook-secret' => $api_key],
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error($response->get_error_message());
    }

    $code = wp_remote_retrieve_response_code($response);
    if ($code === 200) {
        wp_send_json_success('Connected to CooVex!');
    } else {
        wp_send_json_error('Unexpected response code: ' . $code);
    }
});

add_action('wp_ajax_coovex_sync_posts', function () {
    $synced = coovex_sync_recent_posts(10);
    wp_send_json_success("Synced {$synced} post(s).");
});

// ─── Auto-sync on publish ─────────────────────────────────────────────────────

add_action('publish_post', function ($post_id) {
    if (get_option('coovex_auto_sync', '1') !== '1') return;
    $post = get_post($post_id);
    if (!$post) return;
    coovex_push_post($post);
}, 10, 1);

function coovex_push_post($post) {
    $api_key      = get_option('coovex_api_key', '');
    $workspace_id = get_option('coovex_workspace_id', '');
    if (empty($api_key) || empty($workspace_id)) return false;

    $body = wp_json_encode([
        'event'        => 'create_post',
        'workspace_id' => $workspace_id,
        'data'         => [
            'content'   => wp_strip_all_tags($post->post_content),
            'channel'   => 'website',
            'source_url'=> get_permalink($post),
        ],
    ]);

    wp_remote_post('https://coovex.com/api/webhooks/zapier', [
        'timeout' => 10,
        'headers' => [
            'Content-Type'     => 'application/json',
            'x-webhook-secret' => $api_key,
        ],
        'body' => $body,
    ]);

    return true;
}

function coovex_sync_recent_posts($limit = 10) {
    $posts = get_posts(['numberposts' => $limit, 'post_status' => 'publish']);
    $count = 0;
    foreach ($posts as $post) {
        if (coovex_push_post($post)) $count++;
    }
    return $count;
}

// ─── Chat widget ──────────────────────────────────────────────────────────────

add_action('wp_footer', function () {
    $chat_enabled = get_option('coovex_chat_enabled', '1');
    $chatbot_id   = get_option('coovex_chatbot_id', '');
    if ($chat_enabled !== '1' || empty($chatbot_id)) return;
    ?>
    <script>
    (function(){
        var iframe = document.createElement('iframe');
        iframe.src = 'https://coovex.com/embed/chat/<?php echo esc_js($chatbot_id); ?>';
        iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:380px;height:520px;border:none;z-index:9999;background:transparent;';
        iframe.allow = 'microphone';
        document.body.appendChild(iframe);
    })();
    </script>
    <?php
});

// ─── Shortcode ────────────────────────────────────────────────────────────────

add_shortcode('coovex_chat', function ($atts) {
    $chatbot_id = get_option('coovex_chatbot_id', '');
    if (empty($chatbot_id)) return '';
    $atts = shortcode_atts(['height' => '520', 'width' => '380'], $atts);
    return '<iframe src="https://coovex.com/embed/chat/' . esc_attr($chatbot_id) . '"'
        . ' style="width:' . esc_attr($atts['width']) . 'px;height:' . esc_attr($atts['height']) . 'px;border:none;"'
        . ' allow="microphone"></iframe>';
});

// ─── Dashboard widget ─────────────────────────────────────────────────────────

add_action('wp_dashboard_setup', function () {
    wp_add_dashboard_widget('coovex_widget', '⚡ CooVex Status', 'coovex_dashboard_widget');
});

function coovex_dashboard_widget() {
    $workspace_id = get_option('coovex_workspace_id', '');
    if (empty($workspace_id)) {
        echo '<p>Configure your Workspace ID in <a href="' . esc_url(admin_url('options-general.php?page=coovex')) . '">CooVex Settings</a> to see live stats.</p>';
        return;
    }
    echo '<p style="color:#64748b;font-size:12px;">CooVex AI Business Agent is active.</p>';
    echo '<p><a href="https://coovex.com/dashboard" target="_blank" rel="noopener">Open CooVex Dashboard →</a></p>';
}
`

export async function GET() {
  return new NextResponse(PLUGIN_PHP, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="coovex.php"',
    },
  })
}
