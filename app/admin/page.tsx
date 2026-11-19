'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Building2,
  FileCheck2,
  Receipt,
  FileBox,
  Users,
  FileText,
  Layers,
  Shield,
  Search,
  Plus,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Upload,
  Trash2,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface Company {
  _id: string;
  fullName: string;
  companyAddress: string;
  tinNumber: string;
  phone: string;
  email: string;
  businessType?: string;
  companyType?: string;
  memberCount?: number;
  branchRegion?: string;
  branchOffice?: string;
  status: string;
  files: {
    license?: string;
    licenseRegistration?: string;
    vatCertificate?: string;
    tinCertificate?: string;
    negedMezgeba?: string;
    negedSeyame?: string;
    homeRentWel?: string;
    managerNationalId?: string;
    metedadriyaDenb?: string;
  };
  createdAt: string;
}

interface OverviewStats {
  totalCompanies: number;
  pendingCompanies: number;
  approvedCompanies: number;
  rejectedCompanies: number;
  totalTemplates: number;
  totalReports: number;
  totalReceipts: number;
}

const ADDIS_ABABA_BRANCHES = [
  'Head Office (Mexico Square / Ras Lulseged Street, Kirkos Sub-City)',
  'Kirkos Sub-City Branch (Behind Addis Ababa Stadium)',
  'Bole Sub-City Branch (Bole Medhanealem / Dembel area)',
  'Lideta Sub-City Branch (Lideta Sub-City Administration area)',
  'Addis Ketema & Merkato Branches (Merkato commercial area / Addis Ketema Sub-City)',
  'Medium Taxpayers Branch (City-level medium taxpayers)',
  'Nifas Silk-Lafto Sub-City Branch (Near Getu Commercial Center)',
  'Gulele Sub-City Branch (Near Gulele Sub-City Administration)',
  'Yeka Sub-City Branch (Woreda 8 / near Yeka Sub-City Administration)',
  'Kolfe Keranio Sub-City Branch (Near Kolfe Keranio Sub-City Administration)',
  'Akaki Kality Sub-City Branch (Near Akaki Kality Sub-City Administration)',
  'Lemi Kura Sub-City Branch (Lemi Kura Sub-City Administration area)',
  'Woreda Micro-Taxpayer Offices (116 woreda offices across Addis Ababa)',
];

const FEDERAL_MOR_BRANCHES = [
  'MOR Headquarters (Megenagna, Bole Sub-City)',
  'Large Taxpayers Office (LTO) – Addis Ababa',
  'East Addis Ababa Medium Taxpayers Branch',
  'West Addis Ababa Medium Taxpayers Branch',
  'East Addis Ababa Small Taxpayers Branch',
  'West Addis Ababa Small Taxpayers Branch',
  'North West Addis Ababa Small Taxpayers Branch',
  'Mesob One-Stop Service Center',
  'Investment One-Stop Registration Center',
];

const STATUTORY_DOCUMENTS = [
  { type: 'license', label: 'Business License' },
  { type: 'license_registration', label: 'License Registration' },
  { type: 'vat_certificate', label: 'VAT Certificate' },
  { type: 'tin_certificate', label: 'TIN Certificate' },
  { type: 'neged_mezgeba', label: 'Neged Mezgeba (Registration File)' },
  { type: 'neged_seyame', label: 'Neged Seyame (Brand Auth)' },
  { type: 'home_rent_wel', label: 'Home Rent Wel (Lease Contract)' },
  { type: 'manager_national_id', label: 'General Manager National ID' },
  { type: 'metedadriya_denb', label: 'Metedadriya Denb (Location Auth)' },
];

