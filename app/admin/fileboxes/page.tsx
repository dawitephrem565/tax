'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { FileBox, RefreshCw, Download, Upload, Plus, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const FILE_BOX_CATEGORIES = [
  { key: 'petty_cash',           label: 'Petty Cash',              desc: 'Petty cash vouchers and stamps' },
  { key: 'income_tax_pension',   label: 'Income Tax & Pension',     desc: 'ERCA declarations & pension receipts' },
  { key: 'purchase_receipt',     label: 'Purchase Receipts',        desc: 'Vendor receipts & withholding notes' },
  { key: 'sales_receipt',        label: 'Sales Receipts',           desc: 'Customer invoices & register copies' },
  { key: 'agreement',            label: 'Agreements',               desc: 'Lease, supplier agreements & terms' },
  { key: 'z_report',             label: 'Z-Reports',                desc: 'Fiscal cash register end-of-day printouts' },
];

interface CompanyOption {
  _id: string;
  fullName: string;
}

interface FileEntry {
  id: string;
  company_id: string;
  company_name?: string;
  box_category: string;
  file_name: string;
  file_size?: number;
  storage_path: string;
  uploaded_by?: string;
  created_at: string;
}

export default function AdminFileboxesPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    load();
    loadCompanies();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/fileboxes', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.files) setFiles(data.files);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/companies', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.companies) setCompanies(data.companies);
    } catch {
      // silent
    }
  };

  const filtered = files.filter((f) => {
    const matchesCat = activeCategory === 'all' || f.box_category === activeCategory;
    const matchesCompany = selectedCompanyId === 'all' || f.company_id === selectedCompanyId;
    return matchesCat && matchesCompany;
  });

  const countByCategory = (key: string) =>
    files.filter((f) => f.box_category === key && (selectedCompanyId === 'all' || f.company_id === selectedCompanyId)).length;

  const formatSize = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Digital File Boxes — Per Company</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            6-category file repository with company-level filtering. Supabase Storage integration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Company Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="text-xs bg-transparent text-foreground focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="all">All Companies</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8 text-xs gap-1.5">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card
          className={`border-border shadow-xs cursor-pointer transition-colors ${
            activeCategory === 'all' ? 'border-primary/50 bg-primary/5' : 'hover:border-foreground/20'
          }`}
          onClick={() => setActiveCategory('all')}
        >
          <CardContent className="p-3 text-center">
            <FileBox className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs font-semibold">All Boxes</p>
            <p className="text-lg font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        {FILE_BOX_CATEGORIES.map((box) => (
          <Card
            key={box.key}
            className={`border-border shadow-xs cursor-pointer transition-colors ${
              activeCategory === box.key ? 'border-primary/50 bg-primary/5' : 'hover:border-foreground/20'
            }`}
            onClick={() => setActiveCategory(box.key)}
          >
            <CardContent className="p-3">
              <FileBox className="w-4 h-4 mb-1 text-muted-foreground" />
              <p className="text-[11px] font-semibold leading-tight">{box.label}</p>
              <p className="text-lg font-bold">{countByCategory(box.key)}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{box.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Files Table */}
      <Card className="border-border shadow-xs">
        <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">
              {activeCategory === 'all' ? 'All Files' : FILE_BOX_CATEGORIES.find((b) => b.key === activeCategory)?.label}
            </CardTitle>
            <CardDescription className="text-xs">
              {filtered.length} document{filtered.length !== 1 ? 's' : ''} in repository
              {selectedCompanyId !== 'all' ? ' (Filtered for company)' : ''}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Enterprise</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground">
                    Loading files...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground">
                    No files found in this category for the selected enterprise.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((f) => (
                  <TableRow key={f.id} className="text-xs hover:bg-muted/30">
                    <TableCell className="font-medium max-w-[150px] truncate">{f.company_name || 'Enterprise'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {f.box_category.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{f.file_name}</TableCell>
                    <TableCell className="text-muted-foreground">{formatSize(f.file_size)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.storage_path ? (
                        <a
                          href={`/api/files?path=${encodeURIComponent(f.storage_path)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">No link</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
