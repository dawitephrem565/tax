-- =============================================================================
-- Amis Financial / Ethiopian Company Portal — Complete All-In-One Schema
-- Port of Odoo 19 Community Modules:
--   1. ethiopia_company_portal
--   2. ethiopia_accounting_payroll
--
-- Target: Supabase PostgreSQL
-- Includes: Multi-Tenant RLS, RBAC Roles, Storage Buckets, Triggers & Seeds
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. TYPES & ENUMS
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.company_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.company_role as enum (
    'company_admin',     -- group_et_company_admin
    'accountant',        -- group_et_company_accountant
    'payroll_officer',   -- group_ethiopia_payroll_officer
    'payroll_manager',   -- group_ethiopia_payroll_manager
    'ceo'                -- group_ethiopia_ceo
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
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
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.receipt_status as enum ('draft', 'ocr_done', 'registered', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.receipt_type as enum ('sale', 'purchase', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.filebox_category as enum (
    'petty_cash',
    'income_tax_pension',
    'purchase_receipt',
    'sales_receipt',
    'agreement',
    'z_report'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.agreement_state as enum ('draft', 'published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stock_move_type as enum ('incoming', 'outgoing', 'adjustment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.balance_type as enum (
    'opening',
    'deposit',
    'withdrawal',
    'sale',
    'purchase',
    'sale_refund',
    'purchase_refund',
    'payroll'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.approval_state as enum (
    'not_required',
    'pending',
    'level1_approved',
    'approved',
    'rejected'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. CORE PLATFORM & COMPANY TABLES
-- -----------------------------------------------------------------------------
create table if not exists public.business_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
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

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.company_role not null default 'accountant',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index if not exists company_members_user_idx on public.company_members (user_id);
create index if not exists company_members_company_idx on public.company_members (company_id);

create table if not exists public.company_documents (
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
create index if not exists company_documents_company_idx on public.company_documents (company_id);

create table if not exists public.reports (
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
create index if not exists reports_company_idx on public.reports (company_id);

create table if not exists public.report_files (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size integer,
  created_at timestamptz not null default now()
);
create index if not exists report_files_report_idx on public.report_files (report_id);

-- -----------------------------------------------------------------------------
-- 3. ODOO PORT: RECEIPT INTAKE & TWO-IMAGE OCR (ethiopia.receipt.intake)
-- -----------------------------------------------------------------------------
create table if not exists public.receipt_intakes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null, -- sequence / ref e.g. REC/2026/0001
  state public.receipt_status not null default 'draft',
  receipt_type public.receipt_type not null default 'unknown',
  classification_source text,
  classification_note text,
  detected_header_name text,
  
  -- Dual-Image attachments
  company_document_path text,
  company_document_name text,
  cash_register_receipt_path text,
  cash_register_receipt_name text,
  
  -- OCR metadata
  ocr_engine text,
  ocr_confidence numeric(5,2),
  raw_text_company text,
  raw_text_cash_register text,
  ocr_warnings text,
  
  -- Vendor / Partner info
  partner_name text,
  partner_tin text,
  issuer_name text,
  issuer_tin text,
  buyer_name text,
  buyer_tin text,
  
  -- Ethiopian Cash Register / Invoicing details
  invoice_number text,
  invoice_date date default current_date,
  fs_number text,
  machine_number text,
  duplicate_warning text,
  
  -- Tax and Financial calculations
  currency text not null default 'ETB',
  untaxed_amount numeric(16,2) not null default 0.00,
  vat_amount numeric(16,2) not null default 0.00,
  wht_rate numeric(5,2) not null default 3.00,
  suggested_wht_rate numeric(5,2) default 3.00,
  wht_amount numeric(16,2) not null default 0.00,
  total_amount numeric(16,2) not null default 0.00,
  apply_vat boolean not null default true,
  apply_wht boolean not null default true,
  vat_inferred boolean not null default false,
  line_description text default 'Goods and services per receipt',
  notes text,
  
  registered_by uuid references auth.users (id) on delete set null,
  registered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists receipt_intakes_company_idx on public.receipt_intakes (company_id);
create index if not exists receipt_intakes_fs_machine_idx on public.receipt_intakes (company_id, fs_number, machine_number);

-- -----------------------------------------------------------------------------
-- 4. ODOO PORT: FILE BOXES (ethiopia.file.box)
-- -----------------------------------------------------------------------------
create table if not exists public.file_boxes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  category public.filebox_category not null,
  storage_path text not null,
  filename text not null,
  mimetype text,
  file_size integer,
  notes text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists file_boxes_company_category_idx on public.file_boxes (company_id, category);

-- -----------------------------------------------------------------------------
-- 5. ODOO PORT: AGREEMENTS & TEMPLATES (ethiopia.agreement & template)
-- -----------------------------------------------------------------------------
create table if not exists public.agreement_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null, -- HTML content with Amharic Unicode support
  state public.agreement_state not null default 'draft',
  source_filename text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  template_id uuid not null references public.agreement_templates (id) on delete restrict,
  name text not null,
  body text not null,
  source_name text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, template_id)
);
create index if not exists agreements_company_idx on public.agreements (company_id);

-- -----------------------------------------------------------------------------
-- 6. ODOO PORT: STOCK APP (stock.product & stock.picking)
-- -----------------------------------------------------------------------------
create table if not exists public.stock_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  code text,
  unit_of_measure text not null default 'Unit',
  unit_price numeric(16,2) not null default 0.00,
  cost_price numeric(16,2) not null default 0.00,
  quantity_on_hand numeric(16,2) not null default 0.00,
  is_storable boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stock_products_company_idx on public.stock_products (company_id);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  product_id uuid not null references public.stock_products (id) on delete cascade,
  movement_type public.stock_move_type not null,
  reference text,
  quantity numeric(16,2) not null,
  unit_price numeric(16,2) not null default 0.00,
  status text not null default 'done' check (status in ('draft', 'confirmed', 'done', 'cancelled')),
  date date not null default current_date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id);

-- -----------------------------------------------------------------------------
-- 7. ODOO PORT: TREASURY / BALANCES (ethiopia.balance.transaction)
-- -----------------------------------------------------------------------------
create table if not exists public.balance_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  date date not null default current_date,
  transaction_type public.balance_type not null default 'deposit',
  amount numeric(16,2) not null,
  signed_amount numeric(16,2) not null, -- positive for inflows, negative for outflows
  description text,
  receipt_intake_id uuid references public.receipt_intakes (id) on delete set null,
  automatic boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists balance_transactions_company_date_idx on public.balance_transactions (company_id, date desc);

-- -----------------------------------------------------------------------------
-- 8. ODOO PORT: ETHIOPIAN PAYROLL & TAX BRACKETS (hr_payroll_ethiopia & settings)
-- -----------------------------------------------------------------------------
create table if not exists public.tax_brackets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  preset text not null default 'current_2025' check (preset in ('current_2025', 'legacy')),
  sequence integer not null default 10,
  lower_bound numeric(16,2) not null,
  upper_bound numeric(16,2), -- null or 0 for unbounded
  rate numeric(5,2) not null,
  deduction numeric(16,2) not null default 0.00
);

create table if not exists public.payroll_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  tax_preset text not null default 'current_2025',
  pension_employee_rate numeric(5,2) not null default 7.00,
  pension_employer_rate numeric(5,2) not null default 11.00,
  pension_base text not null default 'basic' check (pension_base in ('basic', 'gross')),
  pension_ceiling numeric(16,2) not null default 0.00,
  transport_exempt_limit numeric(16,2) not null default 2200.00,
  transport_exempt_percent numeric(5,2) not null default 25.00,
  approval_level_1_threshold numeric(16,2) not null default 10000.00,
  approval_level_2_threshold numeric(16,2) not null default 50000.00,
  updated_at timestamptz not null default now()
);

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null, -- e.g. "Nov 2026 Payroll"
  date_from date not null,
  date_to date not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'posted', 'cancelled')),
  total_basic numeric(16,2) not null default 0.00,
  total_gross numeric(16,2) not null default 0.00,
  total_taxable numeric(16,2) not null default 0.00,
  total_income_tax numeric(16,2) not null default 0.00,
  total_pension_employee numeric(16,2) not null default 0.00,
  total_pension_employer numeric(16,2) not null default 0.00,
  total_net_pay numeric(16,2) not null default 0.00,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists payroll_runs_company_idx on public.payroll_runs (company_id);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_name text not null,
  tin text,
  pension_number text,
  basic_salary numeric(16,2) not null default 0.00,
  work_days numeric(5,2) not null default 30.00,
  basic_earned numeric(16,2) not null default 0.00,
  overtime numeric(16,2) not null default 0.00,
  housing_allowance numeric(16,2) not null default 0.00,
  transport_allowance numeric(16,2) not null default 0.00,
  other_allowance numeric(16,2) not null default 0.00,
  non_taxable_allowance numeric(16,2) not null default 0.00,
  taxable_allowance numeric(16,2) not null default 0.00,
  gross_salary numeric(16,2) not null default 0.00,
  pension_employee numeric(16,2) not null default 0.00,
  pension_employer numeric(16,2) not null default 0.00,
  taxable_income numeric(16,2) not null default 0.00,
  income_tax numeric(16,2) not null default 0.00,
  advance_paid numeric(16,2) not null default 0.00,
  other_deduction numeric(16,2) not null default 0.00,
  total_deductions numeric(16,2) not null default 0.00,
  net_pay numeric(16,2) not null default 0.00,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
create index if not exists payslips_run_idx on public.payslips (payroll_run_id);
create index if not exists payslips_company_idx on public.payslips (company_id);

-- -----------------------------------------------------------------------------
-- 9. ODOO PORT: MULTI-LEVEL APPROVAL WORKFLOW (approval.py)
-- -----------------------------------------------------------------------------
create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  document_type text not null check (document_type in ('invoice', 'bill', 'receipt', 'payroll')),
  document_id text not null,
  title text not null,
  amount numeric(16,2) not null default 0.00,
  approval_state public.approval_state not null default 'pending',
  required_level integer not null default 1,
  current_level integer not null default 1,
  submitted_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists approval_requests_company_idx on public.approval_requests (company_id);

create table if not exists public.approval_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.approval_requests (id) on delete cascade,
  action text not null, -- 'submit', 'level1_approve', 'approve', 'reject'
  state_before public.approval_state not null,
  state_after public.approval_state not null,
  performed_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists approval_logs_request_idx on public.approval_logs (request_id);

-- -----------------------------------------------------------------------------
-- 10. TRIGGERS: auto updated_at & signed_amount
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists reports_updated_at on public.reports;
create trigger reports_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

drop trigger if exists receipt_intakes_updated_at on public.receipt_intakes;
create trigger receipt_intakes_updated_at before update on public.receipt_intakes
  for each row execute function public.set_updated_at();

drop trigger if exists agreement_templates_updated_at on public.agreement_templates;
create trigger agreement_templates_updated_at before update on public.agreement_templates
  for each row execute function public.set_updated_at();

drop trigger if exists agreements_updated_at on public.agreements;
create trigger agreements_updated_at before update on public.agreements
  for each row execute function public.set_updated_at();

drop trigger if exists stock_products_updated_at on public.stock_products;
create trigger stock_products_updated_at before update on public.stock_products
  for each row execute function public.set_updated_at();

drop trigger if exists approval_requests_updated_at on public.approval_requests;
create trigger approval_requests_updated_at before update on public.approval_requests
  for each row execute function public.set_updated_at();

-- Auto calculate signed amount for balance transactions
create or replace function public.calc_balance_signed_amount()
returns trigger language plpgsql as $$
begin
  if new.transaction_type in ('opening', 'deposit', 'sale', 'purchase_refund') then
    new.signed_amount = abs(new.amount);
  else
    new.signed_amount = -abs(new.amount);
  end if;
  return new;
end;
$$;

drop trigger if exists balance_transactions_signed_calc on public.balance_transactions;
create trigger balance_transactions_signed_calc before insert or update on public.balance_transactions
  for each row execute function public.calc_balance_signed_amount();

-- Auto update product quantity on stock movement
create or replace function public.apply_stock_movement()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') and new.status = 'done' then
    if new.movement_type = 'incoming' then
      update public.stock_products set quantity_on_hand = quantity_on_hand + new.quantity where id = new.product_id;
    elsif new.movement_type = 'outgoing' then
      update public.stock_products set quantity_on_hand = quantity_on_hand - new.quantity where id = new.product_id;
    elsif new.movement_type = 'adjustment' then
      update public.stock_products set quantity_on_hand = new.quantity where id = new.product_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_stock_movement_done on public.stock_movements;
create trigger on_stock_movement_done after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- -----------------------------------------------------------------------------
-- 11. PROFILE BOOTSTRAP TRIGGER (New auth user -> profile)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 12. ROW-LEVEL SECURITY HELPERS (Odoo record rules port)
-- -----------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.my_company_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m.company_id
  from public.company_members m
  where m.user_id = auth.uid();
$$;

create or replace function public.has_company_role(c uuid, roles public.company_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = c
      and m.user_id = auth.uid()
      and m.role = any (roles)
  );
$$;

-- -----------------------------------------------------------------------------
-- 13. ENABLE ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.business_types enable row level security;
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_members enable row level security;
alter table public.company_documents enable row level security;
alter table public.reports enable row level security;
alter table public.report_files enable row level security;
alter table public.receipt_intakes enable row level security;
alter table public.file_boxes enable row level security;
alter table public.agreement_templates enable row level security;
alter table public.agreements enable row level security;
alter table public.stock_products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.balance_transactions enable row level security;
alter table public.tax_brackets enable row level security;
alter table public.payroll_settings enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_logs enable row level security;

-- -----------------------------------------------------------------------------
-- 14. RLS POLICIES (Full multi-tenant + role isolation)
-- -----------------------------------------------------------------------------

-- Business Types
drop policy if exists business_types_select on public.business_types;
create policy business_types_select on public.business_types for select to authenticated using (true);
drop policy if exists business_types_write on public.business_types;
create policy business_types_write on public.business_types for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_platform_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Companies
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (public.is_platform_admin() or id in (select public.my_company_ids()));
drop policy if exists companies_admin_write on public.companies;
create policy companies_admin_write on public.companies for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists companies_company_admin_update on public.companies;
create policy companies_company_admin_update on public.companies for update to authenticated
  using (public.has_company_role(id, array['company_admin']::public.company_role[]))
  with check (public.has_company_role(id, array['company_admin']::public.company_role[]));

-- Company Members
drop policy if exists company_members_select on public.company_members;
create policy company_members_select on public.company_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or public.has_company_role(company_id, array['company_admin']::public.company_role[])
  );
drop policy if exists company_members_admin_write on public.company_members;
create policy company_members_admin_write on public.company_members for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists company_members_company_admin_write on public.company_members;
create policy company_members_company_admin_write on public.company_members for insert to authenticated
  with check (public.has_company_role(company_id, array['company_admin']::public.company_role[]));
drop policy if exists company_members_company_admin_delete on public.company_members;
create policy company_members_company_admin_delete on public.company_members for delete to authenticated
  using (public.has_company_role(company_id, array['company_admin']::public.company_role[]));

-- Company Documents
drop policy if exists company_documents_select on public.company_documents;
create policy company_documents_select on public.company_documents for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));
drop policy if exists company_documents_write on public.company_documents;
create policy company_documents_write on public.company_documents for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin']::public.company_role[]));

