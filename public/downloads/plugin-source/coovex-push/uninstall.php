<?php
/**
 * Fired when the plugin is uninstalled.
 * Removes all plugin options from the database.
 */

// If uninstall not called from WordPress, exit
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

delete_option( 'coovex_push_secret' );
delete_option( 'coovex_push_post_status' );
delete_option( 'coovex_push_post_author' );
