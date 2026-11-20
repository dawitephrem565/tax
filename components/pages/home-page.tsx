'use client';

import { useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Briefcase,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  FileText,
  Flag,
  Gauge,
  Gift,
  Landmark,
  LayoutDashboard,
  LineChart,
  Lock,
  LogOut,
  Mail,
  PiggyBank,
  PlayCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (page: any) => void;
  isLoggedIn: boolean;
  userName?: string;
  onLogout?: () => void;
}

const fmt = (value: number) => Math.round(value).toLocaleString('en-US');

const NAV_LINKS = [
  { label: 'Features', href: '#features-matrix', active: true },
  { label: 'Tax & Compliance', href: '#salary-calculator' },
  { label: 'Live Monitoring', href: '#cockpit' },
  { label: 'Stock & Ledger', href: '#features-matrix' },
  { label: "Founder's Story", href: '#founder-spotlight' },
  { label: 'Pricing', href: '#referrals' },
];

function computeEthTax(monthlyTaxable: number) {
  if (monthlyTaxable <= 600) return 0;
  if (monthlyTaxable <= 1650) return monthlyTaxable * 0.1 - 60;
  if (monthlyTaxable <= 3200) return monthlyTaxable * 0.15 - 142.5;
  if (monthlyTaxable <= 5250) return monthlyTaxable * 0.2 - 302.5;
  if (monthlyTaxable <= 7800) return monthlyTaxable * 0.25 - 565;
  if (monthlyTaxable <= 10900) return monthlyTaxable * 0.3 - 955;
  return monthlyTaxable * 0.35 - 1500;
}

