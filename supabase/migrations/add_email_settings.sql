-- Store per-business email sending configuration
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email_settings JSONB DEFAULT '{}';

-- Example email_settings structure:
-- {
--   "method": "smtp" | "resend" | "coovex" | "reply_to",
--   "from_name": "John's Business",
--   "from_email": "hello@mybusiness.com",
--   "reply_to": "john@mybusiness.com",
--   "smtp_host": "smtp.gmail.com",
--   "smtp_port": 587,
--   "smtp_user": "john@gmail.com",
--   "smtp_pass": "app_password_here",
--   "smtp_secure": false,
--   "resend_api_key": "re_...",
--   "resend_from_email": "hello@mybusiness.com",
--   "coovex_subdomain": "johns-co"
-- }