-- Reports & Files
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]));
drop policy if exists reports_review on public.reports;
create policy reports_review on public.reports for update to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin']::public.company_role[]));

drop policy if exists report_files_select on public.report_files;
create policy report_files_select on public.report_files for select to authenticated
  using (public.is_platform_admin() or exists (
    select 1 from public.reports r where r.id = report_files.report_id and r.company_id in (select public.my_company_ids())
  ));
drop policy if exists report_files_insert on public.report_files;
create policy report_files_insert on public.report_files for insert to authenticated
  with check (public.is_platform_admin() or exists (
    select 1 from public.reports r where r.id = report_files.report_id and public.has_company_role(r.company_id, array['company_admin', 'accountant']::public.company_role[])
  ));

-- Receipt Intakes
drop policy if exists receipt_intakes_select on public.receipt_intakes;
create policy receipt_intakes_select on public.receipt_intakes for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));
drop policy if exists receipt_intakes_write on public.receipt_intakes;
create policy receipt_intakes_write on public.receipt_intakes for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]));

-- File Boxes
drop policy if exists file_boxes_select on public.file_boxes;
create policy file_boxes_select on public.file_boxes for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));
drop policy if exists file_boxes_write on public.file_boxes;
create policy file_boxes_write on public.file_boxes for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]));

