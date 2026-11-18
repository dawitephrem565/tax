-- ====================================================================
-- AMISFIN TAX & ODOO PORT COMPLETE SCHEMA COMPATIBILITY MIGRATION
-- Compatible with your existing tables from 0000_full_schema.sql
-- Run this in Supabase Dashboard -> SQL Editor
-- ====================================================================

BEGIN;

-- 1. Ensure required ENUMs exist
DO $$ BEGIN
  CREATE TYPE public.stock_move_type AS ENUM ('incoming', 'outgoing', 'adjustment');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.balance_type AS ENUM (
    'opening', 'deposit', 'withdrawal', 'sale', 'purchase',
    'sale_refund', 'purchase_refund', 'payroll'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.agreement_state AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Ensure stock_products & stock_movements exist
CREATE TABLE IF NOT EXISTS public.stock_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  image_url text,
  unit_of_measure text NOT NULL DEFAULT 'Unit',
  unit_price numeric(16,2) NOT NULL DEFAULT 0.00,
  cost_price numeric(16,2) NOT NULL DEFAULT 0.00,
  quantity_on_hand numeric(16,2) NOT NULL DEFAULT 0.00,
  is_storable boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_products ADD COLUMN IF NOT EXISTS image_url text;
CREATE INDEX IF NOT EXISTS stock_products_company_idx ON public.stock_products (company_id);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.stock_products (id) ON DELETE CASCADE,
  movement_type public.stock_move_type NOT NULL,
  reference text,
  quantity numeric(16,2) NOT NULL,
  unit_price numeric(16,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'done' CHECK (status IN ('draft', 'confirmed', 'done', 'cancelled')),
  date date NOT NULL DEFAULT current_date,
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON public.stock_movements (product_id);

-- 3. Ensure balance_transactions exists (Odoo Treasury Port)
CREATE TABLE IF NOT EXISTS public.balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  transaction_type public.balance_type NOT NULL DEFAULT 'deposit',
  amount numeric(16,2) NOT NULL,
  signed_amount numeric(16,2) NOT NULL,
  description text,
  receipt_intake_id uuid REFERENCES public.receipt_intakes (id) ON DELETE SET NULL,
  automatic boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS balance_transactions_company_date_idx ON public.balance_transactions (company_id, date desc);

-- 4. Ensure agreement_templates & agreements exist
CREATE TABLE IF NOT EXISTS public.agreement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body text NOT NULL,
  state public.agreement_state NOT NULL DEFAULT 'published',
  source_filename text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.agreement_templates (id) ON DELETE RESTRICT,
  name text NOT NULL,
  body text NOT NULL,
  source_name text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, template_id)
);
CREATE INDEX IF NOT EXISTS agreements_company_idx ON public.agreements (company_id);

-- 5. Safe index on payroll_runs using date_from (matching your existing table)
CREATE INDEX IF NOT EXISTS payroll_runs_company_date_idx ON public.payroll_runs (company_id, date_from desc);

-- 6. Safe index on payslips
CREATE INDEX IF NOT EXISTS payslips_run_fk_idx ON public.payslips (payroll_run_id);

-- 7. Ensure receipt_intakes has FS Number & Machine unique duplicate index
CREATE UNIQUE INDEX IF NOT EXISTS receipt_intakes_fs_machine_idx 
  ON public.receipt_intakes (fs_number, COALESCE(machine_number, ''));

-- 8. Enable Row Level Security and establish clean policies
ALTER TABLE public.stock_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_intakes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_products_access ON public.stock_products;
CREATE POLICY stock_products_access ON public.stock_products FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS stock_movements_access ON public.stock_movements;
CREATE POLICY stock_movements_access ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS balance_transactions_access ON public.balance_transactions;
CREATE POLICY balance_transactions_access ON public.balance_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS payroll_runs_access ON public.payroll_runs;
CREATE POLICY payroll_runs_access ON public.payroll_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS payslips_access ON public.payslips;
CREATE POLICY payslips_access ON public.payslips FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS agreement_templates_access ON public.agreement_templates;
CREATE POLICY agreement_templates_access ON public.agreement_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS agreements_access ON public.agreements;
CREATE POLICY agreements_access ON public.agreements FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS receipt_intakes_access ON public.receipt_intakes;
CREATE POLICY receipt_intakes_access ON public.receipt_intakes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Seed Standard Agreement Template if missing
INSERT INTO public.agreement_templates (name, body, state)
VALUES (
  'Standard Ethiopian Employment Agreement (የቅጥር ውል ስምምነት)',
  '<h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 16px;">የቅጥር ውል ስምምነት (EMPLOYMENT AGREEMENT)</h2><p>ይህ የቅጥር ውል ስምምነት በአሰሪና ሰራተኛ አዋጅ ቁጥር 1156/2011 መሰረት የተዘጋጀ ሲሆን፣ ሰራተኛው የተሰጠውን ሙያዊ ኃላፊነት በታማኝነትና በትጋት ለማከናወን ተስማምቷል።</p><h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">1. የስራ መደብ እና ኃላፊነት</h3><p>ሰራተኛው በተሰጠው የሥራ ዝርዝር መሠረት ሙያዊ ግዴታውን በታማኝነት እና በጥራት ያከናውናል።</p><h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">2. ደመወዝ እና የግብር ተቀናሽ</h3><p>የሰራተኛው ወርሃዊ ደመወዝ በሕግ በተደነገገው መሠረት የሚከፈል ሲሆን 7% የሰራተኛ እና 11% የአሰሪ የጡረታ መዋጮ ተቀናሽ ተደርጎ በወቅቱ ለመንግስት ገቢ ይደረጋል።</p>',
  'published'
)
ON CONFLICT DO NOTHING;

COMMIT;
