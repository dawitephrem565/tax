'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Users, RefreshCw, Upload, Plus, Download, Building2,
  Calculator, CheckCircle2, Trash2, Edit3, ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

interface CompanyOption {
  _id: string;
  fullName: string;
  tinNumber: string;
  email: string;
}

interface PayrollRun {
  id: string;
  company_id: string;
  company_name?: string;
  period_month: number;
  period_year: number;
  total_employees: number;
  total_gross: number;
  total_pension_emp: number;
  total_pension_org: number;
  total_income_tax: number;
  total_net: number;
  state: string;
  created_at: string;
}

export interface EmployeeRow {
  id: string;
  name: string;
  tin: string;
  basic: number;
  workDays: number;
  earnedBasic: number;
  overtime: number;
  taxableAllowance: number;
  transport: number;
  pensionOrg: number;
  gross: number;
  taxableIncome: number;
  tax: number;
  pensionEmp: number;
  advance: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
}

// ── Official Ethiopian Income Tax Brackets (Proclamation No. 979/2016) ────
function computeEthiopianTax(
  basic: number,
  workDays: number = 30,
  overtime: number = 0,
  taxableAllowance: number = 0,
  transport: number = 0,
  advance: number = 0,
  otherDeductions: number = 0
) {
  const safeBasic = Number(basic) || 0;
  const safeDays = Number(workDays) > 0 ? Number(workDays) : 30;
  const earnedBasic = safeDays === 30 ? safeBasic : Math.round((safeBasic / 30) * safeDays * 100) / 100;

  const safeOvertime = Number(overtime) || 0;
  const safeTaxableAllowance = Number(taxableAllowance) || 0;
  const safeTransport = Number(transport) || 0;
  const safeAdvance = Number(advance) || 0;
  const safeOtherDeductions = Number(otherDeductions) || 0;

  // Pension (7% employee, 11% employer) computed on earned basic salary
  const pensionOrg = Math.round(earnedBasic * 0.11 * 100) / 100;
  const pensionEmp = Math.round(earnedBasic * 0.07 * 100) / 100;

  // Total Taxable Earning = Basic Earned + Overtime + Taxable Allowance
  const taxableIncome = Math.round((earnedBasic + safeOvertime + safeTaxableAllowance) * 100) / 100;

  // Gross = Basic Earned + Overtime + Taxable Allowance + Transport + Pension 11%
  const gross = Math.round((earnedBasic + safeOvertime + safeTaxableAllowance + safeTransport + pensionOrg) * 100) / 100;

  // Proclamation 979/2016 progressive tax brackets
  let tax = 0;
  if (taxableIncome <= 600) {
    tax = 0;
  } else if (taxableIncome <= 1650) {
    tax = taxableIncome * 0.10 - 60;
  } else if (taxableIncome <= 3200) {
    tax = taxableIncome * 0.15 - 142.50;
  } else if (taxableIncome <= 5250) {
    tax = taxableIncome * 0.20 - 302.50;
  } else if (taxableIncome <= 7800) {
    tax = taxableIncome * 0.25 - 565.00;
  } else if (taxableIncome <= 10900) {
    tax = taxableIncome * 0.30 - 955.00;
  } else {
    tax = taxableIncome * 0.35 - 1500.00;
  }
  tax = Math.max(0, Math.round(tax * 100) / 100);

  const totalDeductions = Math.round((tax + pensionEmp + safeAdvance + safeOtherDeductions) * 100) / 100;
  const net = Math.round((earnedBasic + safeOvertime + safeTaxableAllowance + safeTransport - totalDeductions) * 100) / 100;

  return {
    workDays: safeDays,
    earnedBasic,
    overtime: safeOvertime,
    taxableAllowance: safeTaxableAllowance,
    transport: safeTransport,
    pensionOrg,
    gross,
    taxableIncome,
    tax,
    pensionEmp,
    advance: safeAdvance,
    otherDeductions: safeOtherDeductions,
    totalDeductions,
    net,
  };
}

const DEFAULT_EMPLOYEES: EmployeeRow[] = [
  { id: 'emp-1', name: 'Zerubabel Gebeyehu', tin: '0012938475', basic: 25000, ...computeEthiopianTax(25000, 30) },
  { id: 'emp-2', name: 'Kidus Amanuel', tin: '0029384756', basic: 10000, ...computeEthiopianTax(10000, 30) },
  { id: 'emp-3', name: 'Atnafu Anja', tin: '0038475612', basic: 8000, ...computeEthiopianTax(8000, 30) },
  { id: 'emp-4', name: 'Amira', tin: '0047561293', basic: 14656, ...computeEthiopianTax(14656, 30) },
  { id: 'emp-5', name: 'Rahel Solomon', tin: '0056129384', basic: 14656, ...computeEthiopianTax(14656, 30) },
];