-- Agreement Templates
drop policy if exists agreement_templates_select on public.agreement_templates;
create policy agreement_templates_select on public.agreement_templates for select to authenticated
  using (state = 'published' or public.is_platform_admin());
drop policy if exists agreement_templates_write on public.agreement_templates;
create policy agreement_templates_write on public.agreement_templates for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Company Agreements
drop policy if exists agreements_select on public.agreements;
create policy agreements_select on public.agreements for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));
drop policy if exists agreements_write on public.agreements;
create policy agreements_write on public.agreements for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'ceo', 'accountant']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'ceo', 'accountant']::public.company_role[]));

-- Stock Products & Movements
drop policy if exists stock_products_select on public.stock_products;
create policy stock_products_select on public.stock_products for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));
drop policy if exists stock_products_write on public.stock_products;
create policy stock_products_write on public.stock_products for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]));

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));
drop policy if exists stock_movements_write on public.stock_movements;
create policy stock_movements_write on public.stock_movements for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]));

-- Balance Transactions
drop policy if exists balance_transactions_select on public.balance_transactions;
create policy balance_transactions_select on public.balance_transactions for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));
drop policy if exists balance_transactions_write on public.balance_transactions;
create policy balance_transactions_write on public.balance_transactions for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant', 'ceo']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant', 'ceo']::public.company_role[]));

