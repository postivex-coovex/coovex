<?php
/**
 * Plugin Name:  CooVex Content Push
 * Description:  Receives AI-generated content from CooVex and publishes it as WordPress posts automatically.
 * Version:      1.0.1
 * Author:       CooVex
 * Author URI:   https://app.coovex.com
 * License:      GPL-2.0+
 * Text Domain:  coovex-push
 * Requires at least: 5.0
 * Requires PHP: 7.0
 */

// Prevent direct file access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Define constants only once — avoids conflict if somehow loaded twice
if ( ! defined( 'COOVEX_PUSH_VERSION' ) ) {
    define( 'COOVEX_PUSH_VERSION', '1.0.1' );
    define( 'COOVEX_PUSH_PLUGIN_FILE', __FILE__ );
}

// Guard: don't register hooks twice
if ( ! class_exists( 'CooVex_Push' ) ) :

final class CooVex_Push {

    private static $instance = null;

    public static function instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action( 'admin_menu',    array( $this, 'register_settings_page' ) );
        add_action( 'rest_api_init', array( $this, 'register_rest_route' ) );
    }

    // ── Admin Settings Page ───────────────────────────────────────────────────

    public function register_settings_page() {
        add_options_page(
            __( 'CooVex Push', 'coovex-push' ),
            __( 'CooVex Push', 'coovex-push' ),
            'manage_options',
            'coovex-push',
            array( $this, 'render_settings_page' )
        );
    }

    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        // Save settings
        if ( isset( $_POST['coovex_push_save'] ) ) {
            if ( ! isset( $_POST['_wpnonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['_wpnonce'] ) ), 'coovex_push_save' ) ) {
                wp_die( 'Security check failed.' );
            }
            update_option( 'coovex_push_secret',      sanitize_text_field( wp_unslash( $_POST['coovex_push_secret']      ?? '' ) ) );
            update_option( 'coovex_push_post_status', sanitize_text_field( wp_unslash( $_POST['coovex_push_post_status'] ?? 'publish' ) ) );
            update_option( 'coovex_push_post_author', absint( $_POST['coovex_push_post_author'] ?? 1 ) );
            echo '<div class="notice notice-success is-dismissible"><p><strong>' . esc_html__( 'Settings saved.', 'coovex-push' ) . '</strong></p></div>';
        }

        $secret      = get_option( 'coovex_push_secret', '' );
        $post_status = get_option( 'coovex_push_post_status', 'publish' );
        $post_author = (int) get_option( 'coovex_push_post_author', 1 );
        $webhook_url = get_rest_url( null, 'coovex-push/v1/receive' );

        $users = get_users( array( 'role__in' => array( 'administrator', 'editor', 'author' ), 'orderby' => 'display_name' ) );
        ?>
        <div class="wrap">
            <h1>&#9889; <?php esc_html_e( 'CooVex Content Push', 'coovex-push' ); ?></h1>
            <p><?php esc_html_e( 'Automatically publishes AI-generated content from CooVex to your WordPress site.', 'coovex-push' ); ?></p>

            <div style="background:#f0f6ff;border-left:4px solid #2271b1;padding:12px 16px;margin:16px 0;border-radius:2px;">
                <strong><?php esc_html_e( 'Your Webhook URL', 'coovex-push' ); ?></strong><br>
                <code id="coovex-webhook-url" style="font-size:13px;word-break:break-all;"><?php echo esc_url( $webhook_url ); ?></code>
                &nbsp;<button type="button" onclick="navigator.clipboard.writeText(document.getElementById('coovex-webhook-url').textContent).then(function(){this.textContent='Copied!';}.bind(this))" class="button button-small"><?php esc_html_e( 'Copy', 'coovex-push' ); ?></button>
                <p style="margin:8px 0 0;font-size:12px;color:#555;">
                    <?php esc_html_e( 'Paste this URL into CooVex → Settings → Integrations → Webhook URL', 'coovex-push' ); ?>
                </p>
            </div>

            <form method="post" action="">
                <?php wp_nonce_field( 'coovex_push_save' ); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row">
                            <label for="coovex_push_secret"><?php esc_html_e( 'Webhook Secret', 'coovex-push' ); ?></label>
                        </th>
                        <td>
                            <input
                                type="password"
                                id="coovex_push_secret"
                                name="coovex_push_secret"
                                value="<?php echo esc_attr( $secret ); ?>"
                                class="regular-text"
                                autocomplete="new-password"
                                placeholder="<?php esc_attr_e( 'Paste your CooVex webhook secret', 'coovex-push' ); ?>"
                            >
                            <p class="description">
                                <?php esc_html_e( 'Find it in CooVex → Settings → Integrations → Webhook Secret. Leave blank to skip signature verification.', 'coovex-push' ); ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="coovex_push_post_status"><?php esc_html_e( 'Publish Status', 'coovex-push' ); ?></label>
                        </th>
                        <td>
                            <select id="coovex_push_post_status" name="coovex_push_post_status">
                                <option value="publish" <?php selected( $post_status, 'publish' ); ?>><?php esc_html_e( 'Publish immediately', 'coovex-push' ); ?></option>
                                <option value="draft"   <?php selected( $post_status, 'draft' ); ?>><?php esc_html_e( 'Save as Draft (review before publishing)', 'coovex-push' ); ?></option>
                                <option value="pending" <?php selected( $post_status, 'pending' ); ?>><?php esc_html_e( 'Pending Review', 'coovex-push' ); ?></option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="coovex_push_post_author"><?php esc_html_e( 'Post Author', 'coovex-push' ); ?></label>
                        </th>
                        <td>
                            <select id="coovex_push_post_author" name="coovex_push_post_author">
                                <?php foreach ( $users as $u ) : ?>
                                    <option value="<?php echo esc_attr( $u->ID ); ?>" <?php selected( $post_author, $u->ID ); ?>>
                                        <?php echo esc_html( $u->display_name ); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                </table>
                <?php submit_button( __( 'Save Settings', 'coovex-push' ), 'primary', 'coovex_push_save' ); ?>
            </form>

            <hr>
            <h2><?php esc_html_e( 'How It Works', 'coovex-push' ); ?></h2>
            <ol>
                <li><?php esc_html_e( 'CooVex generates AI content and POSTs it to your Webhook URL above.', 'coovex-push' ); ?></li>
                <li><?php esc_html_e( 'This plugin verifies the signature (if secret set) and creates a WordPress post.', 'coovex-push' ); ?></li>
                <li><?php esc_html_e( 'The plugin notifies CooVex with the live URL so your dashboard stays in sync.', 'coovex-push' ); ?></li>
            </ol>
            <p><a href="https://app.coovex.com" target="_blank" rel="noopener noreferrer">app.coovex.com</a></p>
        </div>
        <?php
    }

    // ── REST API Endpoint ─────────────────────────────────────────────────────

    public function register_rest_route() {
        register_rest_route(
            'coovex-push/v1',
            '/receive',
            array(
                'methods'             => 'POST',
                'callback'            => array( $this, 'handle_push' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    public function handle_push( WP_REST_Request $request ) {
        // ── 1. Verify HMAC signature ─────────────────────────────────────────
        $secret = get_option( 'coovex_push_secret', '' );
        if ( $secret ) {
            $sig      = $request->get_header( 'x-coovex-signature' );
            $expected = 'sha256=' . hash_hmac( 'sha256', $request->get_body(), $secret );
            if ( ! is_string( $sig ) || ! hash_equals( $expected, $sig ) ) {
                return new WP_Error( 'coovex_unauthorized', __( 'Invalid signature.', 'coovex-push' ), array( 'status' => 401 ) );
            }
        }

        // ── 2. Parse payload ─────────────────────────────────────────────────
        $data = $request->get_json_params();
        if ( ! is_array( $data ) ) {
            return new WP_Error( 'coovex_bad_payload', __( 'Invalid JSON payload.', 'coovex-push' ), array( 'status' => 400 ) );
        }

        $title       = isset( $data['title'] )       ? sanitize_text_field( $data['title'] )       : 'New Post';
        $content     = isset( $data['content'] )     ? wp_kses_post( $data['content'] )             : '';
        $channel     = isset( $data['channel'] )     ? sanitize_text_field( $data['channel'] )      : 'blog';
        $confirm_url = isset( $data['confirm_url'] ) ? esc_url_raw( $data['confirm_url'] )          : '';
        $api_key     = isset( $data['api_key'] )     ? sanitize_text_field( $data['api_key'] )      : '';

        // ── 3. Insert WordPress post ─────────────────────────────────────────
        $post_data = array(
            'post_title'   => $title,
            'post_content' => $content,
            'post_status'  => get_option( 'coovex_push_post_status', 'publish' ),
            'post_author'  => (int) get_option( 'coovex_push_post_author', 1 ),
            'post_type'    => 'post',
        );

        // Add tags if channel provided — uses wp_set_post_tags which is available in WP 2.3+
        $post_id = wp_insert_post( $post_data, true );

        if ( is_wp_error( $post_id ) ) {
            return new WP_Error( 'coovex_insert_failed', $post_id->get_error_message(), array( 'status' => 500 ) );
        }

        // Tag the post with channel
        if ( $channel ) {
            wp_set_post_tags( $post_id, array( 'coovex', $channel ), false );
        }

        $published_url = get_permalink( $post_id );

        // ── 4. Confirm back to CooVex ────────────────────────────────────────
        if ( $confirm_url ) {
            $body = wp_json_encode( array(
                'api_key'      => $api_key,
                'external_url' => $published_url,
                'published_at' => current_time( 'c' ),
            ) );

            wp_remote_post(
                $confirm_url,
                array(
                    'body'    => $body,
                    'headers' => array( 'Content-Type' => 'application/json' ),
                    'timeout' => 15,
                    'blocking' => false, // fire-and-forget; don't delay response
                )
            );
        }

        return rest_ensure_response( array(
            'ok'         => true,
            'wp_post_id' => $post_id,
            'url'        => $published_url,
        ) );
    }
}

endif; // class_exists

// Boot the plugin
function coovex_push_init() {
    return CooVex_Push::instance();
}
add_action( 'plugins_loaded', 'coovex_push_init' );
