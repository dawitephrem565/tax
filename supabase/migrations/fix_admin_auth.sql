-- =============================================================================
-- Fix Platform Admin Login for GoTrue in Supabase
-- Run this in Supabase Dashboard -> SQL Editor
-- =============================================================================

-- 1. Remove previous attempt cleanly
delete from auth.identities where identity_data->>'email' = 'admin@admin.com' or provider_id = 'admin@admin.com';
delete from public.profiles where email = 'admin@admin.com';
delete from auth.users where email = 'admin@admin.com';

-- 2. Insert verified platform admin compatible with all Supabase GoTrue versions
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  deleted_at,
  is_anonymous
) values (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin@admin.com',
  crypt('adminadmin', gen_salt('bf')),
  now(),
  null,
  '',
  null,
  '',
  null,
  '',
  '',
  null,
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Platform Admin"}'::jsonb,
  false,
  now(),
  now(),
  null,
  null,
  '',
  '',
  null,
  '',
  0,
  null,
  '',
  null,
  false,
  null,
  false
);

-- 3. Link identity for email auth
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  format('{"sub":"%s","email":"%s"}', 'a0000000-0000-0000-0000-000000000001', 'admin@admin.com')::jsonb,
  'email',
  'admin@admin.com',
  now(),
  now(),
  now()
);

-- 4. Create Platform Admin Profile with full privileges
insert into public.profiles (id, full_name, email, is_platform_admin)
values (
  'a0000000-0000-0000-0000-000000000001',
  'Platform Admin',
  'admin@admin.com',
  true
)
on conflict (id) do update set is_platform_admin = true;