function initialsOf(name?: string) {
  if (!name) return 'AM';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AM';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function LandingHeader({
  isLoggedIn,
  userName,
  onNavigate,
  onLogout,
  onOpenTour,
}: {
  isLoggedIn: boolean;
  userName?: string;
  onNavigate: (page: any) => void;
  onLogout?: () => void;
  onOpenTour: () => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full bg-lp-surface/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-left transition-opacity hover:opacity-90"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-lp-primary to-lp-secondary text-white shadow-sm">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="font-lp-display text-lg font-semibold tracking-tight text-lp-on-surface">
              AMIS Financial
            </span>
          </button>
        </div>

        <nav className="hidden items-center gap-6 xl:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={
                link.active
                  ? 'text-sm font-semibold text-lp-primary'
                  : 'text-sm font-medium text-lp-on-surface-variant transition-colors hover:text-lp-on-surface'
              }
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full bg-lp-surface-container px-2.5 py-1 sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lp-secondary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-lp-secondary">
              SOC-2 Live
            </span>
          </div>

          <button
            onClick={onOpenTour}
            className="hidden rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-lp-on-surface shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all hover:bg-lp-surface-container sm:block"
          >
            Book Demo
          </button>

          {isLoggedIn ? (
            <>
              <button
                onClick={() => onNavigate('dashboard')}
                className="flex items-center gap-1.5 rounded-lg bg-lp-primary px-4 py-2 text-sm font-medium text-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all hover:bg-lp-primary-container"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Open Workspace</span>
                <span className="sm:hidden">Workspace</span>
              </button>
              <div className="flex items-center gap-1.5 pl-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lp-surface-high text-[11px] font-bold text-lp-primary ring-2 ring-lp-surface-container">
                  {initialsOf(userName)}
                </span>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Sign out"
                    className="rounded-lg p-2 text-lp-on-surface-variant transition-colors hover:bg-lp-surface-container hover:text-lp-error"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={() => onNavigate('reportTax')}
              className="rounded-lg bg-lp-primary px-4 py-2 text-sm font-medium text-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all hover:bg-lp-primary-container"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero({
  isLoggedIn,
  userName,
  onNavigate,
  onOpenTour,
}: {
  isLoggedIn: boolean;
  userName?: string;
  onNavigate: (page: any) => void;
  onOpenTour: () => void;
}) {
  const firstName = userName?.trim().split(/\s+/)[0];

  return (
    <div className="relative w-full overflow-hidden">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[320px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-b from-lp-primary-fixed/30 via-lp-secondary-container/20 to-transparent blur-3xl" />

      <section className="relative mx-auto w-full max-w-[1440px] px-4 pb-16 pt-12 sm:px-8 lg:px-12 lg:pb-24 lg:pt-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center space-y-6 text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-lp-surface-high px-3 py-1.5 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lp-secondary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-lp-secondary" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-lp-on-surface">
              Autonomous Ledger 4.0 Active
            </span>
            <span className="text-lp-outline-variant">•</span>
            <span className="text-[11px] font-medium text-lp-primary">
              {isLoggedIn && firstName ? `Welcome back, ${firstName}` : 'Dual AI + Human CPA Engine'}
            </span>
          </div>

          <h1 className="font-lp-display text-4xl font-bold tracking-tight text-lp-on-surface sm:text-5xl lg:text-[48px] lg:leading-[56px]">
            Delegate Your Finances &amp; Taxes.
            <br className="hidden sm:inline" />{' '}
            <span className="bg-gradient-to-r from-lp-primary via-lp-primary-container to-lp-secondary bg-clip-text text-transparent">
              Take a Rest and Lead Freely.
            </span>
          </h1>

          <p className="max-w-2xl text-base leading-relaxed text-lp-on-surface-variant sm:text-[17px]">
            AMIS Financial fuses autonomous predictive fiscal infrastructure with dedicated certified
            accountants and assigned sub-accountants. Hand over continuous tax provisioning, live
            inventory valuation, and multi-entity reconciliation in one high-precision platform.
          </p>

          <div className="flex w-full max-w-md flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
            <button
              onClick={() => onNavigate(isLoggedIn ? 'dashboard' : 'reportTax')}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-lp-primary to-lp-secondary px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 sm:w-auto"
            >
              <span>{isLoggedIn ? 'Open Your Workspace' : 'Login to Your Workspace'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={onOpenTour}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3.5 text-sm font-semibold text-lp-on-surface shadow-sm transition-all hover:bg-lp-surface-container sm:w-auto"
            >
              <PlayCircle className="h-5 w-5 text-lp-primary" />
              <span>Watch 2-Min Interactive Tour</span>
            </button>
          </div>

          {!isLoggedIn && (
            <button
              onClick={() => onNavigate('reportTax')}
              className="text-xs font-medium text-lp-primary underline-offset-4 hover:underline"
            >
              New company? Register your business and get a workspace
            </button>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 text-[11px] font-semibold text-lp-on-surface-variant">
            <div className="flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-lp-secondary" />
              <span>Over 140B ETB Assets Under Management</span>
            </div>
            <span className="hidden text-lp-outline-variant sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-lp-primary" />
              <span>SOC-2 Type II Certified Vault</span>
            </div>
            <span className="hidden text-lp-outline-variant sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-lp-secondary" />
              <span>99.98% On-Time Tax Guarantee</span>
            </div>
          </div>
        </div>

        {/* Quick snapshot visual grid */}
        <div className="mt-12 grid grid-cols-1 items-center gap-6 md:grid-cols-12">
          <div className="overflow-hidden rounded-xl bg-white p-2 shadow-sm md:col-span-4">
            <div className="relative h-44 overflow-hidden rounded-lg bg-gradient-to-br from-lp-primary via-lp-primary-container to-lp-secondary p-4">
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-lp-secondary-container/30 blur-xl" />
              <div className="relative flex h-full flex-col justify-between text-white">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-lp-secondary-container" />
                    Live Desk
                  </span>
                  <Users className="h-4 w-4 text-white/80" />
                </div>
                <div className="space-y-2">
                  <div className="rounded-lg bg-white/15 p-2.5 backdrop-blur-sm">
                    <p className="text-[11px] font-semibold">Lead CPA review queued</p>
                    <p className="mt-0.5 text-[10px] text-white/80">
                      VAT return reconciled against your receipt register.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-[9px] font-bold">
                      MC
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-[9px] font-bold">
                      MA
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-[9px] font-bold">
                      +3
                    </span>
                    <span className="text-[10px] font-medium text-white/80">CPAs online</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-lp-on-surface-variant">
                  Human Advisory Desk
                </span>
                <span className="text-[11px] font-semibold text-lp-secondary">14m response</span>
              </div>
              <p className="mt-1 text-xs font-medium text-lp-on-surface">
                Assigned Lead CPA: Marcus Chen, Senior Tax Fellow
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl bg-lp-surface-high p-6 text-center shadow-sm md:col-span-4">
            <Activity className="mb-2 h-7 w-7 text-lp-primary" />
            <span className="font-lp-display text-3xl font-bold tracking-tight text-lp-on-surface">
              Zero-Touch
            </span>
            <span className="mt-1 text-xs font-medium text-lp-on-surface-variant">
              94% of ledgers reconcile with zero manual human keystrokes required.
            </span>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-lp-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-lp-secondary" /> 0 Penalty Penalties Incurred
              2024
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-white p-2 shadow-sm md:col-span-4">
            <div className="relative h-44 overflow-hidden rounded-lg bg-gradient-to-br from-lp-secondary via-lp-secondary to-lp-primary-container p-4">
              <div className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full bg-white/15 blur-xl" />
              <div className="pointer-events-none absolute -bottom-8 -right-6 h-24 w-24 rounded-full bg-lp-secondary-container/30 blur-xl" />
              <div className="relative flex h-full flex-col justify-between text-white">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-lp-secondary-container" />
                    Bank Sync
                  </span>
                  <Landmark className="h-4 w-4 text-white/80" />
                </div>
                <div className="space-y-1.5">
                  {['CBE settlement cleared', 'Telebirr payout matched', 'Awash bank feed synced'].map(
                    (row) => (
                      <div
                        key={row}
                        className="flex items-center justify-between rounded-md bg-white/15 px-2 py-1.5 text-[10px] font-medium backdrop-blur-sm"
                      >
                        <span>{row}</span>
                        <Check className="h-3 w-3 text-lp-secondary-container" />
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-lp-on-surface-variant">
                  Continuous Audit
                </span>
                <span className="text-[11px] font-semibold text-lp-primary">Real-time sync</span>
              </div>
              <p className="mt-1 text-xs font-medium text-lp-on-surface">
                Connected to 110+ Global Banks &amp; Merchant Clearings
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Five Pillars feature matrix                                         */
/* ------------------------------------------------------------------ */

type Pillar = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  subtitle: string;
  badge: string;
  panelTitle: string;
  description: string;
  cards: { title: string; body: string }[];
  status: string;
  statusLabel: string;
};

const PILLARS: Pillar[] = [
  {
    icon: Calculator,
    title: '1. All-in-One Autonomous Tax Engine',
    subtitle: 'Annual filings, dynamic income reserves, radar',
    badge: 'Continuous Compliance',
    panelTitle: 'Autonomous Tax Architecture',
    description:
      'Never experience fiscal year-end stress or quarterly surprises again. AMIS Financial computes real-time corporate, municipal, and national tax liabilities on every incoming settlement or bank transfer — in Ethiopian Birr.',
    cards: [
      {
        title: 'Zero-Penalty Guarantee',
        body: 'Every schedule is double-checked by AI parity audits and countersigned by our registered institutional CPAs.',
      },
      {
        title: 'Withholding & VAT Router',
        body: '15% VAT, 2% goods withholding and 3% service withholding are classified automatically from every receipt you register.',
      },
    ],
    status:
      'Statutory Tax & Corporate Withholding auto-filed via Direct Electronic Gateway',
    statusLabel: 'Automated',
  },
  {
    icon: Activity,
    title: '2. Live Daily Sales & Purchase Feed',
    subtitle: 'Push alerts, margin drift, fraud anomaly checks',
    badge: 'Sub-Second Radar',
    panelTitle: 'Live Daily & Weekly Monitoring',
    description:
      'AMIS Financial detects revenue anomalies, unexpected charge spikes, subscription churn dips, and silent fee creep before your month closes.',
    cards: [
      {
        title: 'Instant Slack & SMS Broadcasts',
        body: 'Receive daily summaries and high-priority anomalies straight to your executive channel.',
      },
      {
        title: 'Micro-Margin Diagnostics',
        body: 'Track gross margin drift down to specific enterprise accounts and vendor contracts.',
      },
    ],
    status:
      'Anomaly alert triggered: Duplicate vendor bill detected on invoice #9019',
    statusLabel: 'Blocked',
  },
  {
    icon: Boxes,
    title: '3. Stock & Inventory Valuation',
    subtitle: 'FIFO/LIFO automated ledger & supply sync',
    badge: 'Supply & COGS',
    panelTitle: 'Stock & Inventory Ledger Engine',
    description:
      'High-velocity hardware and physical goods businesses gain instant balance sheet accuracy with automated FIFO, LIFO, and weighted average cost calculations in Ethiopian Birr.',
    cards: [
      {
        title: 'Direct ERP & Warehouse Sync',
        body: 'Continuous reconciliation with enterprise ERPs, warehouse hubs, and supply endpoints.',
      },
      {
        title: 'Landed Cost Provisioning',
        body: 'Includes sea freight, customs tariffs, and local drayage dynamically into unit valuations.',
      },
    ],
    status:
      'Live SKU Valuations: 12,410 Units mapped across 3 Global Warehouses',
    statusLabel: 'Synced',
  },
  {
    icon: FileText,
    title: '4. One-Click Legal & Agreement Hub',
    subtitle: 'Instant contracts, e-signatures & print renders',
    badge: 'Instant Execution',
    panelTitle: 'One-Click Legal & Agreement Hub',
    description:
      'Bridge your financial contracts directly to your cash ledger. Generate advisory agreements, contractor MSAs, equity grant paperwork, and board approvals in 60 seconds.',
    cards: [
      {
        title: 'Built-in Audit Trail & e-Sign',
        body: 'Legally binding compliant signatures linked directly to vendor payment terms.',
      },
      {
        title: 'Print-Ready PDF Renders',
        body: 'Generate institutional, board-ready, bank-sanctioned financial documentation with 1 click.',
      },
    ],
    status:
      'Standard Master Services Agreement rendered & signed via AMIS Vault',
    statusLabel: 'Executed',
  },
  {
    icon: Users,
    title: '5. Dedicated Human CPA + AI Co-pilot',
    subtitle: 'Senior CPA + sub-accountants on Slack & App',
    badge: 'Human In The Loop',
    panelTitle: 'Elite CPA & Sub-Accountant Squad',
    description:
      'AI runs the heavy calculation rails; your dedicated certified accountant and assigned junior sub-accountants handle strategic advisory, audit defensibility, and board slides.',
    cards: [
      {
        title: 'Shared Dedicated Slack Channel',
        body: 'Direct access to human controllers who know your cap table, past pivots, and strategic goals.',
      },
      {
        title: 'Continuous Monthly Close',
        body: 'Books are finalized by the 3rd business day of each calendar month, without end-of-quarter delays.',
      },
    ],
    status:
      'Lead CPA Marcus: "Verified Series A dilution scenario on cap table row 12."',
    statusLabel: 'Standby',
  },
];

function PillarsMatrix({ onNavigate }: { onNavigate: (page: any) => void }) {
  const [active, setActive] = useState(0);
  const pillar = PILLARS[active];
  const PanelIcon = pillar.icon;

  return (
    <section
      id="features-matrix"
      className="mx-auto w-full max-w-[1440px] scroll-mt-20 px-4 py-20 sm:px-8 lg:px-12"
    >
      <div className="mb-12 max-w-3xl">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-lp-primary">
          Institutional Feature Matrix
        </span>
        <h2 className="mt-1 font-lp-display text-3xl font-semibold tracking-tight text-lp-on-surface">
          Five Pillars of Total Financial Autonomy
        </h2>
        <p className="mt-2 text-base text-lp-on-surface-variant">
          Click each module to inspect our algorithmic workflows and human escalation loops.
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex flex-col gap-2 rounded-xl bg-lp-surface-low p-1.5 lg:w-1/3">
          {PILLARS.map((item, index) => {
            const Icon = item.icon;
            const isActive = index === active;
            return (
              <button
                key={item.title}
                onClick={() => setActive(index)}
                className={`flex items-start gap-3 rounded-lg p-4 text-left transition-all ${
                  isActive
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-white/60'
                }`}
              >
                <Icon
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    isActive ? 'text-lp-primary' : 'text-lp-on-surface-variant'
                  }`}
                />
                <div>
                  <p className="text-sm font-semibold text-lp-on-surface">{item.title}</p>
                  <p className="mt-0.5 text-xs text-lp-on-surface-variant">{item.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-white p-6 shadow-md lg:w-2/3 lg:p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4">
              <div>
                <span className="rounded-full bg-lp-secondary-fixed px-2.5 py-1 text-[11px] font-semibold text-lp-on-secondary-fixed">
                  {pillar.badge}
                </span>
                <h3 className="mt-2 font-lp-display text-2xl font-bold text-lp-on-surface">
                  {pillar.panelTitle}
                </h3>
              </div>
              <PanelIcon className="h-9 w-9 text-lp-primary" />
            </div>

            <p className="text-base leading-relaxed text-lp-on-surface-variant">
              {pillar.description}
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {pillar.cards.map((card) => (
                <div key={card.title} className="rounded-lg bg-lp-surface-low p-4">
                  <span className="mb-1 block text-sm font-semibold text-lp-on-surface">
                    {card.title}
                  </span>
                  <p className="text-xs text-lp-on-surface-variant">{card.body}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-lp-surface-high p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-lp-secondary" />
                <span className="text-xs font-medium text-lp-on-surface">{pillar.status}</span>
              </div>
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-lp-secondary">
                {pillar.statusLabel}
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-lp-outline-variant/30 pt-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-lp-secondary" />
              <span className="text-[11px] text-lp-on-surface-variant">
                Seamless setup: integrates with CBE, Telebirr, Awash, Commercial Clearings &amp; Global
                Banks in 5 mins
              </span>
            </div>
            <button
              onClick={() => onNavigate('reportTax')}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-lp-primary px-5 py-2.5 text-sm font-medium text-white shadow transition-all hover:bg-lp-primary-container"
            >
              Deploy This Workflow
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Salary tax calculator                                               */
/* ------------------------------------------------------------------ */

function SalaryCalculator({ onNavigate }: { onNavigate: (page: any) => void }) {
  const [mode, setMode] = useState<'monthly' | 'annual'>('monthly');
  const [gross, setGross] = useState(45000);
  const [jurisdiction, setJurisdiction] = useState('STD');
  const [employment, setEmployment] = useState<'standard' | 'executive'>('standard');
  const [pensionPct, setPensionPct] = useState(7);

  const switchMode = (next: 'monthly' | 'annual') => {
    if (next === mode) return;
    setGross(next === 'monthly' ? Math.max(5000, Math.round(gross / 12)) : Math.round(gross * 12));
    setMode(next);
  };

  const grossMonthly = mode === 'monthly' ? gross : gross / 12;
  const pension = Math.round(grossMonthly * (pensionPct / 100));
  const taxable = Math.max(0, grossMonthly - pension);

  let monthlyTax = 0;
  if (jurisdiction === 'CONS') monthlyTax = grossMonthly * 0.3;
  else if (jurisdiction === 'EXP') monthlyTax = taxable * 0.28;
  else if (jurisdiction === 'SEZ') monthlyTax = computeEthTax(taxable) * 0.65;
  else monthlyTax = computeEthTax(taxable);
  if (employment === 'executive') monthlyTax *= 1.05;
  monthlyTax = Math.round(monthlyTax);

  const net = Math.max(0, Math.round(grossMonthly - monthlyTax - pension));
  const annualNet = net * 12;
  const annualTax = monthlyTax * 12;
  const yieldPct = grossMonthly > 0 ? ((net / grossMonthly) * 100).toFixed(1) : '0';
  const employerPension = Math.round(grossMonthly * 0.11);

  const sliderMin = mode === 'monthly' ? 5000 : 60000;
  const sliderMax = mode === 'monthly' ? 200000 : 2400000;
  const sliderStep = mode === 'monthly' ? 1000 : 10000;

  return (
    <section
      id="salary-calculator"
      className="w-full scroll-mt-20 border-y border-lp-outline-variant/30 bg-white py-16"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <div className="mb-3 inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-[#e0f2fe] px-3 py-1 text-[11px] font-semibold text-[#0284c7]">
            <Calculator className="h-3.5 w-3.5" />
            <span>Real-Time AI Tax Engine</span>
            <span className="text-lp-outline-variant">•</span>
            <span className="text-[#059669]">Government Compliance Verified (ETB)</span>
          </div>
          <h2 className="font-lp-display text-3xl font-bold tracking-tight text-lp-on-surface sm:text-4xl">
            Check Your Salary Tax &amp; Monthly Earnings
          </h2>
          <p className="mt-2 text-base text-lp-on-surface-variant">
            AI-powered real-time tax, pension &amp; net earnings calculator calibrated in Ethiopian
            Birr for individuals &amp; enterprises. Instantly preview progressive tax brackets,
            pension reserves, and multi-year cumulative government tax impact.
          </p>
        </div>

        <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-lp-outline-variant/40 bg-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lp-outline-variant/30 bg-lp-surface-low px-6 py-3.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#10b981]" />
              <span className="font-semibold text-lp-on-surface">AMIS Fiscal Engine v4.8 (ETB)</span>
              <span className="rounded bg-[#e0f2fe] px-2 py-0.5 text-[11px] font-semibold text-[#0284c7]">
                Statutory Tax &amp; Pension Brackets
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-lp-on-surface-variant">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-[#0284c7]" /> Instant Real-Time Calculations
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-[#10b981]" /> Multi-Year Government Ledger
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="space-y-6 border-b border-lp-outline-variant/30 bg-lp-surface p-6 sm:p-8 lg:col-span-6 lg:border-b-0 lg:border-r">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="lp-gross"
                    className="text-sm font-semibold text-lp-on-surface"
                  >
                    Enter Gross Salary (Br)
                  </label>
                  <div className="inline-flex rounded-lg bg-lp-surface-high p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => switchMode('monthly')}
                      className={`rounded-md px-2.5 py-1 transition-all ${
                        mode === 'monthly'
                          ? 'bg-white text-lp-primary shadow-sm'
                          : 'text-lp-on-surface-variant hover:text-lp-on-surface'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('annual')}
                      className={`rounded-md px-2.5 py-1 transition-all ${
                        mode === 'annual'
                          ? 'bg-white text-lp-primary shadow-sm'
                          : 'text-lp-on-surface-variant hover:text-lp-on-surface'
                      }`}
                    >
                      Annual
                    </button>
                  </div>
                </div>

                <div className="relative mb-3 flex items-center">
                  <span className="absolute left-3.5 font-mono text-base font-bold text-lp-on-surface-variant">
                    Br
                  </span>
                  <input
                    id="lp-gross"
                    type="number"
                    min={sliderMin}
                    max={mode === 'monthly' ? 500000 : 6000000}
                    step={sliderStep}
                    value={gross}
                    onChange={(e) => setGross(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded-lg border border-lp-outline-variant/60 bg-white py-2.5 pl-11 pr-24 font-mono text-lg font-bold text-lp-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-lp-primary"
                  />
                  <span className="absolute right-3 rounded bg-[#e0f2fe] px-2 py-0.5 text-[11px] font-semibold text-lp-primary">
                    {mode === 'monthly' ? '/ month' : '/ year'}
                  </span>
                </div>

                <input
                  aria-label="Gross salary adjustment slider"
                  type="range"
                  min={sliderMin}
                  max={sliderMax}
                  step={sliderStep}
                  value={Math.min(Math.max(Number(gross) || sliderMin, sliderMin), sliderMax)}
                  onChange={(e) => setGross(Number(e.target.value))}
                  className="h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-lp-surface-high accent-lp-primary"
                />
                <div className="mt-1.5 flex justify-between font-mono text-[11px] text-lp-on-surface-variant">
                  <span>
                    {mode === 'monthly' ? '5,000 Br' : '60,000 Br'}
                  </span>
                  <span>
                    {mode === 'monthly' ? '100,000 Br' : '1,200,000 Br'}
                  </span>
                  <span>
                    {mode === 'monthly' ? '200,000+ Br' : '2,400,000+ Br'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="lp-jurisdiction"
                    className="mb-1.5 block text-sm font-semibold text-lp-on-surface"
                  >
                    Tax Jurisdiction / Schedule
                  </label>
                  <div className="relative">
                    <select
                      id="lp-jurisdiction"
                      value={jurisdiction}
                      onChange={(e) => setJurisdiction(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-lp-outline-variant/50 bg-white px-3.5 py-2.5 pr-9 text-sm font-medium text-lp-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-lp-primary"
                    >
                      <option value="STD">Ethiopian Progressive Schedule (0-35%)</option>
                      <option value="EXP">Executive / Expats Flat Provision</option>
                      <option value="CONS">Consultant / Contractor Withholding (30%)</option>
                      <option value="SEZ">Special Economic Zone Incentive Rate</option>
                    </select>
                    <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-lp-outline-variant" />
                  </div>
                </div>

                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-lp-on-surface">
                    Employment Category
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-lp-surface-low p-1">
                    <button
                      type="button"
                      onClick={() => setEmployment('standard')}
                      className={`rounded-md py-1.5 text-center text-[11px] font-semibold transition-all ${
                        employment === 'standard'
                          ? 'bg-white text-lp-on-surface shadow-sm'
                          : 'text-lp-on-surface-variant hover:text-lp-on-surface'
                      }`}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmployment('executive')}
                      className={`rounded-md py-1.5 text-center text-[11px] font-semibold transition-all ${
                        employment === 'executive'
                          ? 'bg-white text-lp-on-surface shadow-sm'
                          : 'text-lp-on-surface-variant hover:text-lp-on-surface'
                      }`}
                    >
                      Executive
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-lp-outline-variant/30 bg-lp-surface-low p-4">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="lp-pension"
                    className="flex items-center gap-1.5 text-sm font-semibold text-lp-on-surface"
                  >
                    <PiggyBank className="h-4 w-4 text-lp-primary" />
                    <span>Employee Pension Contribution (POESSA / Private)</span>
                  </label>
                  <span className="rounded border border-lp-outline-variant/40 bg-white px-2 py-0.5 font-mono text-sm font-bold text-lp-primary">
                    {pensionPct.toFixed(1)}%
                  </span>
                </div>
                <input
                  id="lp-pension"
                  aria-label="Pension contribution percentage"
                  type="range"
                  min={0}
                  max={15}
                  step={0.5}
                  value={pensionPct}
                  onChange={(e) => setPensionPct(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-lp-surface-highest accent-lp-secondary"
                />
                <div className="flex justify-between text-[11px] text-lp-on-surface-variant">
                  <span>0% (Exempt)</span>
                  <span>7% (Statutory Employee)</span>
                  <span>15% (Voluntary Scheme)</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-[#bae6fd] bg-[#e0f2fe]/60 p-3.5 text-xs leading-relaxed text-[#0369a1]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <span className="font-bold text-lp-on-surface">Automated Statutory Rule:</span>{' '}
                  Progressive employment income brackets (first 600 Br exempt up to the 35% tier) and
                  statutory pension deductions (7% employee + 11% employer) are computed in real-time
                  Ethiopian Birr.
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between space-y-6 bg-lp-surface-low/60 p-6 sm:p-8 lg:col-span-6">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#065f46] via-[#047857] to-[#059669] p-5 text-white shadow-md">
                <div className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 rounded-full bg-white/10 blur-xl" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
                    Net Take-Home Salary
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Real-Time Result
                  </span>
                </div>
                <div className="mt-2 flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
                  <div>
                    <span className="font-mono text-3xl font-extrabold tracking-tight sm:text-4xl">
                      {fmt(net)} Br
                    </span>
                    <span className="ml-1 text-xs font-medium text-emerald-100">/ month</span>
                  </div>
                  <div className="font-mono text-xs font-semibold text-emerald-100 sm:text-sm">
                    <span>{fmt(annualNet)} Br</span> / year
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-emerald-500/40 pt-2 text-xs text-emerald-100">
                  <span>
                    Effective Take-Home Yield: <strong className="text-white">{yieldPct}%</strong>
                  </span>
                  <span>
                    Gross Monthly: <strong className="text-white">{fmt(grossMonthly)} Br</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div className="rounded-xl border border-lp-outline-variant/30 bg-white p-3.5 shadow-sm">
                  <span className="block text-[11px] text-lp-on-surface-variant">Gov Income Tax</span>
                  <span className="mt-0.5 block font-mono text-lg font-bold text-lp-error">
                    -{fmt(monthlyTax)} Br/mo
                  </span>
                  <span className="font-mono text-[10px] text-lp-on-surface-variant">
                    {fmt(annualTax)} Br/yr
                  </span>
                </div>
                <div className="rounded-xl border border-lp-outline-variant/30 bg-white p-3.5 shadow-sm">
                  <span className="block text-[11px] text-lp-on-surface-variant">
                    Employee Pension
                  </span>
                  <span className="mt-0.5 block font-mono text-lg font-bold text-[#0284c7]">
                    -{fmt(pension)} Br/mo
                  </span>
                  <span className="font-mono text-[10px] text-lp-on-surface-variant">
                    {fmt(pension * 12)} Br/yr saved
                  </span>
                </div>
                <div className="rounded-xl border border-lp-outline-variant/30 bg-white p-3.5 shadow-sm">
                  <span className="block text-[11px] text-lp-on-surface-variant">
                    Employer Pension (11%)
                  </span>
                  <span className="mt-0.5 block font-mono text-lg font-bold text-lp-secondary">
                    +{fmt(employerPension)} Br/mo
                  </span>
                  <span className="font-mono text-[10px] text-lp-on-surface-variant">
                    11% company funded
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-lp-outline-variant/40 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-lp-outline-variant/30 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Landmark className="h-4 w-4 text-lp-primary" />
                    <span className="text-xs font-bold text-lp-on-surface">
                      Government Tax Impact Over Time
                    </span>
                  </div>
                  <span className="rounded bg-[#e0f2fe] px-2 py-0.5 text-[11px] font-semibold text-[#0284c7]">
                    Statutory Cumulative (ETB)
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-3 text-center">
                  {[
                    { label: 'Month 1', tax: monthlyTax, net: net, hint: 'Single Month Tax' },
                    { label: '1 Year', tax: annualTax, net: annualNet, hint: `+${fmt(annualNet / 1000)}k Br net` },
                    { label: '2 Years', tax: annualTax * 2, net: annualNet * 2, hint: `+${fmt((annualNet * 2) / 1000)}k Br net` },
                    { label: '3 Years', tax: annualTax * 3, net: annualNet * 3, hint: `+${fmt((annualNet * 3) / 1000)}k Br net` },
                  ].map((item, index) => (
                    <div
                      key={item.label}
                      className={`flex flex-col justify-between rounded-lg p-2 ${
                        index === 3
                          ? 'border border-[#bae6fd] bg-[#e0f2fe]/40'
                          : index === 2
                            ? 'border border-lp-outline-variant/30 bg-lp-surface-low'
                            : 'bg-lp-surface-low'
                      }`}
                    >
                      <span className="text-[11px] font-semibold text-lp-on-surface-variant">
                        {item.label}
                      </span>
                      <span className="mt-1 font-mono text-sm font-bold text-lp-error">
                        {fmt(item.tax)} Br
                      </span>
                      <span
                        className={`mt-0.5 font-mono text-[10px] ${
                          index === 0 ? 'text-lp-on-surface-variant' : 'text-[#059669]'
                        }`}
                      >
                        {item.hint}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-center text-[11px] text-lp-on-surface-variant">
                  AMIS Financial automated tax optimization preserves an estimated{' '}
                  <span className="font-bold text-[#059669]">{fmt(pension * 0.35 * 3)} Br</span> over 3
                  years via progressive shelter.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row">
                <button
                  onClick={() => onNavigate('reportTax')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-lp-primary px-4 py-3 text-sm font-semibold text-white shadow transition-all hover:bg-lp-primary-container sm:flex-1"
                >
                  <LineChart className="h-4 w-4" />
                  <span>Download Full Paycheck Tax Report (ETB)</span>
                </button>
                <button
                  onClick={() => onNavigate('findInfo')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-lp-outline-variant/60 bg-white px-4 py-3 text-sm font-semibold text-lp-on-surface shadow-sm transition-all hover:bg-lp-surface-container sm:w-auto"
                >
                  <Briefcase className="h-4 w-4 text-lp-primary" />
                  <span>Consult CPA Advisor</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Cockpit simulator                                                   */
/* ------------------------------------------------------------------ */

const SCENARIOS = {
  growth: {
    burn: '4,285,000 Br',
    runway: '26.4 mo',
    tax: '1,840,000 Br',
    margin: '+24.8%',
    burnNote: '-4.2% vs previous 30d',
    marginNote: '+3.1% after COGS optimization',
  },
  bootstrapped: {
    burn: '1,420,000 Br',
    runway: '48.1 mo',
    tax: '625,000 Br',
    margin: '+41.2%',
    burnNote: '-6.8% vs previous 30d',
    marginNote: '+7.4% after procurement savings',
  },
} as const;

function Cockpit() {
  const [scenario, setScenario] = useState<'growth' | 'bootstrapped'>('growth');
  const metrics = SCENARIOS[scenario];

  return (
    <section id="cockpit" className="w-full scroll-mt-20 bg-lp-surface-low py-16">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-lp-primary">
                Interactive Cockpit
              </span>
              <span className="rounded-full bg-lp-secondary-fixed px-2 py-0.5 text-[11px] font-semibold text-lp-on-secondary-fixed">
                Live Sandbox
              </span>
            </div>
            <h2 className="mt-1 font-lp-display text-3xl font-semibold tracking-tight text-lp-on-surface">
              Experience the AMIS Financial Command Engine
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white p-1 shadow-sm">
            <button
              onClick={() => setScenario('growth')}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-all ${
                scenario === 'growth'
                  ? 'bg-lp-primary text-white'
                  : 'text-lp-on-surface-variant hover:text-lp-on-surface'
              }`}
            >
              Series A Scale
            </button>
            <button
              onClick={() => setScenario('bootstrapped')}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-all ${
                scenario === 'bootstrapped'
                  ? 'bg-lp-primary text-white'
                  : 'text-lp-on-surface-variant hover:text-lp-on-surface'
              }`}
            >
              SaaS Cashflow Mode
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-md lg:p-8">
          <div className="grid grid-cols-1 gap-4 pb-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <div className="flex flex-col justify-between rounded-lg bg-lp-surface-low p-4">
              <div className="flex items-center justify-between text-[11px] font-semibold text-lp-on-surface-variant">
                <span>Monthly Burn</span>
                <TrendingUp className="h-4 w-4" />
              </div>
              <span className="my-2 font-lp-display text-2xl font-bold text-lp-on-surface">
                {metrics.burn}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-lp-secondary">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{metrics.burnNote}</span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-lg bg-lp-surface-low p-4">
              <div className="flex items-center justify-between text-[11px] font-semibold text-lp-on-surface-variant">
                <span>Cash Runway</span>
                <Gauge className="h-4 w-4" />
              </div>
              <span className="my-2 font-lp-display text-2xl font-bold text-lp-on-surface">
                {metrics.runway}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-lp-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Safe Buffer Zone (Target &gt; 18m)</span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-lg bg-lp-surface-low p-4">
              <div className="flex items-center justify-between text-[11px] font-semibold text-lp-on-surface-variant">
                <span>Tax Liability Reserve</span>
                <Landmark className="h-4 w-4" />
              </div>
              <span className="my-2 font-lp-display text-2xl font-bold text-lp-on-surface">
                {metrics.tax}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-lp-secondary">
                <Lock className="h-3.5 w-3.5" />
                <span>100% Segregated &amp; Locked</span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-lg bg-lp-surface-low p-4">
              <div className="flex items-center justify-between text-[11px] font-semibold text-lp-on-surface-variant">
                <span>Real-Time Net Margin</span>
                <LineChart className="h-4 w-4" />
              </div>
              <span className="my-2 font-lp-display text-2xl font-bold text-lp-on-surface">
                {metrics.margin}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-lp-secondary">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{metrics.marginNote}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-12 lg:gap-6">
            <div className="rounded-xl bg-lp-surface-low p-5 lg:col-span-7">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-lp-secondary" />
                  <span className="font-lp-display text-xl font-semibold text-lp-on-surface">
                    Sub-Second Stream
                  </span>
                </div>
                <span className="text-[11px] text-lp-on-surface-variant">
                  Autonomous Auto-Categorization
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-lp-secondary-fixed text-[10px] font-bold text-lp-on-secondary-fixed">
                      VAT
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-lp-on-surface">
                        Ministry of Revenue VAT Settlement
                      </p>
                      <p className="text-xs text-lp-on-surface-variant">
                        Monthly filing • Domestic sales &amp; purchases
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-lp-on-surface">-384,210 Br</p>
                    <span className="inline-flex items-center rounded bg-lp-surface-container px-2 py-0.5 text-[10px] font-semibold text-lp-primary">
                      Auto-Categorized
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-lp-primary-fixed text-[10px] font-bold text-lp-on-primary-fixed">
                      CBE
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-lp-on-surface">
                        Commercial Settlement Net Clearing
                      </p>
                      <p className="text-xs text-lp-on-surface-variant">
                        Enterprise MRR Batch • 48 Transactions
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-lp-secondary">+2,945,000 Br</p>
                    <span className="inline-flex items-center rounded bg-lp-secondary-container px-2 py-0.5 text-[10px] font-semibold text-lp-on-secondary-fixed">
                      Tax Provisioned (18%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-lp-surface-highest text-[10px] font-bold text-lp-on-surface">
                      PAY
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-lp-on-surface">
                        Monthly Staff Payroll Batch
                      </p>
                      <p className="text-xs text-lp-on-surface-variant">
                        Direct Deposit + Pension Auto-Escrow
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-lp-on-surface">-1,921,045 Br</p>
                    <span className="inline-flex items-center rounded bg-lp-surface-high px-2 py-0.5 text-[10px] font-semibold text-lp-on-surface-variant">
                      Audited by CPA
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-lp-outline-variant/30 pt-3 text-[11px] text-lp-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-lp-secondary" />
                  Algorithmic variance threshold: ±0.002%
                </span>
                <button className="flex items-center gap-1 font-semibold text-lp-primary hover:underline">
                  View 1,842 lines
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl bg-lp-surface-low p-5 lg:col-span-5">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-lp-display text-xl font-semibold text-lp-on-surface">
                    Compliance Radar
                  </span>
                  <span className="rounded bg-lp-secondary px-2 py-1 text-[10px] font-semibold text-white">
                    0 Delays
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lp-secondary-container text-xs font-bold text-lp-on-secondary-fixed">
                      1
                    </div>
                    <div className="flex-1 rounded-lg bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-lp-on-surface">
                          Monthly VAT &amp; Turnover Withholding
                        </span>
                        <span className="text-[11px] font-semibold text-lp-error">Due in 4 Days</span>
                      </div>
                      <p className="mt-1 text-xs text-lp-on-surface-variant">
                        National &amp; regional VAT calculations finalized. Prepared for electronic
                        sign-off.
                      </p>
                      <div className="mt-2">
                        <span className="rounded bg-lp-surface-container px-2 py-0.5 text-[10px] font-medium text-lp-secondary">
                          Ready for auto-filing
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lp-primary-fixed text-xs font-bold text-lp-on-primary-fixed">
                      2
                    </div>
                    <div className="flex-1 rounded-lg bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-lp-on-surface">
                          Q3 Corporate Income Tax Schedule
                        </span>
                        <span className="text-[11px] font-medium text-lp-on-surface-variant">
                          Scheduled: Oct 15
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-lp-on-surface-variant">
                        Safe-harbor reserve applied. Lead CPA verified deduction schedule.
                      </p>
                      <div className="mt-2">
                        <span className="rounded bg-lp-surface-container px-2 py-0.5 text-[10px] font-medium text-lp-primary">
                          1,840,000 Br reserve ready
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3 rounded-lg bg-white p-3 pt-4">
                <ShieldCheck className="h-6 w-6 text-lp-secondary" />
                <p className="text-xs text-lp-on-surface-variant">
                  <span className="font-semibold text-lp-on-surface">Zero-Penalty Guarantee:</span>{' '}
                  Any municipal or revenue authority penalty originating from our system will be
                  indemnified 100% by AMIS Financial.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Founder spotlight                                                   */
/* ------------------------------------------------------------------ */

function FounderSpotlight() {
  return (
    <section
      id="founder-spotlight"
      className="mx-auto w-full max-w-[1440px] scroll-mt-20 px-4 py-20 sm:px-8 lg:px-12"
    >
      <div className="relative overflow-hidden rounded-3xl border border-lp-outline-variant/30 bg-gradient-to-br from-lp-surface-low via-white to-lp-surface-high p-8 shadow-lg sm:p-12 lg:p-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-lp-primary-fixed/20 blur-3xl" />
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          <div className="flex justify-center lg:col-span-5">
            <div className="relative w-full max-w-md">
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-lp-primary to-lp-secondary opacity-20 blur-md" />
              <div className="relative rounded-2xl border border-lp-outline-variant/30 bg-white p-3 shadow-xl">
                <div className="relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-lp-primary via-lp-primary-container to-lp-secondary text-white shadow-inner">
                  <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-10 -right-6 h-36 w-36 rounded-full bg-lp-secondary-container/30 blur-2xl" />
                  <span className="font-lp-display text-6xl font-bold tracking-tight">AH</span>
                  <span className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-white/80">
                    Founder &amp; CEO
                  </span>
                </div>
                <div className="absolute -bottom-4 -right-4 flex items-center gap-2 rounded-xl border border-lp-outline-variant/40 bg-white px-4 py-2 shadow-lg">
                  <span className="h-2.5 w-2.5 rounded-full bg-lp-secondary" />
                  <span className="text-[11px] font-bold text-lp-on-surface">
                    Amira Hussen, Founder &amp; CEO, AMIS Financial
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-lp-surface-container px-3 py-1 text-[11px] font-semibold text-lp-primary">
              <Flag className="h-3.5 w-3.5" />
              <span>Founder&apos;s Personal Pledge</span>
            </div>

            <blockquote className="font-lp-display text-2xl font-bold leading-tight tracking-tight text-lp-on-surface sm:text-[32px] sm:leading-10">
              &quot;We built AMIS Financial with one conviction: people and businesses should thrive
              without drowning in tax codes and unexpected government withholdings. Rest easy knowing
              your salary and ledger are bulletproof.&quot;
            </blockquote>

            <div className="flex flex-col justify-between gap-4 border-t border-lp-outline-variant/30 pt-2 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-lp-display text-xl font-bold text-lp-on-surface">
                  Amira Hussen
                </h3>
                <p className="text-sm font-medium text-lp-on-surface-variant">
                  Founder &amp; CEO of AMIS Financial
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-lp-surface-highest px-3 py-1.5 text-[11px] font-semibold text-lp-on-surface shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-lp-primary" />
                  Ex-Fintech Lead, Stanford Alum
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-lp-secondary-fixed px-3 py-1.5 text-[11px] font-semibold text-lp-on-secondary-fixed shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5 text-lp-secondary" />
                  Dual-Guard AI &amp; Senior CPA oversight pledge
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */

const TESTIMONIALS = [
  {
    quote:
      'Before AMIS Financial, I was losing every final weekend of the month wrestling with spreadsheets and chasing payroll withholdings. With AMIS, taxes run autonomously in the background and our dedicated CPA is always online. It liberated over 35 hours a month.',
    name: 'Amira Hussen',
    role: 'Founder & CEO, AMIS Financial',
    initials: 'AH',
  },
  {
    quote:
      'The inventory valuation sync saved us during our Series B audit. Our lead CPA had every landed-cost schedule pre-formatted for audit clearance before they even asked. Flawless execution and zero friction.',
    name: 'David Vance',
    role: 'VP Finance & Operations, Lumina Hardware',
    initials: 'DV',
  },
  {
    quote:
      'The AMIS Financial Slack Co-pilot answers our complex multi-entity franchise tax questions in under 10 minutes. It feels like having a senior internal CFO on staff for a fraction of the cost.',
    name: 'Siddharth Nair',
    role: 'Founder & CTO, OrbitMesh Labs',
    initials: 'SN',
  },
];

function Testimonials() {
  return (
    <section className="w-full bg-lp-surface-low py-20">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-lp-secondary">
            Founder Testimonials
          </span>
          <h2 className="mt-1 font-lp-display text-3xl font-semibold tracking-tight text-lp-on-surface">
            30+ Hours Saved Every Single Month
          </h2>
          <p className="mt-2 text-base text-lp-on-surface-variant">
            Hear how enterprise scale founders freed their executive brainpower to build products and
            close deals.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <div
              key={item.name}
              className="flex flex-col justify-between rounded-xl bg-white p-6 shadow-sm"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-1 text-lp-secondary">
                  {[0, 1, 2, 3, 4].map((star) => (
                    <Star key={star} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm italic text-lp-on-surface">&quot;{item.quote}&quot;</p>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-lp-primary to-lp-secondary text-xs font-bold text-white shadow-sm">
                  {item.initials}
                </span>
                <div>
                  <p className="text-sm font-bold text-lp-on-surface">{item.name}</p>
                  <p className="text-xs text-lp-on-surface-variant">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Referral module                                                     */
/* ------------------------------------------------------------------ */

function ReferralModule() {
  const [email, setEmail] = useState('');
  const [invited, setInvited] = useState(false);
  const [copied, setCopied] = useState(false);

  const sendInvite = () => {
    if (!email.includes('@')) return;
    setInvited(true);
    setEmail('');
    window.setTimeout(() => setInvited(false), 3000);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText('https://amis-financial.io/ref/found-84920');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      id="referrals"
      className="mx-auto w-full max-w-[1440px] scroll-mt-20 px-4 py-20 sm:px-8 lg:px-12"
    >
      <div className="rounded-2xl bg-gradient-to-br from-lp-surface-high via-lp-surface-low to-white p-8 shadow-md lg:p-12">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-lp-secondary-fixed px-3 py-1 text-[11px] font-semibold text-lp-on-secondary-fixed">
              <Gift className="h-3.5 w-3.5" />
              <span>Founder Referral Protocol</span>
            </div>
            <h2 className="font-lp-display text-3xl font-bold text-lp-on-surface">
              Invite Co-founders or Portfolio Companies.
            </h2>
            <p className="max-w-xl text-base text-lp-on-surface-variant">
              Give founders the rest they deserve. Every venture or portfolio company you introduce
              gets an immediate 30-day extended audit buffer, and your account receives{' '}
              <span className="font-bold text-lp-on-surface">
                50,000 Br billing credit + instant tier upgrade
              </span>{' '}
              upon onboarding to AMIS Financial.
            </p>

            <div className="flex max-w-lg flex-col items-stretch gap-2 pt-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lp-outline" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@portfolio-ventures.com"
                  className="w-full rounded-lg bg-white py-3 pl-10 pr-4 text-sm text-lp-on-surface shadow-sm placeholder:text-lp-outline focus:outline-none focus:ring-2 focus:ring-lp-primary"
                />
              </div>
              <button
                onClick={sendInvite}
                className={`flex shrink-0 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium text-white shadow-sm transition-all ${
                  invited ? 'bg-lp-secondary' : 'bg-lp-primary hover:bg-lp-primary-container'
                }`}
              >
                <span>{invited ? 'Invited!' : 'Send Invite'}</span>
                {invited ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3">
              <div className="flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-[11px] text-lp-on-surface-variant shadow-sm">
                <Lock className="h-3.5 w-3.5 text-lp-secondary" />
                <span className="max-w-[220px] truncate font-mono sm:max-w-xs">
                  amis-financial.io/ref/found-84920
                </span>
              </div>
              <button
                onClick={copyLink}
                className="flex items-center gap-1 rounded-md bg-lp-surface-container px-3 py-1.5 text-[11px] font-semibold text-lp-on-surface transition-colors hover:bg-lp-surface-high"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          <div className="flex justify-center lg:col-span-5">
            <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-md">
              <div className="flex items-center justify-between pb-3">
                <span className="text-sm font-bold text-lp-on-surface">Your Referral Ledger</span>
                <span className="rounded bg-lp-secondary-fixed px-2 py-0.5 text-[11px] font-semibold text-lp-on-secondary-fixed">
                  Tier 2 Active
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-lp-on-surface-variant">Credits Earned</span>
                  <span className="font-semibold text-lp-secondary">150,000 Br</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-lp-on-surface-variant">Companies Onboarded</span>
                  <span className="font-semibold text-lp-on-surface">3 Ventures</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-lp-on-surface-variant">Next Milestone Perk</span>
                  <span className="font-semibold text-lp-primary">Free Multi-Entity Tax Filing</span>
                </div>
              </div>
              <div className="pt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-lp-surface-container">
                  <div className="h-full w-3/4 rounded-full bg-lp-secondary" />
                </div>
                <p className="mt-1.5 text-right text-[11px] text-lp-on-surface-variant">
                  3 / 4 to Tier 3 Executive
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold uppercase tracking-wider text-lp-on-surface">
        {title}
      </span>
      <ul className="flex flex-col gap-2 text-sm text-lp-on-surface-variant">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="transition-colors hover:text-lp-primary">
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LandingFooter({ onNavigate }: { onNavigate: (page: any) => void }) {
  return (
    <footer className="w-full bg-white shadow-[0_-1px_8px_rgba(0,0,0,0.02)]">
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 gap-10 pb-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-2 lg:col-span-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-lp-primary to-lp-secondary text-white">
                <Building2 className="h-4 w-4" />
              </span>
              <span className="font-lp-display text-lg font-semibold text-lp-on-surface">
                AMIS Financial
              </span>
            </div>
            <p className="max-w-sm text-sm text-lp-on-surface-variant">
              Autonomous institutional finance, real-time tax calculation, and dynamic budget
              operating system engineered for founders and quantitative enterprises.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="flex items-center gap-1.5 rounded bg-lp-surface-low px-2.5 py-1 text-[11px] text-lp-on-surface-variant">
                <ShieldCheck className="h-3.5 w-3.5 text-lp-secondary" />
                <span>SOC-2 Type II Certified</span>
              </div>
              <div className="flex items-center gap-1.5 rounded bg-lp-surface-low px-2.5 py-1 text-[11px] text-lp-on-surface-variant">
                <Lock className="h-3.5 w-3.5 text-lp-primary" />
                <span>99.99% Financial SLA</span>
              </div>
              <div className="flex items-center gap-1.5 rounded bg-lp-surface-low px-2.5 py-1 text-[11px] text-lp-on-surface-variant">
                <Landmark className="h-3.5 w-3.5 text-lp-secondary" />
                <span>AES-256 Ledger Vault</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-medium text-lp-primary">
              <button onClick={() => onNavigate('reportTax')} className="hover:underline">
                Company Portal
              </button>
              <span className="text-lp-outline-variant">•</span>
              <button onClick={() => onNavigate('findInfo')} className="hover:underline">
                Tax Office Directory
              </button>
              <span className="text-lp-outline-variant">•</span>
              <a href="/admin-login" className="hover:underline">
                Super Admin
              </a>
            </div>
          </div>

          <FooterColumn
            title="Autonomous Engine"
            links={[
              'Treasury Optimization',
              'Autonomous Tax Provisioning',
              'Sub-Second Cashflow Feed',
              'Cap Table & Stock Register',
              'Multi-Entity Ledger',
            ]}
          />
          <FooterColumn
            title="Enterprise & Trust"
            links={[
              'Security & Compliance',
              'SOC-2 Attestation Reports',
              'Institutional SLA Policy',
              'Bank Grade Encryption',
              'Audit Log Architecture',
            ]}
          />
          <FooterColumn
            title="Company"
            links={[
              "Founder's Story",
              'Pricing Architecture',
              'Fintech Career Portal',
              'Developer REST APIs',
              'Contact Quantitative Support',
            ]}
          />
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-lp-outline-variant/30 pt-4 text-xs text-lp-on-surface-variant md:flex-row">
          <p>
            © 2025 AMIS Financial Technologies, Inc. All fiscal operations secured under regulatory
            mandates.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#" className="transition-colors hover:text-lp-on-surface">
              Terms of Service
            </a>
            <a href="#" className="transition-colors hover:text-lp-on-surface">
              Privacy Architecture
            </a>
            <a href="#" className="transition-colors hover:text-lp-on-surface">
              Regulatory Disclosures
            </a>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-lp-secondary" />
              System Status: 99.998%
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Tour modal                                                          */
/* ------------------------------------------------------------------ */

function TourModal({
  isLoggedIn,
  onClose,
  onNavigate,
}: {
  isLoggedIn: boolean;
  onClose: () => void;
  onNavigate: (page: any) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-lp-inverse-surface/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl space-y-4 rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-lp-primary" />
            <span className="font-lp-display text-lg font-semibold text-lp-on-surface">
              AMIS Financial Platform Tour (2:14)
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-lp-on-surface-variant transition-colors hover:text-lp-on-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-lp-inverse-surface via-[#1c2438] to-lp-primary">
          <div className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-lp-primary/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 right-0 h-56 w-56 rounded-full bg-lp-secondary/25 blur-3xl" />
          <div className="relative flex flex-col items-center gap-3 text-white">
            <button className="flex h-16 w-16 items-center justify-center rounded-full bg-lp-primary/90 text-white shadow-lg transition-transform hover:scale-105">
              <PlayCircle className="h-8 w-8" />
            </button>
            <span className="text-sm font-semibold tracking-wide">
              Interactive product tour streaming soon
            </span>
            <span className="text-xs text-white/70">
              Autonomous ingestion • CPA standby • Zero-penalty filing
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 pt-1 sm:flex-row">
          <span className="text-xs text-lp-on-surface-variant">
            Chapter 1: Autonomous ingestion • Chapter 2: CPA Slack Standby • Chapter 3: Zero-Penalty
            Filing
          </span>
          <button
            onClick={() => {
              onClose();
              onNavigate(isLoggedIn ? 'dashboard' : 'reportTax');
            }}
            className="rounded-lg bg-lp-primary px-4 py-2 text-sm font-medium text-white transition-all hover:bg-lp-primary-container"
          >
            {isLoggedIn ? 'Open Workspace' : 'Start Free Pilot'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function HomePage({ onNavigate, isLoggedIn, userName, onLogout }: HomePageProps) {
  const [tourOpen, setTourOpen] = useState(false);

  return (
    <div className="min-h-screen bg-lp-surface font-lp-body text-lp-on-surface antialiased">
      <LandingHeader
        isLoggedIn={isLoggedIn}
        userName={userName}
        onNavigate={onNavigate}
        onLogout={onLogout}
        onOpenTour={() => setTourOpen(true)}
      />

      <main className="pt-16">
        <Hero
          isLoggedIn={isLoggedIn}
          userName={userName}
          onNavigate={onNavigate}
          onOpenTour={() => setTourOpen(true)}
        />
        <PillarsMatrix onNavigate={onNavigate} />
        <SalaryCalculator onNavigate={onNavigate} />
        <Cockpit />
        <FounderSpotlight />
        <Testimonials />
        <ReferralModule />
      </main>

      <LandingFooter onNavigate={onNavigate} />

      {tourOpen && (
        <TourModal
          isLoggedIn={isLoggedIn}
          onClose={() => setTourOpen(false)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
