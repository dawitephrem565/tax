-- =============================================================================
-- 0004 — Receipt evidence, extracted detail lines, and core double-entry ledger
-- Idempotent: safe to re-run against a database that already has some columns.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. RECEIPT INTAKE: license scoping, tax treatment, evidence and OCR metadata
-- -----------------------------------------------------------------------------
alter table public.receipt_intakes
  add column if not exists license_id text,
  add column if not exists supply_type text,
  add column if not exists vat_treatment text,
  add column if not exists buyer_tin text,
  add column if not exists seller_tin text,
  add column if not exists calendar text,
  add column if not exists company_document_name text,
  add column if not exists cash_register_receipt_name text,
  add column if not exists raw_text text,
  add column if not exists total_extracted numeric(16,2),
  add column if not exists vat_extracted numeric(16,2),
  add column if not exists wht_suggested_rate numeric(5,2);

alter table public.balance_transactions
  add column if not exists license_id text;

create index if not exists receipt_intakes_license_idx
  on public.receipt_intakes (company_id, license_id, invoice_date);

-- -----------------------------------------------------------------------------
-- 2. EXTRACTED LINE ITEMS (what the OCR read off the document)
-- -----------------------------------------------------------------------------
create table if not exists public.receipt_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  receipt_id uuid not null references public.receipt_intakes (id) on delete cascade,
  license_id text,
  line_no integer not null default 1,
  description text not null,
  quantity numeric(14,3),
  unit_price numeric(16,2),
  untaxed_amount numeric(16,2) not null default 0,
  vat_amount numeric(16,2) not null default 0,
  total_amount numeric(16,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists receipt_lines_receipt_idx on public.receipt_lines (receipt_id);

-- -----------------------------------------------------------------------------
-- 3. CHART OF ACCOUNTS
-- -----------------------------------------------------------------------------
create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'income', 'expense')),
  subtype text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

-- -----------------------------------------------------------------------------
-- 4. JOURNAL ENTRIES (double entry, one entry per receipt / manual posting)
-- -----------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  license_id text,
  entry_date date not null,
  reference text,
  description text,
  source text not null default 'manual',
  source_id uuid,
  status text not null default 'posted' check (status in ('draft', 'posted', 'void')),
  total_debit numeric(16,2) not null default 0,
  total_credit numeric(16,2) not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, source, source_id)
);
create index if not exists journal_entries_company_date_idx
  on public.journal_entries (company_id, entry_date);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  account_id uuid not null references public.ledger_accounts (id),
  description text,
  partner_name text,
  debit numeric(16,2) not null default 0,
  credit numeric(16,2) not null default 0,
  constraint journal_lines_non_negative check (debit >= 0 and credit >= 0),
  constraint journal_lines_single_sided check (debit = 0 or credit = 0)
);
create index if not exists journal_lines_entry_idx on public.journal_lines (entry_id);
create index if not exists journal_lines_account_idx on public.journal_lines (account_id);

-- A deferred constraint trigger so an entry is validated once all lines are in.
create or replace function public.check_journal_balanced()
returns trigger language plpgsql as $$
declare
  dr numeric;
  cr numeric;
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into dr, cr
    from public.journal_lines
   where entry_id = new.entry_id;

  if round(dr, 2) <> round(cr, 2) then
    raise exception 'Journal entry % is not balanced (debit %, credit %)', new.entry_id, dr, cr;
  end if;
  return new;
end;
$$;

drop trigger if exists journal_lines_balanced on public.journal_lines;
create constraint trigger journal_lines_balanced
  after insert or update on public.journal_lines
  deferrable initially deferred
  for each row execute function public.check_journal_balanced();

-- -----------------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.receipt_lines enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

drop policy if exists receipt_lines_select on public.receipt_lines;
create policy receipt_lines_select on public.receipt_lines for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));

drop policy if exists receipt_lines_write on public.receipt_lines;
create policy receipt_lines_write on public.receipt_lines for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]));

drop policy if exists ledger_accounts_select on public.ledger_accounts;
create policy ledger_accounts_select on public.ledger_accounts for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));

drop policy if exists ledger_accounts_write on public.ledger_accounts;
create policy ledger_accounts_write on public.ledger_accounts for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]));

drop policy if exists journal_entries_select on public.journal_entries;
create policy journal_entries_select on public.journal_entries for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));

drop policy if exists journal_entries_write on public.journal_entries;
create policy journal_entries_write on public.journal_entries for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]));

drop policy if exists journal_lines_select on public.journal_lines;
create policy journal_lines_select on public.journal_lines for select to authenticated
  using (public.is_platform_admin() or company_id in (select public.my_company_ids()));

drop policy if exists journal_lines_write on public.journal_lines;
create policy journal_lines_write on public.journal_lines for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['company_admin', 'accountant']::public.company_role[]));