-- Tax Brackets (Global read, platform admin write)
drop policy if exists tax_brackets_select on public.tax_brackets;
create policy tax_brackets_select on public.tax_brackets for select to authenticated using (true);
drop policy if exists tax_brackets_write on public.tax_brackets;
create policy tax_brackets_write on public.tax_brackets for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Payroll Settings
drop policy if exists payroll_settings_select on public.payroll_settings;
create policy payroll_settings_select on public.payroll_settings for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));
drop policy if exists payroll_settings_write on public.payroll_settings;
create policy payroll_settings_write on public.payroll_settings for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'payroll_manager']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'payroll_manager']::public.company_role[]));

-- Payroll Runs & Payslips
drop policy if exists payroll_runs_select on public.payroll_runs;
create policy payroll_runs_select on public.payroll_runs for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));
drop policy if exists payroll_runs_write on public.payroll_runs;
create policy payroll_runs_write on public.payroll_runs for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'payroll_officer', 'payroll_manager']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'payroll_officer', 'payroll_manager']::public.company_role[]));

drop policy if exists payslips_select on public.payslips;
create policy payslips_select on public.payslips for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));
drop policy if exists payslips_write on public.payslips;
create policy payslips_write on public.payslips for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'payroll_officer', 'payroll_manager']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'payroll_officer', 'payroll_manager']::public.company_role[]));

