'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Users, RefreshCw, Upload, Plus, Printer } from 'lucide-react';
import { toast } from 'sonner';

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

interface Employee {
  id: string;
  name: string;
  tin: string;
  basic: number;
  transport: number;
}

function computeEthiopianTax(basic: number, transport: number) {
  const exemptTransport = Math.min(transport, 2200, basic * 0.25);
  const taxableIncome = basic + (transport - exemptTransport);
  let tax = 0;
  if (taxableIncome <= 2000) tax = 0;
  else if (taxableIncome <= 4000) tax = (taxableIncome - 2000) * 0.10;
  else if (taxableIncome <= 7000) tax = 200 + (taxableIncome - 4000) * 0.15;
  else if (taxableIncome <= 10000) tax = 650 + (taxableIncome - 7000) * 0.20;
  else if (taxableIncome <= 14000) tax = 1250 + (taxableIncome - 10000) * 0.25;
  else if (taxableIncome <= 19000) tax = 2250 + (taxableIncome - 14000) * 0.30;
  else tax = 3750 + (taxableIncome - 19000) * 0.35;

  const pensionEmp = Math.round(basic * 0.07);
  const pensionOrg = Math.round(basic * 0.11);
  const net = Math.round(basic + transport - pensionEmp - tax);
  return { pensionEmp, pensionOrg, tax: Math.round(tax), net };
}

const SAMPLE_EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Abebe Bekele', tin: '1234567890', basic: 25000, transport: 2000 },
  { id: 'e2', name: 'Hana Tesfaye', tin: '0987654321', basic: 18000, transport: 1500 },
  { id: 'e3', name: 'Dawit Mengistu', tin: '0011223344', basic: 35000, transport: 2200 },
];