export default function AdminDashboardPage() {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab') as any;

  const [activeNav, setActiveNav] = useState<
    'overview' | 'companies' | 'receipts' | 'fileboxes' | 'payroll' | 'templates' | 'sectors' | 'users'
  >('overview');

  useEffect(() => {
    if (urlTab && ['overview', 'companies', 'receipts', 'fileboxes', 'payroll', 'templates', 'sectors', 'users'].includes(urlTab)) {
      setActiveNav(urlTab);
    }
  }, [urlTab]);

  // Supabase Data States
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<OverviewStats>({
    totalCompanies: 0,
    pendingCompanies: 0,
    approvedCompanies: 0,
    rejectedCompanies: 0,
    totalTemplates: 0,
    totalReports: 0,
    totalReceipts: 0,
  });
  const [templates, setTemplates] = useState<any[]>([]);
  const [businessTypes, setBusinessTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Add Company License Modal State ─────────────────────────────
  const [isAddLicenseModalOpen, setIsAddLicenseModalOpen] = useState(false);
  const [licenseForm, setLicenseForm] = useState({
    companyId: '',
    licenseName: '',
    licenseNumber: '',
    licenseType: 'Business License',
    companyType: 'PLC' as 'PLC' | 'SOLE' | 'Share Company',
    memberCount: '1',
    branchRegion: 'Addis Ababa' as 'Addis Ababa' | 'Federal',
    branchOffice: '',
  });
  const [licenseDocs, setLicenseDocs] = useState<Record<string, { path: string; fileName: string }>>({});
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [savingLicense, setSavingLicense] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchCompanies(), fetchOverview()]);
    setLoading(false);
  };

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/companies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.companies) {
        setCompanies(data.companies);
      }
    } catch (err) {
      console.error('Failed to fetch companies from Supabase', err);
    }
  };

  const fetchOverview = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        if (data.stats) setStats(data.stats);
        if (data.templates) setTemplates(data.templates);
        if (data.businessTypes) setBusinessTypes(data.businessTypes);
      }
    } catch (err) {
      console.error('Failed to fetch admin overview from Supabase', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCompanies(), fetchOverview()]);
    setRefreshing(false);
    toast.success('Synced with Supabase');
  };

  const handleApproval = async (companyId: string, action: string) => {
    setActionLoading(companyId);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyId, action }),
      });
      if (res.ok) {
        toast.success(`Company status updated to ${action}`);
        setCompanies((prev) =>
          prev.map((c) => (c._id === companyId ? { ...c, status: action } : c))
        );
        if (selectedCompany?._id === companyId) {
          setSelectedCompany((prev) => (prev ? { ...prev, status: action } : null));
        }
        fetchOverview();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Approval action failed');
      }
    } catch (err) {
      console.error('Approval failed', err);
      toast.error('Network error updating approval status');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Document upload for Add Company License modal ─────────────
  const uploadLicenseDoc = async (type: string, file: File) => {
    setUploadingDoc(type);
    try {
      const token = localStorage.getItem('adminToken');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setLicenseDocs((prev) => ({ ...prev, [type]: { path: data.path, fileName: file.name } }));
      toast.success(`${file.name} uploaded successfully`);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleSaveLicense = async () => {
    if (!licenseForm.companyId) {
      toast.error('Please select an enterprise');
      return;
    }
    if (!licenseForm.licenseName.trim()) {
      toast.error('License name is required');
      return;
    }
    setSavingLicense(true);
    try {
      const token = localStorage.getItem('adminToken');
      const docsArray = Object.entries(licenseDocs).map(([type, doc]) => ({
        type,
        path: doc.path,
        fileName: doc.fileName,
      }));

      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          company_id: licenseForm.companyId,
          license_name: licenseForm.licenseName,
          license_number: licenseForm.licenseNumber || null,
          license_type: licenseForm.licenseType,
          company_type: licenseForm.companyType,
          branch_region: licenseForm.branchRegion,
          branch_office: licenseForm.branchOffice || null,
          documents: docsArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add license');

      toast.success(`License "${licenseForm.licenseName}" registered under company successfully!`);
      setIsAddLicenseModalOpen(false);
      setLicenseForm({
        companyId: '',
        licenseName: '',
        licenseNumber: '',
        licenseType: 'Business License',
        companyType: 'PLC',
        memberCount: '1',
        branchRegion: 'Addis Ababa',
        branchOffice: '',
      });
      setLicenseDocs({});
      fetchCompanies();
    } catch (err: any) {
      toast.error(err.message || 'Error creating license');
    } finally {
      setSavingLicense(false);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (c.fullName || '').toLowerCase().includes(q) ||
      (c.tinNumber || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q);
    const matchesFilter = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const branchOptions =
    licenseForm.branchRegion === 'Addis Ababa' ? ADDIS_ABABA_BRANCHES : FEDERAL_MOR_BRANCHES;

  return (
    <div className="space-y-6">
      {/* Dynamic Content Based on activeNav */}
      {activeNav === 'overview' && (
        <div className="space-y-6">
          {/* Header Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Dashboard Overview
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time Ethiopian corporate onboarding, verification queue and Odoo-ported modules.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-7 text-xs gap-1.5 border-border"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Sync Supabase</span>
              </Button>
              <Badge variant="outline" className="text-xs py-0.5 px-2.5 gap-1.5 font-normal">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                Live
              </Badge>
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border shadow-xs">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <span className="text-xs font-medium text-muted-foreground">Total Enterprises</span>
                <Building2 className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold">{stats.totalCompanies}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Registered accounts</p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-xs">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <span className="text-xs font-medium text-muted-foreground">Pending Verification</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.pendingCompanies}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Requires audit</p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-xs">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <span className="text-xs font-medium text-muted-foreground">Approved Companies</span>
                <CheckCircle2 className="w-4 h-4 text-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold">{stats.approvedCompanies}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Compliant entities</p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-xs">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <span className="text-xs font-medium text-muted-foreground">Legal Agreements</span>
                <FileText className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold">{stats.totalTemplates}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Published templates</p>
              </CardContent>
            </Card>
          </div>

          {/* Companies Queue Table Container */}
          <Card className="border-border shadow-xs">
            <CardHeader className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold">Onboarding &amp; Verification Stream</CardTitle>
                <CardDescription className="text-xs">
                  Live data from Supabase public.companies.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Company License Option Button beside Company Registration */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddLicenseModalOpen(true)}
                  className="h-7 text-xs gap-1.5 border-dashed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Company License
                </Button>

                <Link href="/admin/companies/new">
                  <Button size="sm" className="h-7 text-xs gap-1.5 shadow-2xs">
                    <Plus className="w-3.5 h-3.5" />
                    Onboard Company
                  </Button>
                </Link>

                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or TIN..."
                    className="h-7 pl-8 text-xs bg-muted/30"
                  />
                </div>

                <div className="flex rounded-md border border-border p-0.5 bg-muted/40">
                  {(['all', 'pending', 'approved'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2 py-0.5 text-xs rounded capitalize font-medium transition-colors ${
                        statusFilter === st
                          ? 'bg-background text-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Company</TableHead>
                    <TableHead>TIN</TableHead>
                    <TableHead>Contact / Email</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Onboarded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                        Syncing records from Supabase...
                      </TableCell>
                    </TableRow>
                  ) : filteredCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                        No companies found. Click &quot;Onboard Company&quot; to register your first enterprise.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanies.map((c) => (
                      <TableRow key={c._id} className="text-xs hover:bg-muted/40">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6 rounded-md">
                              <AvatarFallback className="bg-muted text-foreground text-[10px] font-medium">
                                {c.fullName.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <button
                                onClick={() => setSelectedCompany(c)}
                                className="font-medium text-foreground hover:underline text-left text-xs"
                              >
                                {c.fullName}
                              </button>
                              <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                {c.companyAddress}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {c.tinNumber}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <p className="text-foreground">{c.email}</p>
                          <p className="text-[11px] text-muted-foreground">{c.phone || '—'}</p>
                        </TableCell>

                        <TableCell>
                          <span className="text-muted-foreground">{c.businessType || 'General'}</span>
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={c.status === 'approved' ? 'default' : c.status === 'pending' ? 'secondary' : 'outline'}
                            className="text-[10px] capitalize font-normal"
                          >
                            {c.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => setSelectedCompany(c)}>
                                Inspect Verification
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setLicenseForm((prev) => ({ ...prev, companyId: c._id }));
                                  setIsAddLicenseModalOpen(true);
                                }}
                              >
                                Add License to Company
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleApproval(c._id, 'approved')}
                                className="font-medium"
                              >
                                Approve Company
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleApproval(c._id, 'rejected')}
                                className="text-destructive font-medium"
                              >
                                Reject Application
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: COMPANIES QUEUE VIEW */}
      {activeNav === 'companies' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Companies Management</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Filter, inspect and add licenses to verified Ethiopian corporate accounts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Company License Option Button beside Company Registration */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddLicenseModalOpen(true)}
                className="h-8 text-xs gap-1.5 border-dashed"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Company License
              </Button>

              <Link href="/admin/companies/new">
                <Button size="sm" className="h-8 text-xs gap-1.5 shadow-2xs">
                  <Plus className="w-3.5 h-3.5" />
                  Onboard Company
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCompanies.map((c) => (
              <Card key={c._id} className="border-border shadow-xs hover:border-foreground/30 transition-colors">
                <CardHeader className="p-4 pb-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] capitalize font-normal">
                      {c.status}
                    </Badge>
                    <span className="text-[11px] font-mono text-muted-foreground">TIN: {c.tinNumber}</span>
                  </div>
                  <CardTitle className="text-sm font-semibold">{c.fullName}</CardTitle>
                  <CardDescription className="text-xs">{c.companyAddress}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Email:</span>
                    <span className="text-foreground">{c.email}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Phone:</span>
                    <span className="text-foreground">{c.phone || '—'}</span>
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-2 border-t border-border flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCompany(c)}
                    className="h-7 text-xs px-2"
                  >
                    Inspect Files
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setLicenseForm((prev) => ({ ...prev, companyId: c._id }));
                      setIsAddLicenseModalOpen(true);
                    }}
                    className="h-7 text-xs px-2.5 gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add License
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: LEGAL AGREEMENTS */}
      {activeNav === 'templates' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Published Legal Agreement Templates</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ported from Odoo ethiopia.agreement.template with Amharic Unicode support.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tmpl) => (
              <Card key={tmpl.id} className="border-border shadow-xs">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">{tmpl.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {tmpl.created_at ? new Date(tmpl.created_at).toLocaleDateString() : 'System Seed'}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {tmpl.state}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="p-3 bg-muted/40 rounded-md text-xs font-mono text-muted-foreground line-clamp-3 border border-border">
                    የቅጥር ውል ስምምነት — በአሰሪና ሰራተኛ አዋጅ ቁጥር 1156/2011 መሰረት የተዘጋጀ። Standard provisions, progressive tax deduction, and 7% pension compliance.
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: BUSINESS SECTORS */}
      {activeNav === 'sectors' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Ethiopian Business Sectors (TIN Registration)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reference categories from Supabase public.business_types.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {businessTypes.map((type) => (
              <Card key={type.id} className="border-border shadow-xs">
                <CardContent className="p-3 flex flex-col justify-between h-20">
                  <span className="text-xs font-medium text-foreground">{type.name}</span>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {type.code || 'SEC'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">Active</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: ADMIN ROLES & RBAC */}
      {activeNav === 'users' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Role-Based Access Control (RBAC)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Platform Administrators and Company Level Roles (Port of Odoo Groups).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border">
              <CardHeader className="p-4 pb-2">
                <Badge variant="outline" className="w-fit text-[10px]">SUPER ADMIN</Badge>
                <CardTitle className="text-sm font-semibold pt-1">Platform Administrator</CardTitle>
                <CardDescription className="text-xs">Full access across all companies, approvals &amp; system tables.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 text-xs font-mono text-muted-foreground">
                Role: is_platform_admin = true
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="p-4 pb-2">
                <Badge variant="outline" className="w-fit text-[10px]">COMPANY ADMIN</Badge>
                <CardTitle className="text-sm font-semibold pt-1">Enterprise Administrator</CardTitle>
                <CardDescription className="text-xs">Manages staff, approvals, receipts, and treasury for own company.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 text-xs font-mono text-muted-foreground">
                Role: company_admin
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="p-4 pb-2">
                <Badge variant="outline" className="w-fit text-[10px]">ACCOUNTANT &amp; PAYROLL</Badge>
                <CardTitle className="text-sm font-semibold pt-1">Financial Officer</CardTitle>
                <CardDescription className="text-xs">Access to receipt intake, file boxes, and Ethiopian payroll computation.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 text-xs font-mono text-muted-foreground">
                Role: accountant, payroll_officer
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── ADD COMPANY LICENSE MODAL (BESIDE REGISTRATION) ── */}
      {isAddLicenseModalOpen && (
        <Dialog open={isAddLicenseModalOpen} onOpenChange={setIsAddLicenseModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Add Company License (Multiple License Registration)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Register an additional business or trading license under an existing Ethiopian enterprise.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Select Target Company */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Select Company *</Label>
                <select
                  value={licenseForm.companyId}
                  onChange={(e) => setLicenseForm((prev) => ({ ...prev, companyId: e.target.value }))}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">— Choose enterprise —</option>
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.fullName} (TIN: {c.tinNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* License Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">License / Trade Name *</Label>
                  <Input
                    value={licenseForm.licenseName}
                    onChange={(e) => setLicenseForm((prev) => ({ ...prev, licenseName: e.target.value }))}
                    placeholder="e.g. Retail Branch / Import Division"
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">License Number</Label>
                  <Input
                    value={licenseForm.licenseNumber}
                    onChange={(e) => setLicenseForm((prev) => ({ ...prev, licenseNumber: e.target.value }))}
                    placeholder="e.g. LIC-2024-00789"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">License Type</Label>
                  <select
                    value={licenseForm.licenseType}
                    onChange={(e) => setLicenseForm((prev) => ({ ...prev, licenseType: e.target.value }))}
                    className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground"
                  >
                    <option>Business License</option>
                    <option>Import License</option>
                    <option>Export License</option>
                    <option>Service License</option>
                    <option>Manufacturing License</option>
                    <option>Construction License</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              {/* Company Type Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Company Legal Structure *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['PLC', 'SOLE', 'Share Company'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLicenseForm((prev) => ({ ...prev, companyType: type }))}
                      className={`h-8 rounded-md border text-xs font-medium transition-colors ${
                        licenseForm.companyType === type
                          ? 'border-primary bg-primary text-primary-foreground font-semibold'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* PLC Member Count if PLC */}
              {licenseForm.companyType === 'PLC' && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Number of PLC Members *</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="1 member or write number of members"
                    value={licenseForm.memberCount}
                    onChange={(e) => setLicenseForm((prev) => ({ ...prev, memberCount: e.target.value }))}
                    className="h-8 text-xs"
                    required
                  />
                </div>
              )}

              {/* Gebiyon Tax Revenue Branch */}
              <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2.5">
                <Label className="text-xs font-semibold block">Tax Revenue Branch (Gebiyon) *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Addis Ababa', 'Federal'] as const).map((region) => (
                    <button
                      key={region}
                      type="button"
                      onClick={() =>
                        setLicenseForm((prev) => ({ ...prev, branchRegion: region, branchOffice: '' }))
                      }
                      className={`h-8 px-2.5 rounded-md border text-xs font-medium transition-colors text-left flex items-center justify-between ${
                        licenseForm.branchRegion === region
                          ? 'border-primary bg-primary text-primary-foreground font-semibold'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>{region === 'Addis Ababa' ? 'AARB (Addis Ababa)' : 'Federal MOR'}</span>
                      {licenseForm.branchRegion === region && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>

                <div className="space-y-1 mt-1">
                  <Label className="text-[11px] font-medium">Specific Branch Office</Label>
                  <select
                    value={licenseForm.branchOffice}
                    onChange={(e) => setLicenseForm((prev) => ({ ...prev, branchOffice: e.target.value }))}
                    className="w-full text-xs h-8 rounded-md border border-border bg-background px-2.5 text-foreground"
                    required
                  >
                    <option value="">— Select branch —</option>
                    {branchOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* File Uploads for License */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold block">
                  License &amp; Statutory Document Uploads
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STATUTORY_DOCUMENTS.map((doc) => {
                    const uploaded = licenseDocs[doc.type];
                    return (
                      <div key={doc.type} className="border border-dashed border-border rounded-md p-2 bg-background flex items-center justify-between">
                        <span className="text-[11px] truncate max-w-[160px] font-medium">{doc.label}</span>
                        {uploaded ? (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                            <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[80px]">{uploaded.fileName}</span>
                          </div>
                        ) : (
                          <label className="flex items-center gap-1 text-[10px] border border-border px-2 py-1 rounded cursor-pointer hover:bg-muted/50 text-muted-foreground">
                            <Upload className="w-3 h-3" />
                            <span>{uploadingDoc === doc.type ? '...' : 'Upload'}</span>
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void uploadLicenseDoc(doc.type, f);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddLicenseModalOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveLicense}
                disabled={savingLicense}
                className="text-xs h-8 gap-1.5 shadow-xs"
              >
                {savingLicense ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Registering License...
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    Save &amp; Attach License
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* INSPECTION / APPROVAL DIALOG */}
      {selectedCompany && (
        <Dialog open={Boolean(selectedCompany)} onOpenChange={() => setSelectedCompany(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Company Document Verification &amp; Inspection
              </DialogTitle>
              <DialogDescription className="text-xs">
                Review official business licenses, Ethiopian TIN, and statutory registration files.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-4 rounded-lg border border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Legal Entity</span>
                  <span className="font-semibold text-foreground">{selectedCompany.fullName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Ethiopian TIN</span>
                  <span className="font-mono font-semibold text-foreground">{selectedCompany.tinNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Email Address</span>
                  <span className="text-foreground">{selectedCompany.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Phone Number</span>
                  <span className="text-foreground">{selectedCompany.phone || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[11px]">Business Address</span>
                  <span className="text-foreground">{selectedCompany.companyAddress}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-2">Compliance &amp; Statutory Verification Files</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Business License', path: selectedCompany.files?.license },
                    { label: 'License Registration', path: selectedCompany.files?.licenseRegistration },
                    { label: 'VAT Certificate', path: selectedCompany.files?.vatCertificate },
                    { label: 'TIN Certificate', path: selectedCompany.files?.tinCertificate },
                    { label: 'Neged Mezgeba (Registration)', path: selectedCompany.files?.negedMezgeba },
                    { label: 'Neged Seyame (Brand Auth)', path: selectedCompany.files?.negedSeyame },
                    { label: 'Home Rent Wel (Lease Contract)', path: selectedCompany.files?.homeRentWel },
                    { label: 'GM National ID Card', path: selectedCompany.files?.managerNationalId },
                    { label: 'Metedadriya Denb (Location Auth)', path: selectedCompany.files?.metedadriyaDenb },
                  ].map((doc) => (
                    <div
                      key={doc.label}
                      className="p-2.5 rounded-lg border border-border flex items-center justify-between text-xs bg-background"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileCheck2 className="w-4 h-4 text-foreground shrink-0" />
                        <span className="truncate text-[11px] font-medium">{doc.label}</span>
                      </div>
                      {doc.path ? (
                        <a
                          href={doc.path.startsWith('http') ? doc.path : `/api/files?path=${encodeURIComponent(doc.path)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground hover:underline text-[11px] font-semibold shrink-0"
                        >
                          View File
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCompany(null)}
                  className="text-xs h-8"
                >
                  Close
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading === selectedCompany._id}
                    onClick={() => handleApproval(selectedCompany._id, 'rejected')}
                    className="text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={actionLoading === selectedCompany._id}
                    onClick={() => handleApproval(selectedCompany._id, 'approved')}
                    className="text-xs h-8"
                  >
                    Approve Company
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