export default function AdminPayrollPage() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-company employees store: companyId -> EmployeeRow[]
  const [companyEmployees, setCompanyEmployees] = useState<Record<string, EmployeeRow[]>>({});
  
  // Modal states
  const [companyPickerModalOpen, setCompanyPickerModalOpen] = useState(false);
  const [calculatorModalOpen, setCalculatorModalOpen] = useState(false);
  const [activeCalcCompanyId, setActiveCalcCompanyId] = useState<string>('');
  const [payrollPosting, setPayrollPosting] = useState(false);

  // Active company object
  const activeCompany = companies.find((c) => c._id === activeCalcCompanyId) ||
    companies.find((c) => c._id === selectedCompanyId) || null;

  const currentEmployees = activeCalcCompanyId
    ? (companyEmployees[activeCalcCompanyId] || DEFAULT_EMPLOYEES)
    : (selectedCompanyId !== 'all' && companyEmployees[selectedCompanyId] ? companyEmployees[selectedCompanyId] : DEFAULT_EMPLOYEES);

  const getAdminHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    loadCompanies();
    loadRuns();
  }, []);

  const loadCompanies = async () => {
    try {
      const res = await fetch('/api/admin/companies', { headers: getAdminHeaders() });
      const data = await res.json();
      if (res.ok && Array.isArray(data.companies)) {
        setCompanies(data.companies);
        if (data.companies.length > 0 && selectedCompanyId === 'all') {
          // pre-populate default employees for first company
          setCompanyEmployees({ [data.companies[0]._id]: DEFAULT_EMPLOYEES });
        }
      }
    } catch {
      // silent
    }
  };

  const loadRuns = async (companyId?: string) => {
    setLoading(true);
    try {
      const target = companyId && companyId !== 'all' ? `?companyId=${companyId}` : '';
      const res = await fetch(`/api/admin/payroll${target}`, { headers: getAdminHeaders() });
      const data = await res.json();
      if (res.ok && data.runs) {
        setRuns(data.runs);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyChange = (cId: string) => {
    setSelectedCompanyId(cId);
    loadRuns(cId);
  };

  // Open the Calculator Flow: Prompt to select company if multiple, or open directly
  const handleOpenCalculator = () => {
    if (companies.length === 0) {
      toast.error('No registered companies found. Please onboard an enterprise first.');
      return;
    }
    if (selectedCompanyId !== 'all') {
      setActiveCalcCompanyId(selectedCompanyId);
      setCalculatorModalOpen(true);
    } else {
      setCompanyPickerModalOpen(true);
    }
  };

  const handleSelectCompanyForCalc = (comp: CompanyOption) => {
    setActiveCalcCompanyId(comp._id);
    setSelectedCompanyId(comp._id);
    setCompanyPickerModalOpen(false);
    if (!companyEmployees[comp._id]) {
      setCompanyEmployees((prev) => ({ ...prev, [comp._id]: DEFAULT_EMPLOYEES }));
    }
    setCalculatorModalOpen(true);
  };

  // Employee update handlers
  const handleUpdateEmployee = (id: string, field: keyof EmployeeRow, val: any) => {
    if (!activeCalcCompanyId) return;
    const currentList = companyEmployees[activeCalcCompanyId] || DEFAULT_EMPLOYEES;
    const updatedList = currentList.map((emp) => {
      if (emp.id !== id) return emp;
      const updated = { ...emp, [field]: val };
      const basic = Number(field === 'basic' ? val : updated.basic) || 0;
      const workDays = Number(field === 'workDays' ? val : updated.workDays) || 30;
      const overtime = Number(field === 'overtime' ? val : updated.overtime) || 0;
      const taxableAllowance = Number(field === 'taxableAllowance' ? val : updated.taxableAllowance) || 0;
      const transport = Number(field === 'transport' ? val : updated.transport) || 0;
      const advance = Number(field === 'advance' ? val : updated.advance) || 0;
      const otherDeductions = Number(field === 'otherDeductions' ? val : updated.otherDeductions) || 0;
      const calc = computeEthiopianTax(basic, workDays, overtime, taxableAllowance, transport, advance, otherDeductions);
      return { ...updated, ...calc };
    });
    setCompanyEmployees((prev) => ({ ...prev, [activeCalcCompanyId]: updatedList }));
  };

  const handleAddEmployee = () => {
    if (!activeCalcCompanyId) return;
    const currentList = companyEmployees[activeCalcCompanyId] || DEFAULT_EMPLOYEES;
    const newEmp: EmployeeRow = {
      id: `emp-${Date.now()}`,
      name: `Staff Member ${currentList.length + 1}`,
      tin: '',
      basic: 10000,
      ...computeEthiopianTax(10000, 30),
    };
    setCompanyEmployees((prev) => ({ ...prev, [activeCalcCompanyId]: [...currentList, newEmp] }));
  };

  const handleRemoveEmployee = (id: string) => {
    if (!activeCalcCompanyId) return;
    const currentList = companyEmployees[activeCalcCompanyId] || DEFAULT_EMPLOYEES;
    if (currentList.length <= 1) {
      toast.warning('Must keep at least one employee in payroll.');
      return;
    }
    setCompanyEmployees((prev) => ({
      ...prev,
      [activeCalcCompanyId]: currentList.filter((e) => e.id !== id),
    }));
  };

  // CSV Import
  const handleImportStaffCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeCalcCompanyId) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        toast.error('CSV file has no data rows.');
        return;
      }
      const newRows: EmployeeRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim());
        if (parts.length >= 2) {
          const name = parts[0] || `Employee ${i}`;
          const basic = parseFloat(parts[1]) || parseFloat(parts[2]) || 10000;
          const days = parseFloat(parts[3]) || 30;
          newRows.push({
            id: `csv-emp-${Date.now()}-${i}`,
            name,
            tin: '',
            basic,
            ...computeEthiopianTax(basic, days),
          });
        }
      }
      if (newRows.length > 0) {
        setCompanyEmployees((prev) => ({ ...prev, [activeCalcCompanyId]: newRows }));
        toast.success(`Imported ${newRows.length} staff records for ${activeCompany?.fullName || 'Company'}!`);
      }
    };
    reader.readAsText(file);
  };

  // CSV Download
  const handleDownloadPayrollCSV = () => {
    const headers =
      'S/N,Name of Employees,Basic Salary,Worked Days,Basic Salary Earned During the Month,Over time,Taxable Allowance,Nontaxable Allowance (Transport),Pension 11%,Gross Earning,Total Taxable Earning,Total Income Tax,Pension 7%,Advance,Other Deductions,Total Deductions,Net Pay';
    const rows = currentEmployees.map(
      (e, idx) =>
        `${idx + 1},"${e.name}",${e.basic},${e.workDays},${e.earnedBasic},${e.overtime},${e.taxableAllowance},${e.transport},${e.pensionOrg},${e.gross},${e.taxableIncome},${e.tax},${e.pensionEmp},${e.advance},${e.otherDeductions},${e.totalDeductions},${e.net}`
    );
    const totalRow = `TOTAL,${totals.basic},,${totals.earnedBasic},,,,${totals.pensionOrg},${totals.gross},${totals.taxableIncome},${totals.tax},${totals.pensionEmp},,,,${totals.totalDeductions},${totals.net}`;
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows, totalRow].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `${(activeCompany?.fullName || 'Company').replace(/[^a-zA-Z0-9.-]/g, '_')}_Payroll_Sheet.csv`;
    link.click();
    toast.success('Payroll sheet CSV exported!');
  };

  // Totals
  const totals = currentEmployees.reduce(
    (acc, e) => ({
      basic: acc.basic + (e.basic || 0),
      earnedBasic: acc.earnedBasic + (e.earnedBasic || 0),
      gross: acc.gross + (e.gross || 0),
      taxableIncome: acc.taxableIncome + (e.taxableIncome || 0),
      pensionEmp: acc.pensionEmp + (e.pensionEmp || 0),
      pensionOrg: acc.pensionOrg + (e.pensionOrg || 0),
      tax: acc.tax + (e.tax || 0),
      totalDeductions: acc.totalDeductions + (e.totalDeductions || 0),
      net: acc.net + (e.net || 0),
    }),
    { basic: 0, earnedBasic: 0, gross: 0, taxableIncome: 0, pensionEmp: 0, pensionOrg: 0, tax: 0, totalDeductions: 0, net: 0 }
  );

  // Submit Run to Backend
  const handlePostPayroll = async () => {
    if (!activeCalcCompanyId) {
      toast.error('Select a company first.');
      return;
    }
    setPayrollPosting(true);
    try {
      const res = await fetch('/api/admin/payroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          company_id: activeCalcCompanyId,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          employees: currentEmployees,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post payroll run');

      toast.success(`Payroll posted successfully for ${activeCompany?.fullName || 'Company'}!`);
      setCalculatorModalOpen(false);
      loadRuns(selectedCompanyId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to post payroll');
    } finally {
      setPayrollPosting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Company Filter Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Ethiopian Payroll &amp; Income Tax Engine</h2>
            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
              Proclamation No. 979/2016
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Progressive brackets (0 to 35%), 7% employee pension, 11% employer pension. Filtered per enterprise.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Company Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={selectedCompanyId}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="text-xs bg-transparent text-foreground focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="all">All Companies</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.fullName} ({c.tinNumber})
                </option>
              ))}
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={() => loadRuns(selectedCompanyId)} disabled={loading} className="h-8 text-xs gap-1.5">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* Calculate Income Tax Button */}
          <Button size="sm" className="h-8 text-xs gap-1.5 shadow-2xs" onClick={handleOpenCalculator}>
            <Calculator className="w-3.5 h-3.5" />
            Calculate Income Tax &amp; Payroll
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-muted-foreground">Total Gross (Earned + 11%)</span>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl font-bold">{totals.gross.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span></div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{currentEmployees.length} Staff members</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-1 space-y-0"><span className="text-xs text-muted-foreground">Income Tax (Total)</span></CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl font-bold text-red-600 dark:text-red-400">{totals.tax.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span></div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Statutory 979/2016 brackets</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-1 space-y-0"><span className="text-xs text-muted-foreground">Pensions (7% + 11%)</span></CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {(totals.pensionEmp + totals.pensionOrg).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Emp: {totals.pensionEmp.toLocaleString()} | Org: {totals.pensionOrg.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-1 space-y-0"><span className="text-xs text-muted-foreground">Total Net Payout</span></CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl font-bold text-primary">{totals.net.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span></div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Post-deduction take-home</p>
          </CardContent>
        </Card>
      </div>

      {/* Staff Payroll Register Table Preview */}
      <Card className="border-border shadow-xs">
        <CardHeader className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Staff Payroll Register</CardTitle>
              {activeCompany && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {activeCompany.fullName}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Showing statutory breakdown for {currentEmployees.length} staff member{currentEmployees.length !== 1 ? 's' : ''}.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDownloadPayrollCSV} className="h-7 text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </Button>
            <Button size="sm" onClick={handleOpenCalculator} className="h-7 text-xs gap-1.5">
              <Edit3 className="w-3 h-3" />
              Edit in Calculator
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Staff Name</TableHead>
                <TableHead>TIN</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Transport</TableHead>
                <TableHead>Pension (7%)</TableHead>
                <TableHead>Org Pension (11%)</TableHead>
                <TableHead>Income Tax</TableHead>
                <TableHead className="font-semibold">Net Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentEmployees.map((emp) => (
                <TableRow key={emp.id} className="text-xs hover:bg-muted/30">
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{emp.tin || '—'}</TableCell>
                  <TableCell>{emp.basic.toLocaleString()} ETB</TableCell>
                  <TableCell>{emp.transport.toLocaleString()} ETB</TableCell>
                  <TableCell className="text-amber-600 dark:text-amber-400">-{emp.pensionEmp.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">+{emp.pensionOrg.toLocaleString()}</TableCell>
                  <TableCell className="text-red-600 dark:text-red-400">-{emp.tax.toLocaleString()}</TableCell>
                  <TableCell className="font-bold text-primary">{emp.net.toLocaleString()} ETB</TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="text-xs font-semibold bg-muted/30 border-t border-border">
                <TableCell colSpan={2}>Totals ({currentEmployees.length} Staff)</TableCell>
                <TableCell>{totals.basic.toLocaleString()} ETB</TableCell>
                <TableCell>—</TableCell>
                <TableCell className="text-amber-600">-{totals.pensionEmp.toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">+{totals.pensionOrg.toLocaleString()}</TableCell>
                <TableCell className="text-red-600">-{totals.tax.toLocaleString()}</TableCell>
                <TableCell className="text-primary">{totals.net.toLocaleString()} ETB</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Historical Payroll Runs */}
      {runs.length > 0 && (
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-sm font-semibold">Historical Payroll Runs</CardTitle>
            <CardDescription className="text-xs">
              Completed runs from Supabase public.payroll_runs
              {selectedCompanyId !== 'all' ? ` (Filtered for selected company)` : ' (All companies)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Enterprise</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Total Gross</TableHead>
                  <TableHead>Income Tax</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id} className="text-xs hover:bg-muted/30">
                    <TableCell className="font-medium">{r.company_name || 'Enterprise'}</TableCell>
                    <TableCell>{r.period_month}/{r.period_year}</TableCell>
                    <TableCell>{r.total_employees}</TableCell>
                    <TableCell>{(r.total_gross || 0).toLocaleString()} ETB</TableCell>
                    <TableCell className="text-red-600">{(r.total_income_tax || 0).toLocaleString()} ETB</TableCell>
                    <TableCell className="font-bold text-primary">{(r.total_net || 0).toLocaleString()} ETB</TableCell>
                    <TableCell>
                      <Badge variant={r.state === 'done' || r.state === 'confirmed' ? 'default' : 'secondary'} className="text-[10px] capitalize">
                        {r.state || 'Confirmed'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── 1. COMPANY SELECTION MODAL (When calculating payroll) ── */}
      <Dialog open={companyPickerModalOpen} onOpenChange={setCompanyPickerModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Select Enterprise for Payroll</DialogTitle>
            <DialogDescription className="text-xs">
              Choose the company or license under the main platform to calculate income tax and generate staff payslips for.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3 max-h-[350px] overflow-y-auto">
            {companies.map((c) => (
              <button
                key={c._id}
                onClick={() => handleSelectCompanyForCalc(c)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border text-xs text-left hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block">{c.fullName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">TIN: {c.tinNumber}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">Select</Badge>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCompanyPickerModalOpen(false)} className="text-xs h-8">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 2. FULL INTERACTIVE PAYROLL CALCULATOR MODAL ── */}
      <Dialog open={calculatorModalOpen} onOpenChange={setCalculatorModalOpen}>
        <DialogContent className="sm:max-w-[98vw] max-h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-3 border-b border-border flex flex-row items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold">
                  Ethiopian Payroll &amp; Income Tax Sheet
                </DialogTitle>
                {activeCompany && (
                  <Badge variant="default" className="text-[11px]">
                    {activeCompany.fullName}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                  Proclamation No. 979/2016 Compliant
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Exact Excel payroll formula: WorkDays prorated basic, Overtime, Taxable Allowance, 11% Org Pension, Non-taxable Transport, 7% Emp Pension, Progressive Tax (0–35%).
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2 mr-6">
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={handleImportStaffCSV} />
                <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted/50 transition-colors">
                  <Upload className="w-3 h-3" />
                  Import Staff CSV
                </span>
              </label>

              <Button size="sm" variant="outline" onClick={handleDownloadPayrollCSV} className="h-7 text-xs gap-1 border-border">
                <Download className="w-3 h-3" />
                Export CSV
              </Button>

              <Button size="sm" onClick={handleAddEmployee} className="h-7 text-xs gap-1">
                <Plus className="w-3 h-3" />
                Add Row
              </Button>
            </div>
          </DialogHeader>

          {/* Full Excel Layout Table */}
          <div className="flex-1 overflow-auto p-4">
            <div className="border border-border rounded-lg overflow-hidden">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 text-[11px]">
                    <TableHead className="w-8">S/N</TableHead>
                    <TableHead className="min-w-[140px]">Employee Name</TableHead>
                    <TableHead className="w-24">TIN</TableHead>
                    <TableHead className="w-24 text-right">Basic Salary</TableHead>
                    <TableHead className="w-16 text-center">Days</TableHead>
                    <TableHead className="w-24 text-right">Basic Earned</TableHead>
                    <TableHead className="w-20 text-right">Overtime</TableHead>
                    <TableHead className="w-24 text-right">Taxable Allow</TableHead>
                    <TableHead className="w-24 text-right">Transport</TableHead>
                    <TableHead className="w-24 text-right bg-emerald-50/50 dark:bg-emerald-950/20">Pension 11%</TableHead>
                    <TableHead className="w-24 text-right font-semibold">Gross</TableHead>
                    <TableHead className="w-24 text-right bg-amber-50/50 dark:bg-amber-950/20">Taxable</TableHead>
                    <TableHead className="w-24 text-right text-red-600 font-semibold">Income Tax</TableHead>
                    <TableHead className="w-24 text-right text-amber-600 font-semibold">Pension 7%</TableHead>
                    <TableHead className="w-20 text-right">Advance</TableHead>
                    <TableHead className="w-20 text-right">Other Ded</TableHead>
                    <TableHead className="w-24 text-right font-semibold">Total Ded</TableHead>
                    <TableHead className="w-28 text-right font-bold text-primary">Net Pay</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {currentEmployees.map((emp, idx) => (
                    <TableRow key={emp.id} className="hover:bg-muted/20 text-xs">
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={emp.name}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'name', e.target.value)}
                          className="h-7 text-xs px-2"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={emp.tin}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'tin', e.target.value)}
                          placeholder="001234..."
                          className="h-7 text-xs font-mono px-1.5"
                        />
                      </TableCell>
                      <TableCell className="p-1 text-right">
                        <Input
                          type="number"
                          value={emp.basic}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'basic', e.target.value)}
                          className="h-7 text-xs text-right font-mono px-1.5"
                        />
                      </TableCell>
                      <TableCell className="p-1 text-center">
                        <Input
                          type="number"
                          min="1"
                          max="30"
                          value={emp.workDays}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'workDays', e.target.value)}
                          className="h-7 text-xs text-center font-mono px-1"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] bg-muted/10">
                        {emp.earnedBasic.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="p-1 text-right">
                        <Input
                          type="number"
                          value={emp.overtime}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'overtime', e.target.value)}
                          className="h-7 text-xs text-right font-mono px-1.5"
                        />
                      </TableCell>
                      <TableCell className="p-1 text-right">
                        <Input
                          type="number"
                          value={emp.taxableAllowance}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'taxableAllowance', e.target.value)}
                          className="h-7 text-xs text-right font-mono px-1.5"
                        />
                      </TableCell>
                      <TableCell className="p-1 text-right">
                        <Input
                          type="number"
                          value={emp.transport}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'transport', e.target.value)}
                          className="h-7 text-xs text-right font-mono px-1.5"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20">
                        +{emp.pensionOrg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] font-semibold bg-muted/10">
                        {emp.gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20">
                        {emp.taxableIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] font-semibold text-red-600 bg-red-50/30 dark:bg-red-950/20">
                        -{emp.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] font-semibold text-amber-600 bg-amber-50/30 dark:bg-amber-950/20">
                        -{emp.pensionEmp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="p-1 text-right">
                        <Input
                          type="number"
                          value={emp.advance}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'advance', e.target.value)}
                          className="h-7 text-xs text-right font-mono px-1.5"
                        />
                      </TableCell>
                      <TableCell className="p-1 text-right">
                        <Input
                          type="number"
                          value={emp.otherDeductions}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'otherDeductions', e.target.value)}
                          className="h-7 text-xs text-right font-mono px-1.5"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] font-semibold text-red-600 bg-muted/10">
                        -{emp.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-primary bg-primary/5">
                        {emp.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="p-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveEmployee(emp.id)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Excel Style Grand Totals Row */}
                  <TableRow className="bg-muted/60 font-semibold text-xs border-t-2 border-border">
                    <TableCell colSpan={3}>TOTAL ({currentEmployees.length} EMPLOYEES)</TableCell>
                    <TableCell className="text-right font-mono">{totals.basic.toLocaleString()}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-mono">{totals.earnedBasic.toLocaleString()}</TableCell>
                    <TableCell colSpan={3}></TableCell>
                    <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-400">
                      +{totals.pensionOrg.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">{totals.gross.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-amber-700 dark:text-amber-400">
                      {totals.taxableIncome.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600 font-bold">
                      -{totals.tax.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-amber-600 font-bold">
                      -{totals.pensionEmp.toLocaleString()}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-right font-mono text-red-600 font-bold">
                      -{totals.totalDeductions.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary text-sm">
                      {totals.net.toLocaleString()} ETB
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border flex items-center justify-between shrink-0 bg-background">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Generating for: <strong className="text-foreground">{activeCompany?.fullName || 'Selected Enterprise'}</strong></span>
              <span>•</span>
              <span>Total Net Payout: <strong className="text-primary font-mono">{totals.net.toLocaleString()} ETB</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCalculatorModalOpen(false)} className="h-8 text-xs">
                Close
              </Button>
              <Button size="sm" onClick={handlePostPayroll} disabled={payrollPosting} className="h-8 text-xs gap-1.5 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {payrollPosting ? 'Posting Run...' : `Post & Confirm Payroll Run for ${activeCompany?.fullName?.slice(0, 15) || 'Company'}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