export default function AdminPayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>(SAMPLE_EMPLOYEES);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: '', tin: '', basic: 0, transport: 0 });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/payroll', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.runs) setRuns(data.runs);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const totals = employees.reduce((acc, emp) => {
    const c = computeEthiopianTax(emp.basic, emp.transport);
    return {
      gross: acc.gross + emp.basic + emp.transport,
      pensionEmp: acc.pensionEmp + c.pensionEmp,
      pensionOrg: acc.pensionOrg + c.pensionOrg,
      tax: acc.tax + c.tax,
      net: acc.net + c.net,
    };
  }, { gross: 0, pensionEmp: 0, pensionOrg: 0, tax: 0, net: 0 });

  const handleAddEmployee = () => {
    if (!newEmp.name || !newEmp.basic) { toast.error('Name and basic salary required'); return; }
    setEmployees((prev) => [...prev, { ...newEmp, id: `e${Date.now()}` }]);
    setNewEmp({ name: '', tin: '', basic: 0, transport: 0 });
    toast.success('Employee added to calculator');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Ethiopian Payroll Engine</h2>
            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
              August 2025 Reform
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Progressive income tax 0–35%, 7% employee pension, 11% employer pension (Odoo hr_payroll_ethiopia).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-7 text-xs gap-1.5">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setCalculatorOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Payroll Calculator
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-muted-foreground">Total Gross</span>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl font-bold">{totals.gross.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span></div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-1 space-y-0"><span className="text-xs text-muted-foreground">Income Tax (Total)</span></CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl font-bold text-red-600 dark:text-red-400">{totals.tax.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span></div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-1 space-y-0"><span className="text-xs text-muted-foreground">Pension (Employer 11%)</span></CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{totals.pensionOrg.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span></div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-1 space-y-0"><span className="text-xs text-muted-foreground">Total Net Pay</span></CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl font-bold text-primary">{totals.net.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Live Calculator Table */}
      <Card className="border-border shadow-xs">
        <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Live Payroll Calculator</CardTitle>
            <CardDescription className="text-xs">2025 Ethiopian progressive tax brackets applied in real-time.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
              <Upload className="w-3 h-3" />
              Import CSV
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
              <Printer className="w-3 h-3" />
              Print Payslips
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Employee</TableHead>
                <TableHead>TIN</TableHead>
                <TableHead>Basic</TableHead>
                <TableHead>Transport</TableHead>
                <TableHead>Pension 7%</TableHead>
                <TableHead>Org Pension 11%</TableHead>
                <TableHead>Income Tax</TableHead>
                <TableHead className="font-semibold">Net Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => {
                const c = computeEthiopianTax(emp.basic, emp.transport);
                return (
                  <TableRow key={emp.id} className="text-xs hover:bg-muted/30">
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{emp.tin || '—'}</TableCell>
                    <TableCell>{emp.basic.toLocaleString()} ETB</TableCell>
                    <TableCell>{emp.transport.toLocaleString()} ETB</TableCell>
                    <TableCell className="text-amber-600 dark:text-amber-400">-{c.pensionEmp.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">+{c.pensionOrg.toLocaleString()}</TableCell>
                    <TableCell className="text-red-600 dark:text-red-400">-{c.tax.toLocaleString()}</TableCell>
                    <TableCell className="font-bold text-primary">{c.net.toLocaleString()} ETB</TableCell>
                  </TableRow>
                );
              })}
              {/* Totals Row */}
              <TableRow className="text-xs font-semibold bg-muted/30 border-t border-border">
                <TableCell colSpan={4} className="text-right text-muted-foreground">Totals ({employees.length} employees)</TableCell>
                <TableCell className="text-amber-600">-{totals.pensionEmp.toLocaleString()}</TableCell>
                <TableCell>+{totals.pensionOrg.toLocaleString()}</TableCell>
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
            <CardDescription className="text-xs">Completed payroll runs from Supabase public.payroll_runs</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Company</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id} className="text-xs hover:bg-muted/30">
                    <TableCell className="font-medium">{r.company_name || '—'}</TableCell>
                    <TableCell>{r.period_month}/{r.period_year}</TableCell>
                    <TableCell>{r.total_employees}</TableCell>
                    <TableCell>{(r.total_gross || 0).toLocaleString()} ETB</TableCell>
                    <TableCell className="text-red-600">{(r.total_income_tax || 0).toLocaleString()} ETB</TableCell>
                    <TableCell className="font-bold text-primary">{(r.total_net || 0).toLocaleString()} ETB</TableCell>
                    <TableCell>
                      <Badge variant={r.state === 'done' ? 'default' : 'secondary'} className="text-[10px] capitalize">{r.state}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Employee Dialog */}
      <Dialog open={calculatorOpen} onOpenChange={setCalculatorOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add Employee to Calculator</DialogTitle>
            <DialogDescription className="text-xs">Tax computed live with 2025 Ethiopian brackets.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Full Name *</Label>
              <Input placeholder="Abebe Kebele" value={newEmp.name} onChange={(e) => setNewEmp((p) => ({ ...p, name: e.target.value }))} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">TIN</Label>
              <Input placeholder="1234567890" value={newEmp.tin} onChange={(e) => setNewEmp((p) => ({ ...p, tin: e.target.value }))} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Basic Salary (ETB)</Label>
              <Input type="number" placeholder="25000" value={newEmp.basic || ''} onChange={(e) => setNewEmp((p) => ({ ...p, basic: parseFloat(e.target.value) || 0 }))} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Transport Allowance (ETB)</Label>
              <Input type="number" placeholder="2000" value={newEmp.transport || ''} onChange={(e) => setNewEmp((p) => ({ ...p, transport: parseFloat(e.target.value) || 0 }))} className="h-9 text-xs" />
            </div>
            {newEmp.basic > 0 && (() => {
              const c = computeEthiopianTax(newEmp.basic, newEmp.transport);
              return (
                <div className="col-span-2 grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-lg border border-border text-xs">
                  <div><p className="text-muted-foreground">Income Tax</p><p className="font-bold text-red-600">{c.tax.toLocaleString()} ETB</p></div>
                  <div><p className="text-muted-foreground">Net Pay</p><p className="font-bold text-primary">{c.net.toLocaleString()} ETB</p></div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCalculatorOpen(false)} className="text-xs h-8">Cancel</Button>
            <Button size="sm" onClick={handleAddEmployee} className="text-xs h-8 gap-1.5">
              <Plus className="w-3 h-3" />
              Add Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

