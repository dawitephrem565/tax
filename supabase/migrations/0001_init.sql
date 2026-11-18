-- =============================================================================
-- Amis Financial — Phase 0/1 foundation
-- Port of the Odoo groups/rules model to Supabase Postgres.
--
-- Odoo                          -> here
-- res.company                   -> companies
-- res.users + res.groups        -> auth.users + profiles + company_members.role
-- ir.rule company_ids           -> my_company_ids() / has_company_role()
-- ir.attachment / fields.Binary -> storage bucket "documents" + company_documents
-- tax report upload             -> reports + report_files
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.company_status as enum ('pending', 'approved', 'rejected', 'suspended');

-- Mirrors ethiopia_company_portal groups, flattened into one membership column.
create type public.company_role as enum (
  'company_admin',     -- group_et_company_admin
  'accountant',        -- group_et_company_accountant
  'payroll_officer',   -- group_ethiopia_payroll_officer
  'payroll_manager',   -- group_ethiopia_payroll_manager
  'ceo'                -- group_ethiopia_ceo
);

create type public.report_status as enum ('pending', 'approved', 'rejected');

create type public.document_type as enum (
  'license',
  'license_registration',
  'vat_certificate',
  'tin_certificate',
  'trade_license_1',
  'trade_license_2',
  'vat_certificate_1',
  'vat_certificate_2',
  'other'
);

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.business_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tin text not null unique,
  address text,
  phone text,
  email text not null unique,
  manager_phone text,
  business_type_id uuid references public.business_types (id) on delete set null,
  status public.company_status not null default 'pending',
  onboarding_date date not null default current_date,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per auth user. is_platform_admin replaces group_et_portal_super_admin.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.company_role not null default 'accountant',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index company_members_user_idx on public.company_members (user_id);

create table public.company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  document_type public.document_type not null,
  sequence integer not null default 1,
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size integer,
  uploaded_by uuid references auth.users (id) on delete set null,
  upload_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index company_documents_company_idx on public.company_documents (company_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  report_type text not null check (
    report_type in ('VAT', 'Withholding Tax', 'Pension', 'Income Tax', 'Sold Receipt', 'Withhold Receipt')
  ),
  status public.report_status not null default 'pending',
  submitted_by uuid references auth.users (id) on delete set null,
  review_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reports_company_idx on public.reports (company_id);

create table public.report_files (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size integer,
  created_at timestamptz not null default now()
);

create index report_files_report_idx on public.report_files (report_id);

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger reports_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Profile bootstrap: every auth user gets a profile (replaces res.users sync)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS helpers — the port of Odoo's `company_ids` record rules.
-- SECURITY DEFINER avoids recursive RLS evaluation on company_members.
-- -----------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.my_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.company_id
  from public.company_members m
  where m.user_id = auth.uid();
$$;

create or replace function public.has_company_role(c uuid, roles public.company_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = c
      and m.user_id = auth.uid()
      and m.role = any (roles)
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.business_types enable row level security;
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_members enable row level security;
alter table public.company_documents enable row level security;
alter table public.reports enable row level security;
alter table public.report_files enable row level security;

-- business_types: readable by everyone signed in, maintained by platform admin
create policy business_types_select on public.business_types
  for select to authenticated using (true);

create policy business_types_write on public.business_types
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- profiles: own row, plus platform admin sees all
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_platform_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- a member must never be able to grant themselves platform admin
revoke update (is_platform_admin) on public.profiles from authenticated, anon;

-- companies: members see their own company; platform admin sees everything
create policy companies_select on public.companies
  for select to authenticated
  using (public.is_platform_admin() or id in (select public.my_company_ids()));

create policy companies_admin_write on public.companies
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy companies_company_admin_update on public.companies
  for update to authenticated
  using (public.has_company_role(id, array['company_admin']::public.company_role[]))
  with check (public.has_company_role(id, array['company_admin']::public.company_role[]));

-- company_members: visible to the member, their company admins, platform admin
create policy company_members_select on public.company_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or public.has_company_role(company_id, array['company_admin']::public.company_role[])
  );

create policy company_members_admin_write on public.company_members
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy company_members_company_admin_write on public.company_members
  for insert to authenticated
  with check (public.has_company_role(company_id, array['company_admin']::public.company_role[]));

create policy company_members_company_admin_delete on public.company_members
  for delete to authenticated
  using (public.has_company_role(company_id, array['company_admin']::public.company_role[]));

-- company documents: read for the company, write for company admins
create policy company_documents_select on public.company_documents
  for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));

create policy company_documents_write on public.company_documents
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy company_documents_company_admin_write on public.company_documents
  for all to authenticated
  using (public.has_company_role(company_id, array['company_admin']::public.company_role[]))
  with check (public.has_company_role(company_id, array['company_admin']::public.company_role[]));

-- reports: read for the company, submitted by admins/accountants
create policy reports_select on public.reports
  for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));

create policy reports_insert on public.reports
  for insert to authenticated
  with check (
    public.is_platform_admin()
    or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[])
  );

create policy reports_review on public.reports
  for update to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin']::public.company_role[]));

create policy report_files_select on public.report_files
  for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.reports r
      where r.id = report_files.report_id
        and r.company_id in (select public.my_company_ids())
    )
  );

create policy report_files_insert on public.report_files
  for insert to authenticated
  with check (
    public.is_platform_admin()
    or exists (
      select 1 from public.reports r
      where r.id = report_files.report_id
        and public.has_company_role(r.company_id, array['company_admin', 'accountant']::public.company_role[])
    )
  );

-- -----------------------------------------------------------------------------
-- Storage: private bucket. Paths are companies/<company_id>/<file>.
-- Files are served by /api/files, which authorises and then signs a URL.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Reference data (business types from ethiopia.business.type)
-- -----------------------------------------------------------------------------
insert into public.business_types (name, code) values
  ('Manufacturing', 'MFG'),
  ('Trading / Retail', 'TRD'),
  ('Services', 'SRV'),
  ('Construction', 'CON'),
  ('Agriculture', 'AGR'),
  ('Import / Export', 'IMP'),
  ('Transport and Logistics', 'TRN'),
  ('Hotel and Tourism', 'HTL'),
  ('ICT and Software', 'ICT'),
  ('Financial Services', 'FIN'),
  ('Other', 'OTH')
on conflict (name) do nothing;
