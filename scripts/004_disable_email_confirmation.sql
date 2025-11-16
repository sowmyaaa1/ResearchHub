-- Disable email confirmation requirement in Supabase Auth
-- Run this in your Supabase SQL Editor
UPDATE auth.config 
SET config = jsonb_set(
  config,
  '{mailer,autoconfirm}',
  'true'
)
WHERE key = 'auth';

-- For new signups, auto-confirm users immediately
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL AND created_at > NOW() - INTERVAL '1 hour';
