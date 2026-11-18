'use client';

import { useState, useEffect, useRef } from 'react';
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
  Building2,
  LogOut,
  Receipt,
  FileBox,
  Users,
  FileText,
  Boxes,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Plus,
  Upload,
  Download,
  CheckCircle2,
  Clock,
  Printer,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Calculator,
  RefreshCw,
  Trash2,
  Edit3,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Save,
  Check,
  ArrowLeft,
  Image as ImageIcon,
  Eye,
  ExternalLink,
  FolderOpen
} from 'lucide-react';
import NewReportModal from '@/components/modals/new-report-modal';
import { toast } from 'sonner';

interface UserDashboardProps {
  user: {
    id: string;
    fullName: string;
    email: string;
    companyAddress: string;
    tinNumber: string;
    companyId?: string;
  } | null;
  onLogout: () => void;
}

interface EmployeeRow {
  id: string;
  name: string;
  tin: string;
  basic: number;
  transport: number;
  overtime: number;
  otherAllowance: number;
  workDays: number;
  gross: number;
  pensionEmp: number;
  pensionOrg: number;
  taxableIncome: number;
  tax: number;
  net: number;
}

export default function UserDashboard({ user, onLogout }: UserDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'receipts' | 'fileboxes' | 'payroll' | 'agreements' | 'stock' | 'approvals'
  >('overview');

  // Reports Modal
  const [isNewReportModalOpen, setIsNewReportModalOpen] = useState(false);

  // ==========================================
  // 1. TREASURY & BANK BALANCE STATE
  // ==========================================
  const [treasury, setTreasury] = useState({
    availableBalance: 500000,
    openingDeposit: 500000,
    totalInflow: 0,
    totalOutflow: 0,
    isBelowThreshold: false,
    dropPercent: 0,
  });
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankAction, setBankAction] = useState<'set_opening' | 'deposit' | 'withdrawal'>('set_opening');
  const [bankAmount, setBankAmount] = useState<number>(500000);
  const [bankDesc, setBankDesc] = useState('Initial Company Bank Opening Deposit');
  const [bankLoading, setBankLoading] = useState(false);

  const fetchTreasury = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/company/treasury', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) setTreasury(data.summary);
      }
    } catch (err) {
      console.error('Failed to load treasury:', err);
    }
  };

  const handleBankSubmit = async () => {
    if (!bankAmount || bankAmount <= 0) {
      toast.error('Please enter a positive amount.');
      return;
    }
    setBankLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/company/treasury', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: bankAction,
          amount: bankAmount,
          description: bankDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update bank balance');
      toast.success(
        bankAction === 'set_opening'
          ? 'Initial Opening Bank Balance updated successfully'
          : `Bank ${bankAction} recorded.`
      );
      setIsBankModalOpen(false);
      fetchTreasury();
    } catch (err: any) {
      toast.error(err.message || 'Error updating bank balance');
    } finally {
      setBankLoading(false);
    }
  };

  // ==========================================
  // 2. RECEIPT INTAKE & OCR STATE
  // ==========================================
  const [receiptsList, setReceiptsList] = useState<any[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  const [receiptUntaxed, setReceiptUntaxed] = useState<number | null>(null);
  const [receiptWhtRate, setReceiptWhtRate] = useState<number>(0);
  const [receiptType, setReceiptType] = useState<'purchase' | 'sale'>('purchase');
  const [fsNumber, setFsNumber] = useState('');
  const [machineNumber, setMachineNumber] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [partnerTin, setPartnerTin] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [invoiceFileName, setInvoiceFileName] = useState('');
  const [cashSlipFileName, setCashSlipFileName] = useState('');
  const [invoiceFileObj, setInvoiceFileObj] = useState<File | null>(null);
  const [cashSlipFileObj, setCashSlipFileObj] = useState<File | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [ocrEngine, setOcrEngine] = useState<string>('');
  const [confidenceNotes, setConfidenceNotes] = useState<string[]>([]);

  const safeUntaxed = receiptUntaxed ?? 0;
  const calculatedVat = Math.round(safeUntaxed * 0.15 * 100) / 100;
  const calculatedWht = Math.round(safeUntaxed * (receiptWhtRate / 100) * 100) / 100;
  const calculatedTotal = Math.round((safeUntaxed + calculatedVat) * 100) / 100;

  const fetchReceipts = async () => {
    setReceiptsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/company/receipts', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.receipts && data.receipts.length > 0) {
          setReceiptsList(data.receipts);
        } else {
          setReceiptsList([]);
        }
      }
    } catch (err) {
      console.error('Failed to load receipts:', err);
    } finally {
      setReceiptsLoading(false);
    }
  };

  const handleOcrUpload = async (file: File, type: 'invoice' | 'cash') => {
    const curInvoice = type === 'invoice' ? file : invoiceFileObj;
    const curCash = type === 'cash' ? file : cashSlipFileObj;

    if (type === 'invoice') {
      setInvoiceFileName(file.name);
      setInvoiceFileObj(file);
    } else {
      setCashSlipFileName(file.name);
      setCashSlipFileObj(file);
    }

    setOcrLoading(true);
    toast.info(`Extracting data from ${file.name}...`);
    try {
      const formData = new FormData();
      if (curInvoice) formData.append('companyDocument', curInvoice);
      if (curCash) formData.append('posReceipt', curCash);
      if (user?.tinNumber) formData.append('companyTin', user.tinNumber);
      if (user?.fullName) formData.append('companyName', user.fullName);

      const res = await fetch('/api/ocr/extract-receipt', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.data) {
        const d = json.data;
        setFsNumber(d.fs_number ?? '');
        setMachineNumber(d.machine_number ?? '');
        setPartnerName(d.partner_name ?? '');
        setPartnerTin(d.partner_tin ?? '');
        setReceiptUntaxed(d.untaxed_amount ?? null);
        setReceiptWhtRate(d.wht_rate ?? 0);
        if (d.receipt_date) setReceiptDate(d.receipt_date);
        if (d.classification?.toLowerCase().includes('sale')) setReceiptType('sale');
        else setReceiptType('purchase');
        if (json.rawText) setRawOcrText(json.rawText);
        setOcrEngine(json.engine ?? 'unknown');
        setConfidenceNotes(d.confidence_notes ?? []);
        const engineLabel = json.engine === 'vision-llm' ? 'Gemini Vision' : 'Tesseract Fallback';
        toast.success(`${engineLabel}: FS ${d.fs_number || '—'}, Total ${d.total_amount?.toLocaleString() ?? '—'} ETB`);
      } else {
        toast.warning('Extraction returned no data. Fill fields manually.');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      toast.error('Extraction error. Fields can be filled manually.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleClearReceipt = () => {
    setFsNumber('');
    setMachineNumber('');
    setPartnerName('');
    setPartnerTin('');
    setReceiptUntaxed(null);
    setReceiptWhtRate(0);
    setReceiptDate('');
    setReceiptType('purchase');
    setInvoiceFileName('');
    setCashSlipFileName('');
    setInvoiceFileObj(null);
    setCashSlipFileObj(null);
    setRawOcrText('');
    setOcrEngine('');
    setConfidenceNotes([]);
  };

  const handleRegisterReceipt = async () => {
    if (!fsNumber || !partnerName) {
      toast.error('FS Number and Partner Name are required.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/company/receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fs_number: fsNumber,
          machine_number: machineNumber,
          receipt_type: receiptType,
          partner_name: partnerName,
          partner_tin: partnerTin,
          untaxed_amount: safeUntaxed,
          vat_15: calculatedVat,
          wht_3: calculatedWht,
          total_amount: calculatedTotal,
          date: receiptDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register receipt');

      toast.success('Receipt registered with duplicate detection check!');
      setIsReceiptModalOpen(false);
      fetchReceipts();
      fetchTreasury(); // update treasury
    } catch (err: any) {
      toast.error(err.message || 'Error registering receipt');
    }
  };

  // ==========================================
  // 3. ETHIOPIAN PAYROLL & TAX ENGINE
  // ==========================================
  const computeEthiopianTax = (basic: number, transport: number, overtime: number = 0, other: number = 0) => {
    const exemptTransport = Math.min(transport, 2200, basic * 0.25);
    const taxableAllowances = (transport - exemptTransport) + overtime + other;
    const gross = basic + transport + overtime + other;
    const pensionBase = basic;
    const pensionEmp = Math.round(pensionBase * 0.07 * 100) / 100;
    const pensionOrg = Math.round(pensionBase * 0.11 * 100) / 100;
    const taxableIncome = Math.max(0, basic + taxableAllowances - pensionEmp);

    // 2025 Progressive Tax Brackets (Proclamation rules)
    let tax = 0;
    if (taxableIncome <= 2000) tax = 0;
    else if (taxableIncome <= 4000) tax = (taxableIncome - 2000) * 0.10;
    else if (taxableIncome <= 7000) tax = 200 + (taxableIncome - 4000) * 0.15;
    else if (taxableIncome <= 10000) tax = 650 + (taxableIncome - 7000) * 0.20;
    else if (taxableIncome <= 14000) tax = 1250 + (taxableIncome - 10000) * 0.25;
    else if (taxableIncome <= 19000) tax = 2250 + (taxableIncome - 14000) * 0.30;
    else tax = 3750 + (taxableIncome - 19000) * 0.35;

    tax = Math.round(tax * 100) / 100;
    const net = Math.round((gross - pensionEmp - tax) * 100) / 100;
    return { gross, pensionEmp, pensionOrg, taxableIncome, tax, net };
  };

  const [employees, setEmployees] = useState<EmployeeRow[]>([
    {
      id: 'emp-1',
      name: 'Abebe Bekele',
      tin: '1234567890',
      basic: 25000,
      transport: 2000,
      overtime: 0,
      otherAllowance: 0,
      workDays: 30,
      ...computeEthiopianTax(25000, 2000),
    },
    {
      id: 'emp-2',
      name: 'Hana Tesfaye',
      tin: '0987654321',
      basic: 18000,
      transport: 1500,
      overtime: 0,
      otherAllowance: 0,
      workDays: 30,
      ...computeEthiopianTax(18000, 1500),
    },
    {
      id: 'emp-3',
      name: 'Dawit Mengistu',
      tin: '0011223344',
      basic: 35000,
      transport: 2200,
      overtime: 1500,
      otherAllowance: 0,
      workDays: 30,
      ...computeEthiopianTax(35000, 2200, 1500),
    },
  ]);

  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<string | null>(null);
  const [payrollPosting, setPayrollPosting] = useState(false);

  const fetchPayroll = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/company/payroll', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lastCalculatedAt) setLastCalculatedAt(data.lastCalculatedAt);
        if (data.payslips && data.payslips.length > 0) {
          const loadedRows: EmployeeRow[] = data.payslips.map((p: any, idx: number) => ({
            id: p.id || `emp-load-${idx}`,
            name: p.employee_name,
            tin: p.employee_tin || '',
            basic: Number(p.basic_salary),
            transport: Number(p.transport_allowance),
            overtime: 0,
            otherAllowance: 0,
            workDays: 30,
            ...computeEthiopianTax(Number(p.basic_salary), Number(p.transport_allowance)),
          }));
          setEmployees(loadedRows);
        }
      }
    } catch (err) {
      console.error('Failed to load payroll:', err);
    }
  };

  const handleUpdateEmployee = (id: string, field: keyof EmployeeRow, val: any) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== id) return emp;
        const updated = { ...emp, [field]: val };
        const basic = Number(field === 'basic' ? val : updated.basic) || 0;
        const transport = Number(field === 'transport' ? val : updated.transport) || 0;
        const overtime = Number(field === 'overtime' ? val : updated.overtime) || 0;
        const other = Number(field === 'otherAllowance' ? val : updated.otherAllowance) || 0;
        const calc = computeEthiopianTax(basic, transport, overtime, other);
        return { ...updated, ...calc };
      })
    );
  };

  const handleAddEmployeeRow = () => {
    const newId = `emp-${Date.now()}`;
    const newEmp: EmployeeRow = {
      id: newId,
      name: `Staff Member ${employees.length + 1}`,
      tin: '',
      basic: 15000,
      transport: 1500,
      overtime: 0,
      otherAllowance: 0,
      workDays: 30,
      ...computeEthiopianTax(15000, 1500),
    };
    setEmployees((prev) => [...prev, newEmp]);
  };

  const handleRemoveEmployeeRow = (id: string) => {
    if (employees.length <= 1) {
      toast.warning('Must keep at least one employee in payroll.');
      return;
    }
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  const handleImportStaffCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim());
        if (parts.length >= 2) {
          const name = parts[0] || `Employee ${i}`;
          const tin = parts[1] || '';
          const basic = parseFloat(parts[2]) || 12000;
          const transport = parseFloat(parts[3]) || 1000;
          newRows.push({
            id: `csv-emp-${Date.now()}-${i}`,
            name,
            tin,
            basic,
            transport,
            overtime: 0,
            otherAllowance: 0,
            workDays: 30,
            ...computeEthiopianTax(basic, transport),
          });
        }
      }

      if (newRows.length > 0) {
        setEmployees(newRows);
        toast.success(`Imported ${newRows.length} staff records from CSV! Opening calculator...`);
        setIsPayrollModalOpen(true);
      }
    };
    reader.readAsText(file);
  };

  const payrollTotals = employees.reduce(
    (acc, e) => ({
      gross: acc.gross + e.gross,
      pensionEmp: acc.pensionEmp + e.pensionEmp,
      pensionOrg: acc.pensionOrg + e.pensionOrg,
      tax: acc.tax + e.tax,
      net: acc.net + e.net,
    }),
    { gross: 0, pensionEmp: 0, pensionOrg: 0, tax: 0, net: 0 }
  );

  const totalPayrollDeduction = Math.round((payrollTotals.net + payrollTotals.tax + payrollTotals.pensionEmp + payrollTotals.pensionOrg) * 100) / 100;

  const handleConfirmPayrollRun = async () => {
    setPayrollPosting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/company/payroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          employees,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post payroll');

      toast.success(`Payroll processed! ${totalPayrollDeduction.toLocaleString()} ETB deducted from Company Bank Balance.`);
      setLastCalculatedAt(new Date().toISOString());
      setIsPayrollModalOpen(false);
      fetchTreasury(); // Updates available bank balance
    } catch (err: any) {
      toast.error(err.message || 'Error processing payroll');
    } finally {
      setPayrollPosting(false);
    }
  };

  const handleDownloadPayrollCSV = () => {
    const headers = 'Employee Name,TIN,Basic Salary,Transport Allowance,Overtime,Gross Salary,Employee Pension 7%,Employer Pension 11%,Taxable Income,Income Tax,Net Pay';
    const rows = employees.map(
      (e) => `"${e.name}","${e.tin}",${e.basic},${e.transport},${e.overtime},${e.gross},${e.pensionEmp},${e.pensionOrg},${e.taxableIncome},${e.tax},${e.net}`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ethiopia_Payroll_Run_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Payroll CSV downloaded!');
  };

  // ==========================================
  // 4. WORD-STYLE AGREEMENT EDITOR STATE
  // ==========================================
  const DEFAULT_PUBLISHED_AGREEMENTS = [
    {
      id: 'tpl-1',
      title: 'Standard Ethiopian Employment Agreement (የቅጥር ውል ስምምነት)',
      category: 'Labour / HR',
      desc: 'Compliant with Labour Proclamation No. 1156/2019. Covers employee job duties, probation period, monthly salary, 7% & 11% pension deductions, annual leave, and lawful termination terms.',
      updatedAt: '2026-11-15',
      html: `
<h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 16px;">
  የቅጥር ውል ስምምነት (EMPLOYMENT AGREEMENT)
</h2>
<p style="margin-bottom: 12px;">
  ይህ የቅጥር ውል ስምምነት በአሰሪው <strong>${user?.fullName || 'Amis Financial Enterprise'}</strong> (የግብር ከፋይ መለያ ቁጥር: <strong>${user?.tinNumber || '0012938475'}</strong>) እና በሰራተኛው መካከል በአሰሪና ሰራተኛ ጉዳይ አዋጅ ቁጥር 1156/2011 (Labour Proclamation No. 1156/2019) መሰረት ተዘጋጅቶ ዛሬ ተፈርሟል።
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  1. የስራ መደብ እና ኃላፊነት (Job Position & Duties)
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  ሰራተኛው በተሰጠው የሥራ ዝርዝር መሠረት ሙያዊ ግዴታውን በታማኝነት፣ በጥራት እና በትጋት ለማከናወን ተስማምቷል። የስራ ቦታው በአዲስ አበባ ዋና መ/ቤት ይሆናል።
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  2. ደመወዝ እና የግብር ተቀናሽ (Compensation & Statutory Deductions)
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  የሰራተኛው ወርሃዊ መሰረታዊ ደመወዝ በሕግ በተደነገገው መሠረት የሚከፈል ሲሆን፣ በ2017/2025 የገቢ ግብር አዋጅ መሰረት ተገቢው የስራ ግብር እና 7% የሰራተኛ እንዲሁም 11% የአሰሪ የጡረታ መዋጮ ተቀናሽ ተደርጎ በወቅቱ ለመንግስት ገቢ ይደረጋል።
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  3. የውል ፀናበት ጊዜ እና ማቋረጥ (Term & Termination)
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  ይህ ውል ላልተወሰነ ጊዜ የፀና ሲሆን በአዋጅ ቁጥር 1156/2011 በተደነገጉት ድንጋጌዎች መሠረት ብቻ ይቋረጣል።
</p>
<br/>
<div style="display: flex; justify-content: space-between; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
  <div><strong>አሰሪ (Employer):</strong> ______________________</div>
  <div><strong>ሰራተኛ (Employee):</strong> ______________________</div>
</div>
      `,
    },
    {
      id: 'tpl-2',
      title: 'Commercial Property & Office Lease Agreement (የቢሮ ኪራይ ውል)',
      category: 'Real Estate / Leases',
      desc: 'Commercial rental agreement for premises in Addis Ababa. Includes monthly rental rate, security deposit, utility charges, maintenance obligations, and tax withholding compliance.',
      updatedAt: '2026-11-10',
      html: `
<h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 16px;">
  የቢሮና የንግድ ቤት ኪራይ ውል ስምምነት (COMMERCIAL LEASE AGREEMENT)
</h2>
<p style="margin-bottom: 12px;">
  ይህ የኪራይ ውል ስምምነት በአከራይ እና በተከራይ <strong>${user?.fullName || 'Amis Financial Enterprise'}</strong> (TIN: <strong>${user?.tinNumber || '0012938475'}</strong>) መካከል በአዲስ አበባ ከተማ ተደርጓል።
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  1. የተከራየው ንብረት እና የኪራይ ዋጋ
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  ተከራዩ የተጠቀሰውን የንግድ ቢሮ በወር የተስማሙበትን ኪራይ በየወሩ መጀመሪያ 5 ቀናት ውስጥ ለመክፈል ተስማምቷል። ተከራዩ በሕግ የተጣለውን የኪራይ ገቢ ግብር ተቀናሽ (Withholding Tax) በማድረግ ደረሰኝ ይሰጣል።
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  2. የውል ቆይታ
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  ይህ ውል ለአንድ (1) ዓመት የፀና ሆኖ በሁለቱም ወገኖች የጋራ ስምምነት ሊታደስ ይችላል።
</p>
<br/>
<div style="display: flex; justify-content: space-between; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
  <div><strong>አከራይ (Landlord):</strong> ______________________</div>
  <div><strong>ተከራይ (Tenant):</strong> ______________________</div>
</div>
      `,
    },
    {
      id: 'tpl-3',
      title: 'Equipment & Goods Supply Agreement (የዕቃና መሣሪያዎች አቅርቦት ውል)',
      category: 'Procurement / Stock',
      desc: 'Goods procurement terms covering quality inspection, VAT 15% invoicing, delivery timelines, and 3% withholding tax compliance on transactions above 10,000 ETB.',
      updatedAt: '2026-11-08',
      html: `
<h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 16px;">
  የዕቃና መሣሪያዎች አቅርቦት ውል (GOODS SUPPLY AGREEMENT)
</h2>
<p style="margin-bottom: 12px;">
  ይህ የአቅርቦት ውል በአቅራቢ እና በገዢ <strong>${user?.fullName || 'Amis Financial Enterprise'}</strong> መካከል ተደርጓል።
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  1. የዕቃው ዓይነት እና የጥራት ደረጃ
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  አቅራቢው በግዢ ትዕዛዙ (Purchase Order) ላይ የተመለከቱትን እቃዎች በተገቢው ጥራት እና መጠን በወቅቱ የማስረከብ ኃላፊነት አለበት።
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  2. ክፍያ እና የታክስ ደረሰኝ
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  ክፍያው የሚፈጸመው ሕጋዊ የገንዘብ መቀበያ የጥሬ ገንዘብ መመዝገቢያ ማሽን ደረሰኝ (Fiscal Cash Register Receipt) ሲቀርብ ብቻ ነው። 15% ተጨማሪ እሴት ታክስ (VAT) እና 3% የዊዝሆልዲንግ ታክስ በሕጉ መሠረት ተፈጻሚ ይሆናል።
</p>
<br/>
<div style="display: flex; justify-content: space-between; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
  <div><strong>አቅራቢ (Supplier):</strong> ______________________</div>
  <div><strong>ገዢ (Buyer):</strong> ______________________</div>
</div>
      `,
    },
  ];

  const [agreementsList, setAgreementsList] = useState<any[]>(DEFAULT_PUBLISHED_AGREEMENTS);
  const [selectedAgreement, setSelectedAgreement] = useState<any | null>(null);
  const [activeAgreement, setActiveAgreement] = useState<{
    id?: string;
    templateId?: string;
    title: string;
    html: string;
  }>({
    title: DEFAULT_PUBLISHED_AGREEMENTS[0].title,
    html: DEFAULT_PUBLISHED_AGREEMENTS[0].html,
  });

  const [editorFont, setEditorFont] = useState('system-ui, sans-serif');
  const [editorFontSize, setEditorFontSize] = useState('14px');
  const [editorSaving, setEditorSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const fetchAgreements = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/company/agreements', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.templates && data.templates.length > 0) {
          setAgreementsList(data.templates);
        }
      }
    } catch (err) {
      console.error('Failed to load agreements:', err);
    }
  };

  const handleOpenAgreementInEditor = (item: any) => {
    setSelectedAgreement(item);
    setActiveAgreement({
      id: item.id,
      templateId: item.template_id || item.id,
      title: item.title || item.name,
      html: item.html || item.body || DEFAULT_PUBLISHED_AGREEMENTS[0].html,
    });
  };

  const executeEditorCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setActiveAgreement((prev) => ({ ...prev, html: editorRef.current?.innerHTML || prev.html }));
    }
  };

  const handleSaveAgreement = async () => {
    setEditorSaving(true);
    const content = editorRef.current ? editorRef.current.innerHTML : activeAgreement.html;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/company/agreements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: activeAgreement.title,
          bodyHtml: content,
          templateId: activeAgreement.templateId,
          agreementId: activeAgreement.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save agreement');
      toast.success('Agreement updated with rich Word formatting!');
    } catch (err: any) {
      toast.error(err.message || 'Error saving agreement');
    } finally {
      setEditorSaving(false);
    }
  };

  // ==========================================
  // 5. FILE BOXES STATE & HANDLERS (ODDO PORT)
  // ==========================================
  const FILE_BOX_CATEGORIES = [
    { key: 'petty_cash', title: 'Petty Cash', desc: 'Petty cash payment vouchers and stamps' },
    { key: 'income_tax_pension', title: 'Income Tax & Pension', desc: 'Monthly ERCA declarations & pension receipts' },
    { key: 'purchase_receipt', title: 'Purchase Receipts', desc: 'Official vendor cash receipts & withholding notes' },
    { key: 'sales_receipt', title: 'Sales Receipts', desc: 'Customer invoices & duplicate register copies' },
    { key: 'agreement', title: 'Agreements', desc: 'Lease contracts, supplier agreements & terms' },
    { key: 'z_report', title: 'Z-Reports', desc: 'Fiscal cash register end-of-day printouts' },
  ];

  const [fileBoxes, setFileBoxes] = useState<any[]>([]);
  const [fileBoxCounts, setFileBoxCounts] = useState<Record<string, number>>({
    petty_cash: 0,
    income_tax_pension: 0,
    purchase_receipt: 0,
    sales_receipt: 0,
    agreement: 0,
    z_report: 0,
  });
  const [selectedFileBoxCat, setSelectedFileBoxCat] = useState<string | null>(null);
  const [isFileBoxModalOpen, setIsFileBoxModalOpen] = useState(false);
  const [fbUploadCat, setFbUploadCat] = useState('petty_cash');
  const [fbUploadName, setFbUploadName] = useState('');
  const [fbUploadNotes, setFbUploadNotes] = useState('');
  const [fbUploadFile, setFbUploadFile] = useState<File | null>(null);
  const [fbUploading, setFbUploading] = useState(false);

  const fetchFileBoxes = async (cat?: string) => {
    try {
      const token = localStorage.getItem('token');
      const url = cat ? `/api/company/fileboxes?category=${cat}` : '/api/company/fileboxes';
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.files) setFileBoxes(data.files);
        if (data.counts) setFileBoxCounts(data.counts);
      }
    } catch (err) {
      console.error('Failed to load fileboxes:', err);
    }
  };

  const handleFileBoxUploadSubmit = async () => {
    if (!fbUploadFile || !fbUploadName) {
      toast.error('Document title and a file are required.');
      return;
    }
    setFbUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', fbUploadFile);

      const upRes = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const upJson = await upRes.json();
      if (!upRes.ok) throw new Error(upJson.error || 'File upload failed');

      const storagePath = upJson.url || upJson.path || '';

      const saveRes = await fetch('/api/company/fileboxes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: fbUploadName,
          category: fbUploadCat,
          storage_path: storagePath,
          filename: fbUploadFile.name,
          mimetype: fbUploadFile.type || 'application/octet-stream',
          file_size: fbUploadFile.size,
          notes: fbUploadNotes,
        }),
      });

      const saveJson = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveJson.error || 'Failed to save to File Box');

      toast.success(`Document uploaded to ${FILE_BOX_CATEGORIES.find(c => c.key === fbUploadCat)?.title || 'File Box'}!`);
      setIsFileBoxModalOpen(false);
      setFbUploadFile(null);
      setFbUploadName('');
      setFbUploadNotes('');
      fetchFileBoxes(selectedFileBoxCat || undefined);
    } catch (err: any) {
      toast.error(err.message || 'Error uploading to File Box');
    } finally {
      setFbUploading(false);
    }
  };

  // ==========================================
  // 6. STOCK APP STATE (ODDO PORT)
  // ==========================================
  const [stockKpis, setStockKpis] = useState({
    totalProducts: 3,
    totalOnHandUnits: 2450,
    totalValuation: 771700,
  });
  const [products, setProducts] = useState<any[]>([
    { id: 'p-1', name: 'Coffee Export Beans Grade 1', code: 'COF-01', unit_of_measure: 'KG', quantity_on_hand: 1450, unit_price: 420, cost_price: 360, image_url: '' },
    { id: 'p-2', name: 'Packaging Bags 50kg', code: 'PKG-50', unit_of_measure: 'Unit', quantity_on_hand: 620, unit_price: 85, cost_price: 65, image_url: '' },
    { id: 'p-3', name: 'Roasted Coffee 500g', code: 'COF-R5', unit_of_measure: 'Pack', quantity_on_hand: 380, unit_price: 290, cost_price: 210, image_url: '' },
  ]);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isStockAdjustModalOpen, setIsStockAdjustModalOpen] = useState(false);
  const [selectedStockProduct, setSelectedStockProduct] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState<number>(50);
  const [adjustType, setAdjustType] = useState<'incoming' | 'outgoing' | 'adjustment'>('incoming');

  const [newProdName, setNewProdName] = useState('');
  const [newProdCode, setNewProdCode] = useState('');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdUom, setNewProdUom] = useState('Unit');
  const [newProdCost, setNewProdCost] = useState<number>(100);
  const [newProdSale, setNewProdSale] = useState<number>(140);
  const [newProdQty, setNewProdQty] = useState<number>(100);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [prodImageUploading, setProdImageUploading] = useState(false);

  const fetchStock = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/company/stock', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.products && data.products.length > 0) {
          setProducts(data.products);
        }
        if (data.kpis) setStockKpis(data.kpis);
      }
    } catch (err) {
      console.error('Failed to load stock:', err);
    }
  };

  const handleCreateProduct = async () => {
    if (isAddingProduct) return;
    if (!newProdName) {
      toast.error('Product name is required.');
      return;
    }
    setIsAddingProduct(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/company/stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'add_product',
          name: newProdName,
          code: newProdCode || `SKU-${Date.now().toString().slice(-4)}`,
          image_url: newProdImage || null,
          unit_of_measure: newProdUom,
          cost_price: newProdCost,
          unit_price: newProdSale,
          quantity_on_hand: newProdQty,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add product');

      toast.success(`Product "${newProdName}" added to stock inventory!`);
      setIsNewProductModalOpen(false);
      setNewProdName('');
      setNewProdCode('');
      setNewProdImage('');
      fetchStock();
    } catch (err: any) {
      toast.error(err.message || 'Error adding product');
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleProductImageUpload = async (file: File) => {
    setProdImageUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image upload failed');
      const url = data.url || data.path || '';
      setNewProdImage(url);
      toast.success('Product image uploaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload product image');
    } finally {
      setProdImageUploading(false);
    }
  };

  const handleStockAdjustSubmit = async () => {
    if (!selectedStockProduct || !adjustQty) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/company/stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'adjust_stock',
          product_id: selectedStockProduct.id,
          movement_type: adjustType,
          quantity: adjustQty,
          reference: `${adjustType.toUpperCase()} - Manual adjustment`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to adjust stock');

      toast.success('Stock movement recorded and on-hand balance updated!');
      setIsStockAdjustModalOpen(false);
      fetchStock();
    } catch (err: any) {
      toast.error(err.message || 'Error adjusting stock');
    }
  };

  // Initial Load
  useEffect(() => {
    fetchTreasury();
    fetchReceipts();
    fetchPayroll();
    fetchStock();
    fetchAgreements();
    fetchFileBoxes();
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Top Banner & Company Header */}
      <div className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-2xs">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                  {user.fullName}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">
                    TIN: {user.tinNumber}
                  </span>
                  <span>•</span>
                  <span>{user.companyAddress}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsReceiptModalOpen(true)}
              className="h-7 gap-1.5 text-xs font-medium shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Intake Receipt (OCR)</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBankModalOpen(true)}
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground border-border"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bank Balance</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground border-border"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Workspace Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto gap-1 border-t border-border pt-1">
          {[
            { id: 'overview', label: 'Executive KPI & Treasury', icon: TrendingUp },
            { id: 'receipts', label: 'Dual-Image Receipt Intake', icon: Receipt },
            { id: 'fileboxes', label: 'File Boxes', icon: FileBox },
            { id: 'payroll', label: 'Ethiopian Payroll & Tax', icon: Users },
            { id: 'agreements', label: 'Agreements (Word Editor)', icon: FileText },
            { id: 'stock', label: 'Stock App', icon: Boxes },
            { id: 'approvals', label: 'Approvals', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${active
                    ? 'border-primary text-foreground font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ========================================================= */}
        {/* TAB 1: EXECUTIVE KPI & TREASURY */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 30% Balance Drop Alert from Odoo treasury.py */}
            {treasury.isBelowThreshold && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <div className="flex-1">
                  <span className="font-semibold">
                    Treasury Warning: Bank Balance Has Dropped Below 30% Threshold ({treasury.dropPercent}% drop)
                  </span>
                  <p className="mt-0.5 text-muted-foreground">
                    Available balance is currently {treasury.availableBalance.toLocaleString()} ETB, which is below 30% of your initial opening deposit of {treasury.openingDeposit.toLocaleString()} ETB. Maintain tax and withholding reserve.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setIsBankModalOpen(true)} className="h-7 text-xs shrink-0">
                  Manage Bank Balance
                </Button>
              </div>
            )}

            {/* CEO Executive KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border shadow-xs">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-muted-foreground">Available Bank Balance</span>
                  <Building2 className="w-4 h-4 text-emerald-500" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {treasury.availableBalance.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Opening: {treasury.openingDeposit.toLocaleString()} ETB
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-xs">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-muted-foreground">Total Inflows (Money In)</span>
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {treasury.totalInflow.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span>
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Sales & Initial Deposits</p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-xs">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-muted-foreground">Total Outflows (Money Out)</span>
                  <ArrowDownLeft className="w-4 h-4 text-amber-500" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {treasury.totalOutflow.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span>
                  </div>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Purchases & Payroll Payouts</p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-xs">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-muted-foreground">Last Payroll Processed</span>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-sm font-semibold truncate mt-1">
                    {lastCalculatedAt ? new Date(lastCalculatedAt).toLocaleDateString() : 'Pending Confirmation'}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {lastCalculatedAt ? new Date(lastCalculatedAt).toLocaleTimeString() : 'No run yet'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Action Bar */}
            <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border">
              <div>
                <h3 className="text-sm font-semibold">Corporate Treasury Configuration</h3>
                <p className="text-xs text-muted-foreground">
                  Adjust initial opening bank balance, review fiscal slips, or compute employee tax.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsBankModalOpen(true)} className="h-8 text-xs gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Configure Bank Balance
                </Button>
                <Button size="sm" onClick={() => setIsPayrollModalOpen(true)} className="h-8 text-xs gap-1.5 shadow-xs">
                  <Calculator className="w-3.5 h-3.5" />
                  Calculate Income Tax
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: DUAL-IMAGE RECEIPT INTAKE & OCR */}
        {/* ========================================================= */}
        {activeTab === 'receipts' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background p-4 rounded-xl border border-border">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Dual-Image Receipt Intake & Duplicate Detection</h3>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                    Gemini Vision + Tesseract
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload Invoice and POS Machine receipt. Our Ethiopian OCR parser extracts FS Number, Machine Number, TIN, and 15% VAT automatically.
                </p>
              </div>
              <Button size="sm" onClick={() => setIsReceiptModalOpen(true)} className="h-8 gap-1.5 text-xs shadow-xs">
                <Plus className="w-3.5 h-3.5" />
                <span>New Receipt Entry</span>
              </Button>
            </div>

            <Card className="border-border shadow-xs">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>FS Number</TableHead>
                      <TableHead>Machine No.</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Partner / TIN</TableHead>
                      <TableHead>Untaxed (ETB)</TableHead>
                      <TableHead>15% VAT</TableHead>
                      <TableHead>3% WHT</TableHead>
                      <TableHead>Total (ETB)</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiptsList.map((r) => (
                      <TableRow key={r.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono font-medium">{r.fs_number}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{r.machine_number || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {r.receipt_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{r.partner_name}</span>
                          <span className="block text-[10px] font-mono text-muted-foreground">{r.partner_tin || '—'}</span>
                        </TableCell>
                        <TableCell>{(r.untaxed_amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-blue-600 dark:text-blue-400">+{(r.vat_15 || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-emerald-600 dark:text-emerald-400">-{(r.wht_3 || 0).toLocaleString()}</TableCell>
                        <TableCell className="font-bold">{(r.total_amount || 0).toLocaleString()} ETB</TableCell>
                        <TableCell className="text-muted-foreground">{r.receipt_date || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                            {r.state || 'registered'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: FILE BOXES */}
        {/* ========================================================= */}
        {activeTab === 'fileboxes' && (
          <div className="space-y-6">
            {selectedFileBoxCat ? (
              // Specific category file browser
              <div className="space-y-4">
                <div className="bg-background p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFileBoxCat(null)}
                      className="h-8 gap-1 text-xs"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to All Boxes</span>
                    </Button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">
                          {FILE_BOX_CATEGORIES.find((c) => c.key === selectedFileBoxCat)?.title}
                        </h3>
                        <Badge variant="outline" className="text-[10px]">
                          {fileBoxCounts[selectedFileBoxCat] || 0} Files
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {FILE_BOX_CATEGORIES.find((c) => c.key === selectedFileBoxCat)?.desc}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => {
                      setFbUploadCat(selectedFileBoxCat);
                      setIsFileBoxModalOpen(true);
                    }}
                    className="h-8 gap-1.5 text-xs shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload to this Box</span>
                  </Button>
                </div>

                <Card className="border-border shadow-xs">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead>Document Title</TableHead>
                          <TableHead>File Name</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Upload Date</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fileBoxes.filter((f) => f.category === selectedFileBoxCat).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                              No documents uploaded in this file box yet. Click &quot;Upload to this Box&quot; to add your first document.
                            </TableCell>
                          </TableRow>
                        ) : (
                          fileBoxes
                            .filter((f) => f.category === selectedFileBoxCat)
                            .map((f) => (
                              <TableRow key={f.id} className="text-xs hover:bg-muted/30">
                                <TableCell className="font-medium text-foreground">{f.name}</TableCell>
                                <TableCell className="font-mono text-muted-foreground truncate max-w-[180px]">
                                  {f.filename}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {f.file_size ? `${Math.round(f.file_size / 1024)} KB` : '—'}
                                </TableCell>
                                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                                  {f.notes || '—'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {new Date(f.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  <a
                                    href={f.storage_path}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                  </a>
                                </TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            ) : (
              // All 6 categories overview
              <div className="space-y-4">
                <div className="bg-background p-4 rounded-xl border border-border flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">Company Digital File Boxes</h3>
                    <p className="text-xs text-muted-foreground">
                      Ported from Odoo ethiopia.file.box: secure segmented document boxes for compliance audits.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setIsFileBoxModalOpen(true)}
                    className="h-8 gap-1.5 text-xs shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload to File Box</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {FILE_BOX_CATEGORIES.map((box) => (
                    <Card
                      key={box.key}
                      className="border-border hover:border-primary/50 transition-colors shadow-2xs cursor-pointer group"
                      onClick={() => setSelectedFileBoxCat(box.key)}
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                            <FileBox className="w-4 h-4" />
                          </div>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {fileBoxCounts[box.key] || 0} Files
                          </Badge>
                        </div>
                        <CardTitle className="text-sm font-semibold pt-2">{box.title}</CardTitle>
                        <CardDescription className="text-xs line-clamp-2">{box.desc}</CardDescription>
                      </CardHeader>
                      <CardFooter className="p-4 pt-1">
                        <span className="text-[11px] text-primary flex items-center gap-1 group-hover:underline">
                          Browse & Upload <ChevronRight className="w-3 h-3" />
                        </span>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: ETHIOPIAN PAYROLL & 2025 TAX ENGINE */}
        {/* ========================================================= */}
        {activeTab === 'payroll' && (
          <div className="space-y-6">
            <div className="bg-background p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">2025 Ethiopian Income Tax & Payroll Calculator</h3>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                    August 2025 Reform Rules
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calculates 7% employee pension, 11% employer pension, and progressive brackets (0 to 35%). Deducts payroll from company Bank Balance on completion.
                </p>
                {lastCalculatedAt && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    ✓ Last calculated & deducted on: {new Date(lastCalculatedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleImportStaffCSV}
                  />
                  <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted/50 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    Import Staff CSV
                  </span>
                </label>

                <Button
                  size="sm"
                  onClick={() => setIsPayrollModalOpen(true)}
                  className="h-8 text-xs gap-1.5 shadow-xs"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  Calculate Income Tax & Payroll
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPayrollCSV}
                  className="h-8 text-xs gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CSV
                </Button>
              </div>
            </div>

            {/* Current Payroll Table */}
            <Card className="border-border shadow-xs">
              <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Staff Payroll Register</CardTitle>
                  <CardDescription className="text-xs">
                    {employees.length} active employee{employees.length !== 1 ? 's' : ''} with statutory tax breakdown
                  </CardDescription>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setIsPayrollModalOpen(true)} className="h-7 text-xs gap-1">
                  <Edit3 className="w-3 h-3" />
                  Edit in Full Calculator
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Staff Name</TableHead>
                      <TableHead>TIN</TableHead>
                      <TableHead>Basic Salary</TableHead>
                      <TableHead>Transport</TableHead>
                      <TableHead>Pension (7%)</TableHead>
                      <TableHead>Org Pension (11%)</TableHead>
                      <TableHead>2025 Tax</TableHead>
                      <TableHead className="font-semibold">Net Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
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
                    <TableRow className="text-xs font-semibold bg-muted/40 border-t border-border">
                      <TableCell colSpan={2}>Total ({employees.length} Staff)</TableCell>
                      <TableCell>{payrollTotals.gross.toLocaleString()} ETB</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell className="text-amber-600">-{payrollTotals.pensionEmp.toLocaleString()}</TableCell>
                      <TableCell>+{payrollTotals.pensionOrg.toLocaleString()}</TableCell>
                      <TableCell className="text-red-600">-{payrollTotals.tax.toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-primary">{payrollTotals.net.toLocaleString()} ETB</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: PUBLISHED AGREEMENTS (WORD-STYLE EDITOR) */}
        {/* ========================================================= */}
        {activeTab === 'agreements' && (
          <div className="space-y-4">
            {!selectedAgreement ? (
              // 1. Grid of Published Agreements
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background p-4 rounded-xl border border-border">
                  <div>
                    <h3 className="font-semibold text-sm">Published Legal Agreement Templates</h3>
                    <p className="text-xs text-muted-foreground">
                      Click any published contract template to open and customize in our Word-style rich text editor with full font and formatting controls.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30">
                    {agreementsList.length} Templates Published
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agreementsList.map((tpl) => (
                    <Card
                      key={tpl.id}
                      className="border-border hover:border-primary/50 transition-colors shadow-2xs cursor-pointer group flex flex-col justify-between"
                      onClick={() => handleOpenAgreementInEditor(tpl)}
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                            <FileText className="w-4 h-4" />
                          </div>
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                            Published
                          </Badge>
                        </div>
                        <CardTitle className="text-sm font-semibold pt-2 leading-snug">{tpl.title || tpl.name}</CardTitle>
                        <CardDescription className="text-xs line-clamp-3 mt-1">
                          {tpl.desc || 'Standard commercial and employment contract legally reviewed for Ethiopian jurisdiction.'}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="p-4 pt-2 border-t border-border flex items-center justify-between bg-muted/20">
                        <span className="text-[11px] text-muted-foreground">
                          Category: {tpl.category || 'Legal Template'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAgreementInEditor(tpl);
                          }}
                          className="h-7 text-xs text-primary gap-1 group-hover:bg-primary/10"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Open in Word Editor</span>
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              // 2. Word-Type Rich Editor
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background p-4 rounded-xl border border-border">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedAgreement(null)}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Agreements</span>
                    </Button>
                    <div>
                      <h3 className="font-semibold text-sm">{activeAgreement.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        Word-style rich editor with Amharic Unicode fonts, alignment, and instant PDF/Print export.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => window.print()} className="h-8 gap-1.5 text-xs">
                      <Printer className="w-3.5 h-3.5" />
                      Print Document
                    </Button>
                    <Button size="sm" onClick={handleSaveAgreement} disabled={editorSaving} className="h-8 gap-1.5 text-xs shadow-xs">
                      <Save className="w-3.5 h-3.5" />
                      {editorSaving ? 'Saving...' : 'Save Agreement'}
                    </Button>
                  </div>
                </div>

                {/* Word-Style Rich Toolbar */}
                <Card className="border-border shadow-xs">
                  <div className="p-2 border-b border-border bg-muted/40 flex flex-wrap items-center gap-2 text-xs">
                    {/* Font Selector */}
                    <select
                      value={editorFont}
                      onChange={(e) => setEditorFont(e.target.value)}
                      className="h-8 rounded border border-border bg-background px-2 text-xs"
                    >
                      <option value="system-ui, sans-serif">Default Sans-Serif</option>
                      <option value="Georgia, serif">Serif (Georgia)</option>
                      <option value="'Courier New', monospace">Monospace (Courier)</option>
                      <option value="'Abyssinica SIL', 'Nyala', sans-serif">Amharic / Ethiopic (Abyssinica)</option>
                    </select>

                    {/* Font Size Selector */}
                    <select
                      value={editorFontSize}
                      onChange={(e) => setEditorFontSize(e.target.value)}
                      className="h-8 rounded border border-border bg-background px-2 text-xs"
                    >
                      <option value="12px">12px (Small)</option>
                      <option value="14px">14px (Normal)</option>
                      <option value="16px">16px (Medium)</option>
                      <option value="18px">18px (Large)</option>
                      <option value="22px">22px (Heading)</option>
                      <option value="26px">26px (Title)</option>
                    </select>

                    <div className="h-4 w-[1px] bg-border mx-1" />

                    {/* Bold, Italic, Underline */}
                    <Button variant="ghost" size="sm" onClick={() => executeEditorCommand('bold')} className="h-8 w-8 p-0" title="Bold">
                      <Bold className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => executeEditorCommand('italic')} className="h-8 w-8 p-0" title="Italic">
                      <Italic className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => executeEditorCommand('underline')} className="h-8 w-8 p-0" title="Underline">
                      <Underline className="w-3.5 h-3.5" />
                    </Button>

                    <div className="h-4 w-[1px] bg-border mx-1" />

                    {/* Alignments */}
                    <Button variant="ghost" size="sm" onClick={() => executeEditorCommand('justifyLeft')} className="h-8 w-8 p-0" title="Align Left">
                      <AlignLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => executeEditorCommand('justifyCenter')} className="h-8 w-8 p-0" title="Align Center">
                      <AlignCenter className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => executeEditorCommand('justifyRight')} className="h-8 w-8 p-0" title="Align Right">
                      <AlignRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => executeEditorCommand('justifyFull')} className="h-8 w-8 p-0" title="Justify">
                      <AlignJustify className="w-3.5 h-3.5" />
                    </Button>

                    <div className="h-4 w-[1px] bg-border mx-1" />

                    {/* Lists */}
                    <Button variant="ghost" size="sm" onClick={() => executeEditorCommand('insertUnorderedList')} className="h-8 w-8 p-0" title="Bullet List">
                      <List className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => executeEditorCommand('insertOrderedList')} className="h-8 w-8 p-0" title="Numbered List">
                      <ListOrdered className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Document Paper Container */}
                  <CardContent className="p-8 bg-muted/20 flex justify-center">
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      style={{
                        fontFamily: editorFont,
                        fontSize: editorFontSize,
                        minHeight: '520px',
                        width: '100%',
                        maxWidth: '850px',
                      }}
                      className="bg-background border border-border p-8 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: activeAgreement.html }}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: STOCK APP (ODDO PORT) */}
        {/* ========================================================= */}
        {activeTab === 'stock' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background p-4 rounded-xl border border-border">
              <div>
                <h3 className="font-semibold text-sm">Stock on Hand & Inventory Control</h3>
                <p className="text-xs text-muted-foreground">
                  Ported from Odoo stock_app / stock.quant: storable products, tracking, valuation, and deliveries.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setIsNewProductModalOpen(true)} className="h-8 gap-1.5 text-xs shadow-xs">
                  <Plus className="w-3.5 h-3.5" />
                  Add New Product
                </Button>
              </div>
            </div>

            {/* Stock KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-border shadow-xs">
                <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-muted-foreground">Storable Products</span>
                  <Boxes className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-2xl font-bold">{stockKpis.totalProducts}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Active catalogue</p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-xs">
                <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-muted-foreground">Total Units On Hand</span>
                  <Boxes className="w-4 h-4 text-emerald-500" />
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-2xl font-bold">{stockKpis.totalOnHandUnits.toLocaleString()}</div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">Physical warehouse units</p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-xs">
                <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-muted-foreground">Inventory Valuation</span>
                  <TrendingUp className="w-4 h-4 text-primary" />
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-2xl font-bold">
                    {stockKpis.totalValuation.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">At cost price</p>
                </CardContent>
              </Card>
            </div>

            {/* Products Table */}
            <Card className="border-border shadow-xs">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="w-12">Image</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Code / SKU</TableHead>
                      <TableHead>UoM</TableHead>
                      <TableHead>Stock on Hand</TableHead>
                      <TableHead>Cost Price</TableHead>
                      <TableHead>Sale Price</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => (
                      <TableRow key={p.id} className="text-xs hover:bg-muted/30">
                        <TableCell>
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="w-8 h-8 rounded object-cover border border-border"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground">
                              <Boxes className="w-4 h-4" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">{p.name}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{p.code || '—'}</TableCell>
                        <TableCell>{p.unit_of_measure}</TableCell>
                        <TableCell className="font-bold text-primary">
                          {(p.quantity_on_hand || 0).toLocaleString()} {p.unit_of_measure}
                        </TableCell>
                        <TableCell>{(p.cost_price || 0).toLocaleString()} ETB</TableCell>
                        <TableCell>{(p.unit_price || 0).toLocaleString()} ETB</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedStockProduct(p);
                              setIsStockAdjustModalOpen(true);
                            }}
                            className="h-7 text-xs"
                          >
                            Adjust Stock
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 7: APPROVALS */}
        {/* ========================================================= */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            <Card className="border-border shadow-xs">
              <CardHeader className="p-4 border-b border-border">
                <CardTitle className="text-sm font-semibold">Multi-Level Invoice & Bill Approvals</CardTitle>
                <CardDescription className="text-xs">
                  Routing threshold: Level 1 (Account Manager &gt; 10,000 ETB) and Level 2 (CEO &gt; 50,000 ETB).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Required Level</TableHead>
                      <TableHead>Approval State</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="text-xs">
                      <TableCell className="font-medium">INV-2026-0041</TableCell>
                      <TableCell>Vendor Bill</TableCell>
                      <TableCell className="font-semibold">75,000 ETB</TableCell>
                      <TableCell>Level 2 (CEO)</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                          Pending CEO Approval
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                          Approve
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow className="text-xs">
                      <TableCell className="font-medium">REC-2026-0089</TableCell>
                      <TableCell>Purchase Receipt</TableCell>
                      <TableCell className="font-semibold">18,500 ETB</TableCell>
                      <TableCell>Level 1 (Manager)</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                          Approved
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-muted-foreground text-xs">Completed</span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL 1: DUAL-IMAGE RECEIPT INTAKE WITH OCR */}
      {/* ========================================================= */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Dual-Image Receipt Intake (OCR)</DialogTitle>
            <DialogDescription className="text-xs">
              Upload company invoice document and cash register machine receipt. Data is extracted via Gemini Vision LLM and computed automatically.
            </DialogDescription>
            <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 mt-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Fields with amber borders were not extracted — verify and fill manually before registering.</span>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Dual Upload Zone */}
            <div className="grid grid-cols-2 gap-3">
              <label className="border border-dashed border-border rounded-xl p-4 text-center hover:bg-muted/30 transition-colors cursor-pointer block">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleOcrUpload(f, 'invoice');
                  }}
                />
                <Upload className="w-5 h-5 mx-auto text-primary mb-1" />
                <span className="text-xs font-medium block">1. Company Document</span>
                <span className="text-[10px] text-muted-foreground truncate block">
                  {invoiceFileName || 'Invoice or bill PDF/Image'}
                </span>
              </label>

              <label className="border border-dashed border-border rounded-xl p-4 text-center hover:bg-muted/30 transition-colors cursor-pointer block">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleOcrUpload(f, 'cash');
                  }}
                />
                <Receipt className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
                <span className="text-xs font-medium block">2. Cash Register Receipt</span>
                <span className="text-[10px] text-muted-foreground truncate block">
                  {cashSlipFileName || 'POS fiscal slip image'}
                </span>
              </label>
            </div>

            {ocrLoading && (
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Reading Ethiopian fiscal receipt fields...</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rec-type" className="text-xs">Classification</Label>
                <select
                  id="rec-type"
                  value={receiptType}
                  onChange={(e) => setReceiptType(e.target.value as any)}
                  className="w-full text-xs h-9 rounded-md border border-border bg-background px-3"
                >
                  <option value="purchase">Purchase (Vendor Receipt)</option>
                  <option value="sale">Sale (Customer Invoice)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="rec-date" className="text-xs">Receipt Date</Label>
                <Input
                  id="rec-date"
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="fs" className="text-xs">FS Number *</Label>
                <Input
                  id="fs"
                  value={fsNumber}
                  onChange={(e) => setFsNumber(e.target.value)}
                  placeholder="Extracted from image..."
                  className={`h-9 text-xs font-mono font-semibold ${!fsNumber ? 'border-amber-400 focus:ring-amber-400' : ''}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="machine" className="text-xs">Machine Number *</Label>
                <Input
                  id="machine"
                  value={machineNumber}
                  onChange={(e) => setMachineNumber(e.target.value)}
                  placeholder="Extracted from POS slip..."
                  className={`h-9 text-xs font-mono ${!machineNumber ? 'border-amber-400 focus:ring-amber-400' : ''}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="partner" className="text-xs">Partner / Vendor Name *</Label>
                <Input
                  id="partner"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Extracted from image..."
                  className={`h-9 text-xs ${!partnerName ? 'border-amber-400 focus:ring-amber-400' : ''}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tin" className="text-xs">Partner TIN</Label>
                <Input
                  id="tin"
                  value={partnerTin}
                  onChange={(e) => setPartnerTin(e.target.value)}
                  placeholder="10-digit TIN..."
                  className={`h-9 text-xs font-mono ${!partnerTin ? 'border-amber-400/60' : ''}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="untaxed" className="text-xs">Untaxed Amount (ETB)</Label>
                <Input
                  id="untaxed"
                  type="number"
                  value={receiptUntaxed ?? ''}
                  onChange={(e) => setReceiptUntaxed(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Amount before 15% VAT..."
                  className={`h-9 text-xs font-semibold ${receiptUntaxed === null ? 'border-amber-400 focus:ring-amber-400' : ''}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="wht-rate" className="text-xs">WHT Rate (%)</Label>
                <select
                  id="wht-rate"
                  value={receiptWhtRate}
                  onChange={(e) => setReceiptWhtRate(Number(e.target.value))}
                  className="w-full text-xs h-9 rounded-md border border-border bg-background px-3"
                >
                  <option value={3}>3% (Goods &gt; 20,000 ETB)</option>
                  <option value={2}>2% (Services &gt; 3,000 ETB)</option>
                  <option value={0}>0% (Exempt)</option>
                </select>
              </div>
            </div>

            {/* Calculations preview box */}
            <div className="bg-muted/50 p-3 rounded-lg border border-border text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount before VAT:</span>
                <span>{safeUntaxed.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between text-blue-600 dark:text-blue-400">
                <span>Value Added Tax (15%):</span>
                <span>+{calculatedVat.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Withholding Tax ({receiptWhtRate}%):</span>
                <span>-{calculatedWht.toLocaleString()} ETB</span>
              </div>
              <div className="border-t border-border pt-1.5 flex justify-between font-bold text-foreground">
                <span>Total Calculated Receipt:</span>
                <span>{calculatedTotal.toLocaleString()} ETB</span>
              </div>
            </div>

            {/* Live OCR Raw Output + Confidence Notes */}
            {rawOcrText && (
              <div className="bg-muted/30 p-2.5 rounded-lg border border-border text-xs space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    OCR Image Text Extracted:
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {ocrEngine === 'vision-llm' ? 'Gemini Vision LLM' : 'Tesseract 5.4 Fallback'}
                  </Badge>
                </div>
                <pre className="text-[11px] font-mono whitespace-pre-wrap max-h-24 overflow-y-auto bg-background p-2 rounded border border-border text-foreground">
                  {rawOcrText}
                </pre>
                {confidenceNotes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {confidenceNotes.map((note, i) => (
                      <div key={i} className="text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearReceipt}
              className="text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Clear / New Receipt
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsReceiptModalOpen(false)} className="text-xs h-8">
                Cancel
              </Button>
              <Button size="sm" onClick={handleRegisterReceipt} className="text-xs h-8 shadow-xs">
                Confirm & Register Receipt
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 2: LARGE PAYROLL & INCOME TAX CALCULATOR */}
      {/* ========================================================= */}
      <Dialog open={isPayrollModalOpen} onOpenChange={setIsPayrollModalOpen}>
        <DialogContent className="sm:max-w-[96vw] xl:max-w-7xl w-[96vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  <span>2025 Ethiopian Payroll & Income Tax Calculator</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                    Proclamation 1364/2024
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Each employee row is editable in full view. On clicking Done, the total net payroll will be automatically deducted from your Company Bank Balance.
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleImportStaffCSV}
                  />
                  <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted/50 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    Import CSV
                  </span>
                </label>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPayrollCSV}
                  className="h-8 text-xs gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CSV
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddEmployeeRow}
                  className="h-8 text-xs gap-1.5 border-dashed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Employee
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Full View Editable Employee Table */}
            <div className="border border-border rounded-lg overflow-x-auto shadow-2xs">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/40">
                    <TableHead className="w-44 min-w-[160px]">Employee Name</TableHead>
                    <TableHead className="w-28 min-w-[110px]">TIN</TableHead>
                    <TableHead className="w-28 min-w-[110px]">Basic Salary (ETB)</TableHead>
                    <TableHead className="w-24 min-w-[100px]">Transport</TableHead>
                    <TableHead className="w-24 min-w-[100px]">Overtime / Other</TableHead>
                    <TableHead className="w-24 min-w-[95px]">Gross Salary</TableHead>
                    <TableHead className="w-24 min-w-[95px]">Taxable</TableHead>
                    <TableHead className="w-24 min-w-[95px]">7% Pension</TableHead>
                    <TableHead className="w-24 min-w-[95px]">11% Pension</TableHead>
                    <TableHead className="w-24 min-w-[95px]">18% Total</TableHead>
                    <TableHead className="w-24 min-w-[95px]">2025 Tax</TableHead>
                    <TableHead className="w-28 min-w-[120px] font-semibold">Net Salary</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id} className="text-xs hover:bg-muted/30">
                      <TableCell>
                        <Input
                          value={emp.name}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'name', e.target.value)}
                          className="h-8 text-xs font-medium"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={emp.tin}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'tin', e.target.value)}
                          placeholder="TIN"
                          className="h-8 text-xs font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={emp.basic}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'basic', Number(e.target.value))}
                          className="h-8 text-xs font-semibold"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={emp.transport}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'transport', Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={emp.overtime}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'overtime', Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-foreground font-medium">
                        {emp.gross.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {emp.taxableIncome.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-amber-600 dark:text-amber-400">
                        -{emp.pensionEmp.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        +{emp.pensionOrg.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {(emp.pensionEmp + emp.pensionOrg).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-red-600 dark:text-red-400">
                        -{emp.tax.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-primary">
                        {emp.net.toLocaleString()} ETB
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEmployeeRow(emp.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Summary & Bank Balance Deduction Notice */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/40 rounded-xl border border-border text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Gross Salary:</span>
                <span className="text-sm font-bold">{payrollTotals.gross.toLocaleString()} ETB</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Total 2025 Income Tax:</span>
                <span className="text-sm font-bold text-red-600">-{payrollTotals.tax.toLocaleString()} ETB</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Pensions (7% + 11%):</span>
                <span className="text-sm font-bold text-amber-600">
                  {(payrollTotals.pensionEmp + payrollTotals.pensionOrg).toLocaleString()} ETB
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Net Payroll Payout:</span>
                <span className="text-sm font-bold text-primary">{payrollTotals.net.toLocaleString()} ETB</span>
              </div>

              <div className="col-span-full pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  🏦 Bank Balance Impact: <strong>{totalPayrollDeduction.toLocaleString()} ETB</strong> will be deducted from your Company Bank Balance upon confirmation.
                </span>
                <span className="font-semibold text-foreground">
                  Available Bank Balance: {treasury.availableBalance.toLocaleString()} ETB
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {lastCalculatedAt && (
                <span>Last calculated on: {new Date(lastCalculatedAt).toLocaleString()}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsPayrollModalOpen(false)} className="text-xs h-8">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmPayrollRun}
                disabled={payrollPosting}
                className="text-xs h-8 shadow-xs gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {payrollPosting ? 'Deducting & Saving...' : 'Done / Confirm & Deduct from Bank'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 3: CONFIGURE BANK BALANCE */}
      {/* ========================================================= */}
      <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Corporate Bank Balance</DialogTitle>
            <DialogDescription className="text-xs">
              Set your initial opening balance or record deposits/withdrawals (Ported from Odoo Treasury).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Action</Label>
              <select
                value={bankAction}
                onChange={(e) => setBankAction(e.target.value as any)}
                className="w-full text-xs h-9 rounded-md border border-border bg-background px-3"
              >
                <option value="set_opening">Set Initial Opening Deposit</option>
                <option value="deposit">Bank Deposit (Inflow)</option>
                <option value="withdrawal">Bank Withdrawal (Outflow)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Amount (ETB)</Label>
              <Input
                type="number"
                value={bankAmount}
                onChange={(e) => setBankAmount(Number(e.target.value))}
                className="h-9 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={bankDesc}
                onChange={(e) => setBankDesc(e.target.value)}
                placeholder="Description"
                className="h-9 text-xs"
              />
            </div>

            <div className="p-3 bg-muted/40 rounded-lg border border-border text-[11px] text-muted-foreground">
              Current Available Balance: <strong className="text-foreground">{treasury.availableBalance.toLocaleString()} ETB</strong>.
              If the balance falls below 30% of your opening deposit, an automated treasury warning triggers.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsBankModalOpen(false)} className="text-xs h-8">
              Cancel
            </Button>
            <Button size="sm" onClick={handleBankSubmit} disabled={bankLoading} className="text-xs h-8">
              {bankLoading ? 'Saving...' : 'Save Balance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 4: ADD STOCK PRODUCT (LARGE MODAL WITH IMAGE) */}
      {/* ========================================================= */}
      <Dialog open={isNewProductModalOpen} onOpenChange={setIsNewProductModalOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Boxes className="w-4 h-4 text-primary" />
              <span>Add New Stock Product &amp; Storable Item</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Port of Odoo stock.product: track physical units, cost/sale pricing, initial on-hand balance, and product imagery.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Product Image Section */}
            <div className="p-3.5 bg-muted/30 rounded-xl border border-border flex flex-col sm:flex-row items-center gap-4">
              <div className="h-24 w-24 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
                {newProdImage ? (
                  <img src={newProdImage} alt="Product Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-center p-2 text-muted-foreground">
                    <ImageIcon className="w-6 h-6 mx-auto mb-1 text-muted-foreground/60" />
                    <span className="text-[10px] block">No Image</span>
                  </div>
                )}
              </div>

              <div className="flex-1 w-full space-y-2">
                <Label className="text-xs font-semibold">Product Image (Photo / Catalog)</Label>
                <div className="flex gap-2">
                  <Input
                    value={newProdImage}
                    onChange={(e) => setNewProdImage(e.target.value)}
                    placeholder="https://example.com/product-image.jpg"
                    className="h-8 text-xs font-mono"
                  />
                  <label className="cursor-pointer shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleProductImageUpload(file);
                      }}
                    />
                    <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted/50 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {prodImageUploading ? 'Uploading...' : 'Upload File'}
                    </span>
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Provide an image URL or upload directly from your device.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Product Name *</Label>
                <Input
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="e.g. Export Grade 1 Arabica Coffee"
                  className="h-9 text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">SKU / Code</Label>
                <Input
                  value={newProdCode}
                  onChange={(e) => setNewProdCode(e.target.value)}
                  placeholder="COF-01"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Unit of Measure (UoM)</Label>
                <select
                  value={newProdUom}
                  onChange={(e) => setNewProdUom(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-border bg-background px-3"
                >
                  <option value="Unit">Unit</option>
                  <option value="KG">KG (Kilogram)</option>
                  <option value="Pack">Pack</option>
                  <option value="Box">Box</option>
                  <option value="Litre">Litre</option>
                  <option value="Meter">Meter</option>
                  <option value="Bag">Bag (50kg)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Cost Price (ETB)</Label>
                <Input
                  type="number"
                  value={newProdCost}
                  onChange={(e) => setNewProdCost(Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Sale Price (ETB)</Label>
                <Input
                  type="number"
                  value={newProdSale}
                  onChange={(e) => setNewProdSale(Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Initial Stock Qty</Label>
                <Input
                  type="number"
                  value={newProdQty}
                  onChange={(e) => setNewProdQty(Number(e.target.value))}
                  className="h-9 text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsNewProductModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateProduct}
              disabled={isAddingProduct}
              className="text-xs h-8 shadow-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {isAddingProduct ? 'Adding Product...' : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL: UPLOAD TO DIGITAL FILE BOX */}
      {/* ========================================================= */}
      <Dialog open={isFileBoxModalOpen} onOpenChange={setIsFileBoxModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <FileBox className="w-4 h-4 text-primary" />
              <span>Upload to Digital File Box</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Segmented compliance archive. Upload receipts, tax declarations, contracts, or fiscal Z-reports.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">File Box Category *</Label>
              <select
                value={fbUploadCat}
                onChange={(e) => setFbUploadCat(e.target.value)}
                className="w-full text-xs h-9 rounded-md border border-border bg-background px-3"
              >
                {FILE_BOX_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Document Title / Name *</Label>
              <Input
                value={fbUploadName}
                onChange={(e) => setFbUploadName(e.target.value)}
                placeholder="e.g. November 2026 ERCA Tax Declaration"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Select Document File *</Label>
              <Input
                type="file"
                onChange={(e) => setFbUploadFile(e.target.files?.[0] || null)}
                className="h-9 text-xs"
              />
              {fbUploadFile && (
                <p className="text-[10px] text-muted-foreground">
                  Selected: {fbUploadFile.name} ({Math.round(fbUploadFile.size / 1024)} KB)
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes / Audit Remarks</Label>
              <Input
                value={fbUploadNotes}
                onChange={(e) => setFbUploadNotes(e.target.value)}
                placeholder="Optional notes or reference numbers"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFileBoxModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleFileBoxUploadSubmit}
              disabled={fbUploading}
              className="text-xs h-8 shadow-xs gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              {fbUploading ? 'Uploading Document...' : 'Upload Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 5: ADJUST STOCK */}
      {/* ========================================================= */}
      {selectedStockProduct && (
        <Dialog open={isStockAdjustModalOpen} onOpenChange={setIsStockAdjustModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Adjust Stock — {selectedStockProduct.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Current on-hand: {selectedStockProduct.quantity_on_hand} {selectedStockProduct.unit_of_measure}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Movement Type</Label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full text-xs h-9 rounded-md border border-border bg-background px-3"
                >
                  <option value="incoming">Incoming (Vendor Shipment / Inflow)</option>
                  <option value="outgoing">Outgoing (Customer Delivery / Outflow)</option>
                  <option value="adjustment">Direct Count Adjustment</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Quantity ({selectedStockProduct.unit_of_measure})</Label>
                <Input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  className="h-9 text-xs font-semibold"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsStockAdjustModalOpen(false)} className="text-xs h-8">
                Cancel
              </Button>
              <Button size="sm" onClick={handleStockAdjustSubmit} className="text-xs h-8">
                Confirm Movement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* NEW REPORT MODAL */}
      <NewReportModal
        isOpen={isNewReportModalOpen}
        onClose={() => setIsNewReportModalOpen(false)}
        onSubmit={async ({ type, files }: { type: string; files: any[] }) => {
          try {
            const uploadedUrls: string[] = [];
            for (const item of files) {
              if (item.file) {
                const formData = new FormData();
                formData.append('file', item.file);
                const token = localStorage.getItem('token');
                const uploadRes = await fetch('/api/upload', {
                  method: 'POST',
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                  body: formData,
                });
                const uploadJson = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadJson.error || 'File upload failed');
                uploadedUrls.push(uploadJson.url || uploadJson.path);
              }
            }

            const token = localStorage.getItem('token');
            const res = await fetch('/api/reports', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                reportType: type,
                files: uploadedUrls,
              }),
            });

            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || 'Failed to submit report');
            }

            toast.success('Document uploaded to File Box successfully!');
            setIsNewReportModalOpen(false);
          } catch (err: any) {
            console.error('Submit report error:', err);
            toast.error(err.message || 'Failed to submit report');
          }
        }}
      />
    </div>
  );
}
