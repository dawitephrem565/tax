'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Calendar, ArrowRight, Newspaper } from 'lucide-react';

interface NewsPageProps {
  onBack: () => void;
}

const newsArticles = [
  {
    id: 1,
    title: 'Ethiopian 2025 Personal Income Tax Reform In Full Effect',
    excerpt:
      'The Ministry of Revenues has enforced the progressive income tax brackets with basic exemption up to 2,000 ETB and revised pension rates.',
    date: 'Aug 2025',
    category: 'Proclamation',
  },
  {
    id: 2,
    title: 'Dual-Image Receipt Intake & FS Verification Rules',
    excerpt:
      'Official guidelines on matching cash-register fiscal receipts with corporate invoices for valid 15% VAT credit claims.',
    date: 'Sep 2025',
    category: 'VAT Directives',
  },
  {
    id: 3,
    title: 'Withholding Tax 3% Threshold for Goods Purchases',
    excerpt:
      'Clarification on withholding tax obligations: 3% on goods purchases exceeding 20,000 ETB and 2% on services over 3,000 ETB.',
    date: 'Oct 2025',
    category: 'Withholding',
  },
  {
    id: 4,
    title: 'Statutory Pension Rate Compliance for Private Organizations',
    excerpt:
      'Employers must remit 7% employee contribution and 11% organization share to the Private Organizations Employees Pension Agency.',
    date: 'Nov 2025',
    category: 'Pension',
  },
  {
    id: 5,
    title: 'Digital Tax Clearance and Commercial License Renewals',
    excerpt:
      'Subcity trade bureaus now verify online tax clearance certificates prior to processing annual commercial license renewals.',
    date: 'Dec 2025',
    category: 'Licensing',
  },
  {
    id: 6,
    title: 'Z-Report Daily Reconciliation Directives',
    excerpt:
      'Businesses utilizing electronic cash registers are required to archive daily Z-reports in company file boxes for periodic audit reviews.',
    date: 'Jan 2026',
    category: 'Compliance',
  },
];

export default function NewsPage({ onBack }: NewsPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground pt-20 pb-16 antialiased">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </button>

        {/* Header */}
        <div className="space-y-1.5">
          <Badge variant="outline" className="text-xs font-normal">
            Ministry of Revenues & Compliance
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Tax & Accounting Regulatory Updates
          </h1>
          <p className="text-xs text-muted-foreground">
            Official directives, proclamations, tax calendar deadlines, and compliance notices across Ethiopia.
          </p>
        </div>

        {/* Featured Article */}
        <Card className="border-border shadow-xs bg-muted/30">
          <CardHeader className="p-6 pb-3 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs font-normal">
                {newsArticles[0].category}
              </Badge>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>{newsArticles[0].date}</span>
              </div>
            </div>
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              {newsArticles[0].title}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed text-muted-foreground">
              {newsArticles[0].excerpt}
            </CardDescription>
          </CardHeader>
          <CardFooter className="p-6 pt-2">
            <Button size="sm" className="text-xs h-8 gap-1.5 shadow-2xs">
              <span>Read Proclamation Summary</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </CardFooter>
        </Card>

        {/* News Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {newsArticles.slice(1).map((article) => (
            <Card key={article.id} className="border-border shadow-2xs hover:border-foreground/30 transition-colors flex flex-col justify-between">
              <CardHeader className="p-5 pb-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {article.category}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">{article.date}</span>
                </div>
                <CardTitle className="text-sm font-semibold leading-snug">
                  {article.title}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                  {article.excerpt}
                </CardDescription>
              </CardHeader>
              <CardFooter className="p-5 pt-0">
                <Button variant="ghost" size="sm" className="h-7 text-xs px-0 text-foreground hover:bg-transparent hover:underline gap-1">
                  <span>View Details</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
