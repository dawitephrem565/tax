'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Search,
  FileText,
  Newspaper,
  Shield,
  ArrowRight,
  Calculator,
  Receipt,
  Building,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  FileCheck2,
  Users
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (page: any) => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  // Live interactive quick calculators
  const [calcTab, setCalcTab] = useState<'payroll' | 'receipt'>('payroll');
  const [salaryInput, setSalaryInput] = useState<number>(20000);
  const [receiptInput, setReceiptInput] = useState<number>(50000);

  // Ethiopian 2025 Tax rules
  const computeIncomeTax = (gross: number) => {
    if (gross <= 2000) return 0;
    if (gross <= 4000) return (gross - 2000) * 0.10;
    if (gross <= 7000) return 200 + (gross - 4000) * 0.15;
    if (gross <= 10000) return 650 + (gross - 7000) * 0.20;
    if (gross <= 14000) return 1250 + (gross - 10000) * 0.25;
    if (gross <= 19000) return 2250 + (gross - 14000) * 0.30;
    return 3750 + (gross - 19000) * 0.35;
  };

  const employeePension = Math.round(salaryInput * 0.07);
  const incomeTax = Math.round(computeIncomeTax(salaryInput));
  const netPay = Math.round(salaryInput - employeePension - incomeTax);

  const vatAmount = Math.round(receiptInput * 0.15);
  const whtAmount = Math.round(receiptInput * 0.03);
  const receiptTotal = Math.round(receiptInput + vatAmount);

  const features = [
    {
      icon: Search,
      title: 'Tax & License Discovery',
      description: 'Search official tax category requirements and subcity revenue office jurisdictions across Addis Ababa and federal offices.',
      action: 'findInfo',
      tag: 'Public Directory',
    },
    {
      icon: Receipt,
      title: 'Dual-Image Receipt Intake',
      description: 'Intelligent receipt capture matching your company document with the cash register machine receipt with auto 15% VAT & 3% WHT.',
      action: 'reportTax',
      tag: 'OCR Automated',
    },
    {
      icon: Users,
      title: 'Ethiopian Payroll Engine',
      description: 'Full compliance with 2025 progressive tax brackets, 7% employee and 11% employer pension, and transport exemption ceilings.',
      action: 'reportTax',
      tag: '2025 Reform Ready',
    },
    {
      icon: Layers,
      title: 'Company File Boxes',
      description: 'Segmented document repository for Petty Cash, Z-Reports, Tax & Pension records, and Sales/Purchase agreements.',
      action: 'reportTax',
      tag: 'Digital Vault',
    },
    {
      icon: FileCheck2,
      title: 'Published Agreements',
      description: 'Standard employment, lease, and trade agreements with full Amharic Unicode support and one-click export.',
      action: 'reportTax',
      tag: 'Legal Templates',
    },
    {
      icon: Newspaper,
      title: 'Regulations & News',
      description: 'Official Ministry of Revenue directives, proclamations, tax calendar deadlines, and compliance updates.',
      action: 'news',
      tag: 'Official Updates',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative border-b border-border bg-background py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-6">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs gap-1.5 border-border bg-muted/40 text-muted-foreground font-normal">
              <Sparkles className="w-3.5 h-3.5 text-foreground" />
              <span>Full Odoo Ethiopia Portal Ported to Next.js + Supabase</span>
            </Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground text-balance">
              Ethiopian Business Tax, Payroll & Operations
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl text-balance">
              The all-in-one platform built for Ethiopian enterprises: dual-image receipt intake,
              2025 tax reform compliance, multi-user role management, and file vaults.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                size="lg"
                onClick={() => onNavigate('reportTax')}
                className="gap-2 text-xs font-medium h-10 px-5 shadow-2xs"
              >
                Access Company Workspace
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => onNavigate('findInfo')}
                className="text-xs font-medium h-10 px-5 border-border"
              >
                Find Tax Offices
              </Button>
            </div>

            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-foreground" />
                <span>2025 Progressive Tax Rule</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-foreground" />
                <span>15% VAT & 3% WHT Deductions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-foreground" />
                <span>Multi-Tenant RLS Protected</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Quick Tax Preview Calculator */}
      <section className="py-16 bg-muted/30 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-1.5 mb-8">
            <Badge variant="outline" className="text-xs font-normal">
              Live Calculation Engine
            </Badge>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Instant Compliance Estimator
            </h2>
            <p className="text-xs text-muted-foreground">
              See the exact Ethiopian tax formulas implemented in our Supabase backend.
            </p>
          </div>

          <Card className="border-border shadow-xs">
            <CardHeader className="border-b border-border p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-foreground" />
                <span className="text-xs font-semibold text-foreground">Tax Calculator</span>
              </div>
              <div className="flex rounded-md bg-muted p-0.5 border border-border">
                <button
                  onClick={() => setCalcTab('payroll')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${calcTab === 'payroll' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Payroll (2025 Rules)
                </button>
                <button
                  onClick={() => setCalcTab('receipt')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${calcTab === 'receipt' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Receipt VAT & WHT
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {calcTab === 'payroll' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <Label htmlFor="salary" className="text-xs font-medium">
                      Monthly Basic Salary (ETB)
                    </Label>
                    <div className="relative">
                      <Input
                        id="salary"
                        type="number"
                        value={salaryInput}
                        onChange={(e) => setSalaryInput(Math.max(0, Number(e.target.value)))}
                        className="text-base font-semibold pl-3 pr-14 h-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                        ETB
                      </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[10000, 20000, 35000, 50000].map((amt) => (
                        <Button
                          key={amt}
                          variant="outline"
                          size="sm"
                          onClick={() => setSalaryInput(amt)}
                          className="text-[11px] h-7 px-2 border-border"
                        >
                          {amt.toLocaleString()} ETB
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-muted/40 rounded-lg p-4 border border-border space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Gross Basic:</span>
                      <span className="font-semibold">{salaryInput.toLocaleString()} ETB</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Employee Pension (7%):</span>
                      <span className="font-medium text-foreground">-{employeePension.toLocaleString()} ETB</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>2025 Progressive Tax:</span>
                      <span className="font-medium text-foreground">-{incomeTax.toLocaleString()} ETB</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between items-center">
                      <span className="font-semibold text-foreground">Estimated Net Pay:</span>
                      <span className="text-base font-bold text-foreground">
                        {netPay.toLocaleString()} ETB
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <Label htmlFor="receipt" className="text-xs font-medium">
                      Untaxed Document Amount (ETB)
                    </Label>
                    <div className="relative">
                      <Input
                        id="receipt"
                        type="number"
                        value={receiptInput}
                        onChange={(e) => setReceiptInput(Math.max(0, Number(e.target.value)))}
                        className="text-base font-semibold pl-3 pr-14 h-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                        ETB
                      </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[25000, 50000, 100000, 250000].map((amt) => (
                        <Button
                          key={amt}
                          variant="outline"
                          size="sm"
                          onClick={() => setReceiptInput(amt)}
                          className="text-[11px] h-7 px-2 border-border"
                        >
                          {amt.toLocaleString()} ETB
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-muted/40 rounded-lg p-4 border border-border space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Untaxed Subtotal:</span>
                      <span className="font-semibold">{receiptInput.toLocaleString()} ETB</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>15% Value Added Tax (VAT):</span>
                      <span className="font-medium text-foreground">+{vatAmount.toLocaleString()} ETB</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Withholding Tax (WHT 3%):</span>
                      <span className="font-medium text-foreground">{whtAmount.toLocaleString()} ETB</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between items-center">
                      <span className="font-semibold text-foreground">Total Receipt Amount:</span>
                      <span className="text-base font-bold text-foreground">
                        {receiptTotal.toLocaleString()} ETB
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-1.5 mb-12 max-w-xl mx-auto">
          <Badge variant="outline" className="text-xs font-normal">
            Platform Modules
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Built for Ethiopian Businesses & Accountants
          </h2>
          <p className="text-xs text-muted-foreground">
            Everything previously managed in your Odoo installation, accessible through a simple modern dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <Card
                key={feat.title}
                className="group border-border hover:border-foreground/30 transition-all shadow-2xs flex flex-col justify-between"
              >
                <CardHeader className="space-y-2.5 p-5">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-foreground">
                      <Icon className="w-4 h-4" />
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-normal text-muted-foreground">
                      {feat.tag}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-semibold text-foreground">
                    {feat.title}
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                    {feat.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate(feat.action)}
                    className="w-full justify-between text-xs font-medium text-foreground hover:bg-muted h-8 px-2"
                  >
                    <span>Launch Module</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Modern Minimalist Footer */}
      <footer className="mt-auto border-t border-border bg-background py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-foreground" />
            <span className="font-medium text-foreground">Amis Financial Systems</span>
            <span>• Compliant with Ethiopian Ministry of Revenue standards.</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => onNavigate('findInfo')} className="hover:text-foreground">
              Offices Directory
            </button>
            <button onClick={() => onNavigate('reportTax')} className="hover:text-foreground">
              Company Portal
            </button>
            <a href="/admin-login" className="hover:text-foreground">
              Super Admin
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
