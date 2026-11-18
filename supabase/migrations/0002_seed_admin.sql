-- =============================================================================
-- Platform admin bootstrap — the SQL equivalent of POST /api/seed.
-- Run after 0001_init.sql. Safe to run more than once.
--
-- Creates (or repairs) the sign-in for SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
-- as a confirmed user with is_platform_admin = true, so /admin-login works
-- even when SUPABASE_SERVICE_ROLE_KEY is unavailable.
-- =============================================================================

do $$
declare
  admin_email text := 'admin@admin.com';
  admin_password text := 'adminadmin';
  admin_name text := 'Platform Admin';
  admin_id uuid;
begin
  select id into admin_id from auth.users where lower(email) = admin_email;

  if admin_id is null then
    admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      admin_email, crypt(admin_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', admin_name),
      false, false
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), admin_id, admin_id::text, 'email',
      jsonb_build_object('sub', admin_id::text, 'email', admin_email, 'email_verified', true),
      now(), now(), now()
    );
  else
    -- The account already exists (e.g. created by a signup that never got its
    -- confirmation email): confirm it and reset the password to the seed one.
    update auth.users
       set encrypted_password = crypt(admin_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = admin_id;
  end if;

  insert into public.profiles (id, full_name, email, is_platform_admin)
  values (admin_id, admin_name, admin_email, true)
  on conflict (id) do update
    set is_platform_admin = true,
        email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);
end $$;