-- Approval Requests & Logs
drop policy if exists approval_requests_select on public.approval_requests;
create policy approval_requests_select on public.approval_requests for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));
drop policy if exists approval_requests_write on public.approval_requests;
create policy approval_requests_write on public.approval_requests for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant', 'ceo']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant', 'ceo']::public.company_role[]));

drop policy if exists approval_logs_select on public.approval_logs;
create policy approval_logs_select on public.approval_logs for select to authenticated
  using (public.is_platform_admin() or exists (
    select 1 from public.approval_requests req where req.id = approval_logs.request_id and req.company_id in (select public.my_company_ids())
  ));
drop policy if exists approval_logs_insert on public.approval_logs;
create policy approval_logs_insert on public.approval_logs for insert to authenticated
  with check (public.is_platform_admin() or exists (
    select 1 from public.approval_requests req where req.id = approval_logs.request_id and public.has_company_role(req.company_id, array['company_admin', 'accountant', 'ceo']::public.company_role[])
  ));

-- -----------------------------------------------------------------------------
-- 15. STORAGE BUCKETS (Private with Signed URLs)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('documents', 'documents', false),
  ('receipts', 'receipts', false),
  ('fileboxes', 'fileboxes', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 16. SEED DATA
-- -----------------------------------------------------------------------------

-- Business Types
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

-- Ethiopian Tax Brackets (2025 Current & Legacy Rules from Odoo)
delete from public.tax_brackets;
insert into public.tax_brackets (preset, sequence, name, lower_bound, upper_bound, rate, deduction) values
  -- 2025 Schedule (Effective from August 2025)
  ('current_2025', 10, '0 - 2,000 ETB (Exempt)', 0.00, 2000.00, 0.00, 0.00),
  ('current_2025', 20, '2,001 - 4,000 ETB (10%)', 2000.00, 4000.00, 10.00, 200.00),
  ('current_2025', 30, '4,001 - 7,000 ETB (15%)', 4000.00, 7000.00, 15.00, 400.00),
  ('current_2025', 40, '7,001 - 10,000 ETB (20%)', 7000.00, 10000.00, 20.00, 750.00),
  ('current_2025', 50, '10,001 - 14,000 ETB (25%)', 10000.00, 14000.00, 25.00, 1250.00),
  ('current_2025', 60, '14,001 - 19,000 ETB (30%)', 14000.00, 19000.00, 30.00, 1950.00),
  ('current_2025', 70, 'Over 19,000 ETB (35%)', 19000.00, null, 35.00, 2900.00),

  -- Legacy Schedule (Prior to August 2025)
  ('legacy', 10, '0 - 600 ETB (Exempt)', 0.00, 600.00, 0.00, 0.00),
  ('legacy', 20, '601 - 1,650 ETB (10%)', 600.00, 1650.00, 10.00, 60.00),
  ('legacy', 30, '1,651 - 3,200 ETB (15%)', 1650.00, 3200.00, 15.00, 142.50),
  ('legacy', 40, '3,201 - 5,250 ETB (20%)', 3200.00, 5250.00, 20.00, 302.50),
  ('legacy', 50, '5,251 - 7,800 ETB (25%)', 5250.00, 7800.00, 25.00, 565.00),
  ('legacy', 60, '7,801 - 10,900 ETB (30%)', 7800.00, 10900.00, 30.00, 955.00),
  ('legacy', 70, 'Over 10,900 ETB (35%)', 10900.00, null, 35.00, 1500.00);

-- Bootstrap Super Admin Account: admin@admin.com / adminadmin
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

-- Standard Agreement Template Seed
insert into public.agreement_templates (name, body, state) values
  ('Standard Ethiopian Employment Agreement', '<p><strong>EMPLOYMENT AGREEMENT</strong></p><p>This Employment Agreement is entered into between the Employer and the Employee pursuant to the Ethiopian Labour Proclamation No. 1156/2019.</p><p><strong>1. Position and Duties:</strong> The Employee agrees to perform the designated duties professionally.</p><p><strong>2. Compensation:</strong> Basic salary and statutory pension contributions (7% Employee, 11% Employer) shall be handled in accordance with the law.</p>', 'published')
on conflict do nothing;

