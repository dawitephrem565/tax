'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
  FolderOpen,
  BookOpen,
  Paperclip,
  Search,
  CalendarDays,
  X
} from 'lucide-react';
import NewReportModal from '@/components/modals/new-report-modal';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';

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

export default function UserDashboard({ user, onLogout }: UserDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'receipts' | 'ledger' | 'fileboxes' | 'payroll' | 'agreements' | 'stock' | 'approvals'
  >('overview');

  // Reports Modal
  const [isNewReportModalOpen, setIsNewReportModalOpen] = useState(false);

  // Helper: Retrieve valid auth token (supports company user token or adminToken)
  const getAuthToken = () => {
    if (typeof window === 'undefined') return '';
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    if (!token || token === 'undefined' || token === 'null') return '';
    return token;
  };

  const handleAuthError = (err: any, fallbackMessage: string) => {
    const msg = err?.message || fallbackMessage;
    if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('401')) {
      toast.error('Session expired or unauthorized. Please log out (top-right) and sign in again.');
      return;
    }
    toast.error(msg);
  };

  // ==========================================
  // MULTI-LICENSE / ENTERPRISE ENTITY STATE
  // (Managed strictly by Platform Super Admin;
  //  Company Admins view & execute per assigned license)
  // ==========================================
  interface LicenseInfo {
    id: string;
    license_name: string;
    license_number: string | null;
    license_type: string;
    is_primary: boolean;
  }

  const [companyLicenses, setCompanyLicenses] = useState<LicenseInfo[]>([
    { id: 'main', license_name: 'Main License', license_number: null, license_type: 'Business License', is_primary: true },
  ]);
  const [activeLicenseId, setActiveLicenseId] = useState<string>('main');
  const activeLicense = companyLicenses.find((l) => l.id === activeLicenseId) ?? companyLicenses[0];
  const [perLicenseEmployees, setPerLicenseEmployees] = useState<Record<string, EmployeeRow[]>>({});
  const [payrollLicenseSelector, setPayrollLicenseSelector] = useState(false);
  const [payrollTargetLicenseId, setPayrollTargetLicenseId] = useState<string>('');

  const fetchLicenses = async (): Promise<string> => {
    try {
      const token = getAuthToken();
      const res = await fetch('/api/company/licenses', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.licenses && data.licenses.length > 0) {
          setCompanyLicenses(data.licenses);
          const primary = data.licenses.find((l: LicenseInfo) => l.is_primary) ?? data.licenses[0];
          setActiveLicenseId(primary.id);
          return primary.id;
        }
      }
    } catch (err) {
      console.error('Failed to load licenses:', err);
    }
    return 'main';
  };

  const loadAllDataForLicense = (licId: string) => {
    fetchTreasury(licId);
    fetchReceipts(licId, receiptMonth, receiptView);
    fetchPayroll(licId);
    fetchStock(licId);
    fetchAgreements(licId);
    fetchFileBoxes(undefined, licId);
    if (activeTab === 'ledger') fetchLedger(licId);
  };

  const handleSelectLicense = (licId: string) => {
    if (licId === activeLicenseId) return;
    setActiveLicenseId(licId);
    // Strict isolation: clear current loaded data so no bleeding across licenses occurs
    setReceiptsList([]);
    setReceiptSummary(null);
    setSelectedReceiptId(null);
    setReceiptDetail(null);
    setLedgerReport(null);
    setFileBoxes([]);
    setProducts([]);
    if (perLicenseEmployees[licId]) {
      setEmployees(perLicenseEmployees[licId]);
    }
    loadAllDataForLicense(licId);
    toast.info(`Switched active view to license: ${companyLicenses.find(l => l.id === licId)?.license_name || licId}`);
  };

  // Get employees for a specific license (falls back to main employees list)
  const getEmployeesForLicense = (licId: string): EmployeeRow[] => {
    return perLicenseEmployees[licId] ?? employees;
  };

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

  const fetchTreasury = async (licId?: string) => {
    try {
      const token = getAuthToken();
      const currentLic = licId ?? activeLicenseId;
      const url = currentLic ? `/api/company/treasury?license_id=${encodeURIComponent(currentLic)}` : '/api/company/treasury';
      const res = await fetch(url, {
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
      const token = getAuthToken();
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
          license_id: activeLicenseId,
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
      fetchTreasury(activeLicenseId);
    } catch (err: any) {
      handleAuthError(err, 'Error updating bank balance');
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
  const [receiptMonth, setReceiptMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [receiptView, setReceiptView] = useState<'sale' | 'purchase'>('sale');
  const [receiptSummary, setReceiptSummary] = useState<any>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<any>(null);
  const [receiptDetailLoading, setReceiptDetailLoading] = useState(false);

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
  const [invoicePath, setInvoicePath] = useState<string | null>(null);
  const [cashPath, setCashPath] = useState<string | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [ocrEngine, setOcrEngine] = useState<string>('');
  const [confidenceNotes, setConfidenceNotes] = useState<string[]>([]);
  const [extractedVat, setExtractedVat] = useState<number | null>(null);
  const [extractedTotal, setExtractedTotal] = useState<number | null>(null);
  const [extractedLines, setExtractedLines] = useState<any[]>([]);
  const [supplyType, setSupplyType] = useState<'goods' | 'services' | 'mixed' | 'unknown'>('unknown');
  const [vatTreatment, setVatTreatment] = useState<'standard' | 'zero_rated' | 'exempt' | 'tot' | 'unknown'>('standard');
  const [ocrCalendar, setOcrCalendar] = useState<string>('gregorian');

  // Accounting ledger state
  const [ledgerReport, setLedgerReport] = useState<any>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerView, setLedgerView] = useState<'trial' | 'pnl' | 'bs' | 'tax' | 'journal'>('trial');
  const [ledgerFrom, setLedgerFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [ledgerTo, setLedgerTo] = useState(() => new Date().toISOString().slice(0, 10));

  const safeUntaxed = receiptUntaxed ?? 0;
  const totIncluded = vatTreatment === 'tot' ? Math.round(safeUntaxed * 0.02 * 100) / 100 : 0;
  const calculatedVat = vatTreatment === 'standard' ? Math.round(safeUntaxed * 0.15 * 100) / 100 : 0;
  const effectiveVat = vatTreatment === 'standard' ? extractedVat ?? calculatedVat : 0;
  const calculatedWht = Math.round(safeUntaxed * (receiptWhtRate / 100) * 100) / 100;
  const calculatedTotal =
    extractedTotal ?? Math.round((safeUntaxed + effectiveVat + totIncluded) * 100) / 100;

  const formatMoney = (value: number | null | undefined) =>
    Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const receiptMonthLabel = (() => {
    const label = new Date(`${receiptMonth}-01T00:00:00`).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
    return label || receiptMonth;
  })();

  const renderGrowth = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return <span className="text-[10px] text-muted-foreground">no prior month</span>;
    }
    const positive = value >= 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
          positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }`}
      >
        {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
        {Math.abs(value)}%
      </span>
    );
  };

  const prepareImageFile = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
    if (file.size <= 1_200_000) return file;
    try {
      const objectUrl = URL.createObjectURL(file);
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = objectUrl;
      });
      const maxEdge = 1600;
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) return file;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      URL.revokeObjectURL(objectUrl);
      if (!blob) return file;
      return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch {
      return file;
    }
  };

  const fetchReceipts = async (licId?: string, month?: string, view?: 'sale' | 'purchase') => {
    setReceiptsLoading(true);
    try {
      const token = getAuthToken();
      const currentLic = licId ?? activeLicenseId;
      const params = new URLSearchParams();
      if (currentLic) params.set('license_id', currentLic);
      params.set('month', month ?? receiptMonth);
      params.set('type', view ?? receiptView);

      const res = await fetch(`/api/company/receipts?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setReceiptsList(Array.isArray(data.receipts) ? data.receipts : []);
        setReceiptSummary(data.summary ?? null);
      }
    } catch (err) {
      console.error('Failed to load receipts:', err);
    } finally {
      setReceiptsLoading(false);
    }
  };

  const fetchReceiptDetail = async (id: string) => {
    setSelectedReceiptId(id);
    setReceiptDetail(null);
    setReceiptDetailLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/company/receipts/${encodeURIComponent(id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load the receipt');
      setReceiptDetail(data);
    } catch (err: any) {
      toast.error(err?.message || 'Could not open the receipt');
      setSelectedReceiptId(null);
    } finally {
      setReceiptDetailLoading(false);
    }
  };

  const fetchLedger = async (licId?: string) => {
    setLedgerLoading(true);
    try {
      const token = getAuthToken();
      const params = new URLSearchParams({ from: ledgerFrom, to: ledgerTo });
      const currentLic = licId ?? activeLicenseId;
      if (currentLic && currentLic !== 'all') params.set('license_id', currentLic);
      const res = await fetch(`/api/company/ledger?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load the ledger');
      setLedgerReport(data);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load the accounting ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const syncLedger = async () => {
    setLedgerLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/company/ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'sync', license_id: activeLicenseId, from: ledgerFrom, to: ledgerTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      toast.success(`Posted ${data.posted} receipt(s) to the ledger${data.failed ? `, ${data.failed} failed` : ''}.`);
      await fetchLedger();
    } catch (err: any) {
      toast.error(err?.message || 'Could not post receipts to the ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const openReceiptModal = () => {
    if (!receiptDate) setReceiptDate(new Date().toISOString().slice(0, 10));
    setIsReceiptModalOpen(true);
  };

  const handleOcrUpload = async (file: File, type: 'invoice' | 'cash') => {
    const prepared = await prepareImageFile(file);
    if (prepared.size > 4 * 1024 * 1024) {
      toast.error('Insert is larger than 4 MB. Compress the document or split a multi-page PDF.');
      return;
    }

    if (type === 'invoice') {
      setInvoiceFileName(file.name);
      setInvoiceFileObj(prepared);
    } else {
      setCashSlipFileName(file.name);
      setCashSlipFileObj(prepared);
    }

    setOcrLoading(true);
    toast.info(`Extracting fiscal fields from ${file.name}...`);
    try {
      const formData = new FormData();
      if (type === 'invoice') {
        formData.append('companyDocument', prepared);
      } else if (invoicePath) {
        formData.append('companyDocumentPath', invoicePath);
      } else if (invoiceFileObj) {
        formData.append('companyDocument', invoiceFileObj);
      }

      if (type === 'cash') {
        formData.append('posReceipt', prepared);
      } else if (cashPath) {
        formData.append('posReceiptPath', cashPath);
      } else if (cashSlipFileObj) {
        formData.append('posReceipt', cashSlipFileObj);
      }

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
        setExtractedVat(d.vat_amount ?? null);
        setExtractedTotal(d.total_amount ?? null);
        setExtractedLines(Array.isArray(d.lines) ? d.lines : []);
        setSupplyType(d.supply_type ?? 'unknown');
        const treatment =
          (!d.vat_treatment || d.vat_treatment === 'unknown') && Number(d.vat_amount || 0) > 0
            ? 'standard'
            : d.vat_treatment ?? 'standard';
        setVatTreatment(treatment as any);
        setOcrCalendar(d.calendar ?? 'gregorian');
        setReceiptType(d.classification === 'sale' ? 'sale' : 'purchase');
        if (d.receipt_date) setReceiptDate(d.receipt_date);
        if (json.rawText) setRawOcrText(json.rawText);
        setOcrEngine(json.engine ?? 'unknown');
        setConfidenceNotes(d.confidence_notes ?? []);
        if (json.files?.companyDocument?.path) setInvoicePath(json.files.companyDocument.path);
        if (json.files?.posReceipt?.path) setCashPath(json.files.posReceipt.path);

        const engineLabel = json.engine === 'vision-llm' ? 'Gemini Vision' : 'Tesseract fallback';
        toast.success(
          `${engineLabel}: FS ${d.fs_number || '—'}, Total ${
            d.total_amount != null ? Number(d.total_amount).toLocaleString() : '—'
          } ETB`
        );
      } else {
        toast.warning(json.error || 'Extraction returned no data. Fill the fields manually.');
      }
    } catch (err) {
      console.error('OCR error:', err);
      toast.error('Extraction failed. The fields can be filled manually.');
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
    setInvoicePath('');
    setCashPath('');
    setRawOcrText('');
    setOcrEngine('');
    setConfidenceNotes([]);
    setExtractedVat(null);
    setExtractedTotal(null);
    setExtractedLines([]);
    setSupplyType('unknown');
    setVatTreatment('standard');
    setOcrCalendar('gregorian');
  };

  const handleRegisterReceipt = async () => {
    if (!fsNumber || !partnerName) {
      toast.error('FS Number and Partner Name are required.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) {
      toast.error('Enter the receipt date extracted from the document (YYYY-MM-DD).');
      return;
    }
    try {
      const token = getAuthToken();
      const res = await fetch('/api/company/receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          license_id: activeLicenseId === 'all' ? 'main' : activeLicenseId,
          fs_number: fsNumber,
          machine_number: machineNumber,
          receipt_type: receiptType,
          partner_name: partnerName,
          partner_tin: partnerTin,
          buyer_tin: receiptType === 'purchase' ? partnerTin : user?.tinNumber,
          seller_tin: receiptType === 'sale' ? user?.tinNumber : partnerTin,
          untaxed_amount: safeUntaxed,
          vat_amount: effectiveVat,
          wht_amount: calculatedWht,
          wht_rate: Number(receiptWhtRate) || 0,
          total_amount: calculatedTotal,
          extracted_total: extractedTotal,
          extracted_vat: extractedVat,
          supply_type: supplyType,
          vat_treatment: vatTreatment,
          calendar: ocrCalendar,
          company_document_path: invoicePath || undefined,
          company_document_name: invoiceFileName || undefined,
          cash_receipt_path: cashPath || undefined,
          cash_register_receipt_name: cashSlipFileName || undefined,
          ocr_engine: ocrEngine || undefined,
          raw_text: rawOcrText || undefined,
          confidence_notes: confidenceNotes,
          lines: extractedLines,
          date: receiptDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register receipt');

      toast.success(
        `${receiptType === 'sale' ? 'Sales' : 'Purchase'} receipt registered${
          data.ledgerPosted ? ' and posted to the ledger' : ''
        }.`
      );
      setIsReceiptModalOpen(false);
      handleClearReceipt();
      fetchReceipts(activeLicenseId);
      fetchTreasury(activeLicenseId); // update treasury
      if (activeTab === 'ledger' || ledgerReport) fetchLedger();
    } catch (err: any) {
      handleAuthError(err, 'Error registering receipt');
    }
  };

  // ==========================================
  // 3. ETHIOPIAN PAYROLL & TAX ENGINE (PROCLAMATION NO. 979/2016)
  // ==========================================
  const computeEthiopianTax = (
    basic: number,
    workDays: number = 30,
    overtime: number = 0,
    taxableAllowance: number = 0,
    transport: number = 0,
    advance: number = 0,
    otherDeductions: number = 0
  ) => {
    const safeBasic = Number(basic) || 0;
    const safeDays = Number(workDays) > 0 ? Number(workDays) : 30;
    // Basic salary earned during the month (prorated by worked days; exactly basic if 30 days)
    const earnedBasic = safeDays === 30 ? safeBasic : Math.round((safeBasic / 30) * safeDays * 100) / 100;

    const safeOvertime = Number(overtime) || 0;
    const safeTaxableAllowance = Number(taxableAllowance) || 0;
    const safeTransport = Number(transport) || 0;
    const safeAdvance = Number(advance) || 0;
    const safeOtherDeductions = Number(otherDeductions) || 0;

    // Pension calculations on earned basic salary
    const pensionOrg = Math.round(earnedBasic * 0.11 * 100) / 100; // Employer 11%
    const pensionEmp = Math.round(earnedBasic * 0.07 * 100) / 100; // Employee 7%

    // Total Taxable Earning (Basic Earned + Overtime + Taxable Allowance)
    const taxableIncome = Math.round((earnedBasic + safeOvertime + safeTaxableAllowance) * 100) / 100;

    // Gross Earning (Total earnings including Employer 11% pension as in company payroll sheet)
    const gross = Math.round((earnedBasic + safeOvertime + safeTaxableAllowance + safeTransport + pensionOrg) * 100) / 100;

    // Legal Ethiopian Income Tax Brackets (Proclamation No. 979/2016)
    // 0 - 600: 0%
    // 601 - 1,650: 10% (deduction: 60)
    // 1,651 - 3,200: 15% (deduction: 142.50)
    // 3,201 - 5,250: 20% (deduction: 302.50)
    // 5,251 - 7,800: 25% (deduction: 565.00)
    // 7,801 - 10,900: 30% (deduction: 955.00)
    // Over 10,900: 35% (deduction: 1,500.00)
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

    // Total Deductions = Tax + Pension 7% + Advance + Other Deductions
    const totalDeductions = Math.round((tax + pensionEmp + safeAdvance + safeOtherDeductions) * 100) / 100;

    // Net Pay = (Basic Earned + Overtime + Taxable Allowance + Transport) - Total Deductions
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
  };

  const [employees, setEmployees] = useState<EmployeeRow[]>([
    {
      id: 'emp-1',
      name: 'Zerubabel Gebeyehu',
      tin: '0012938475',
      basic: 25000,
      ...computeEthiopianTax(25000, 30),
    },
    {
      id: 'emp-2',
      name: 'Kidus Amanuel',
      tin: '0029384756',
      basic: 10000,
      ...computeEthiopianTax(10000, 30),
    },
    {
      id: 'emp-3',
      name: 'Atnafu Anja',
      tin: '0038475612',
      basic: 8000,
      ...computeEthiopianTax(8000, 30),
    },
    {
      id: 'emp-4',
      name: 'Amira',
      tin: '0047561293',
      basic: 14656,
      ...computeEthiopianTax(14656, 30),
    },
    {
      id: 'emp-5',
      name: 'Rahel Solomon',
      tin: '0056129384',
      basic: 14656,
      ...computeEthiopianTax(14656, 30),
    },
  ]);

  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<string | null>(null);
  const [payrollPosting, setPayrollPosting] = useState(false);

  const fetchPayroll = async (licId?: string) => {
    try {
      const token = getAuthToken();
      const currentLic = licId ?? activeLicenseId;
      const url = currentLic ? `/api/company/payroll?license_id=${encodeURIComponent(currentLic)}` : '/api/company/payroll';
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lastCalculatedAt) setLastCalculatedAt(data.lastCalculatedAt);
        if (data.payslips && data.payslips.length > 0) {
          const loadedRows: EmployeeRow[] = data.payslips.map((p: any, idx: number) => {
            const basic = Number(p.basic_salary) || 0;
            const transport = Number(p.transport_allowance) || 0;
            return {
              id: p.id || `emp-load-${idx}`,
              name: p.employee_name,
              tin: p.employee_tin || p.tin || '',
              basic,
              ...computeEthiopianTax(basic, 30, 0, 0, transport),
            };
          });
          setEmployees(loadedRows);
          setPerLicenseEmployees((prev) => ({ ...prev, [currentLic]: loadedRows }));
        }
      }
    } catch (err) {
      console.error('Failed to load payroll:', err);
    }
  };

  const handleUpdateEmployee = (id: string, field: keyof EmployeeRow, val: any) => {
    setEmployees((prev) => {
      const updated = prev.map((emp) => {
        if (emp.id !== id) return emp;
        const u = { ...emp, [field]: val };
        const basic = Number(field === 'basic' ? val : u.basic) || 0;
        const workDays = Number(field === 'workDays' ? val : u.workDays) || 30;
        const overtime = Number(field === 'overtime' ? val : u.overtime) || 0;
        const taxableAllowance = Number(field === 'taxableAllowance' ? val : u.taxableAllowance) || 0;
        const transport = Number(field === 'transport' ? val : u.transport) || 0;
        const advance = Number(field === 'advance' ? val : u.advance) || 0;
        const otherDeductions = Number(field === 'otherDeductions' ? val : u.otherDeductions) || 0;
        const calc = computeEthiopianTax(basic, workDays, overtime, taxableAllowance, transport, advance, otherDeductions);
        return { ...u, ...calc };
      });
      setPerLicenseEmployees((p) => ({ ...p, [activeLicenseId]: updated }));
      return updated;
    });
  };

  const handleAddEmployeeRow = () => {
    const newId = `emp-${Date.now()}`;
    const newEmp: EmployeeRow = {
      id: newId,
      name: `Staff Member ${employees.length + 1}`,
      tin: '',
      basic: 10000,
      ...computeEthiopianTax(10000, 30),
    };
    setEmployees((prev) => {
      const updated = [...prev, newEmp];
      setPerLicenseEmployees((p) => ({ ...p, [activeLicenseId]: updated }));
      return updated;
    });
  };

  const handleRemoveEmployeeRow = (id: string) => {
    if (employees.length <= 1) {
      toast.warning('Must keep at least one employee in payroll.');
      return;
    }
    setEmployees((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      setPerLicenseEmployees((p) => ({ ...p, [activeLicenseId]: updated }));
      return updated;
    });
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
        setEmployees(newRows);
        setPerLicenseEmployees((p) => ({ ...p, [activeLicenseId]: newRows }));
        toast.success(`Imported ${newRows.length} staff records from CSV for ${activeLicense?.license_name}! Opening calculator...`);
        setIsPayrollModalOpen(true);
      }
    };
    reader.readAsText(file);
  };

  const payrollTotals = employees.reduce(
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

  const totalPayrollDeduction = Math.round((payrollTotals.net + payrollTotals.tax + payrollTotals.pensionEmp + payrollTotals.pensionOrg) * 100) / 100;

  const handleConfirmPayrollRun = async () => {
    setPayrollPosting(true);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/company/payroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          license_id: activeLicenseId,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          employees,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post payroll');

      toast.success(`Payroll processed for ${activeLicense?.license_name || 'License'}! ${totalPayrollDeduction.toLocaleString()} ETB deducted from Company Bank Balance.`);
      setLastCalculatedAt(new Date().toISOString());
      setIsPayrollModalOpen(false);
      fetchPayroll(activeLicenseId);
      fetchTreasury(activeLicenseId); // Updates available bank balance
    } catch (err: any) {
      handleAuthError(err, 'Error processing payroll');
    } finally {
      setPayrollPosting(false);
    }
  };

  const handleDownloadPayrollCSV = () => {
    const headers = 'S/N,Name of Employees,Basic Salary,Worked Days,Basic Salary Earned During the Month,Over time,Taxable Allowance,Nontaxable Allowance (Transport),Pension 11%,Gross Earning,Total Taxable Earning,Total Income Tax,Pension 7%,Advance,Other Deductions,Total Deductions,Net Pay';
    const rows = employees.map(
      (e, idx) =>
        `${idx + 1},"${e.name}",${e.basic},${e.workDays},${e.earnedBasic},${e.overtime},${e.taxableAllowance},${e.transport},${e.pensionOrg},${e.gross},${e.taxableIncome},${e.tax},${e.pensionEmp},${e.advance},${e.otherDeductions},${e.totalDeductions},${e.net}`
    );
    const totalRow = `TOTAL,${payrollTotals.basic},,${payrollTotals.earnedBasic},,,,${payrollTotals.pensionOrg},${payrollTotals.gross},${payrollTotals.taxableIncome},${payrollTotals.tax},${payrollTotals.pensionEmp},,,,${payrollTotals.totalDeductions},${payrollTotals.net}`;
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows, totalRow].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ethiopia_Payroll_Sheet_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Payroll sheet CSV downloaded!');
  };

  // ==========================================
  // 4. WORD-STYLE AGREEMENT EDITOR STATE
  // ==========================================
  const DEFAULT_PUBLISHED_AGREEMENTS = [
    {
      id: 'tpl-1',
      title: 'Standard Ethiopian Employment Agreement (á‹¨á‰…áŒ¥áˆ­ á‹áˆ áˆµáˆáˆáŠá‰µ)',
      category: 'Labour / HR',
      desc: 'Compliant with Labour Proclamation No. 1156/2019. Covers employee job duties, probation period, monthly salary, 7% & 11% pension deductions, annual leave, and lawful termination terms.',
      updatedAt: '2026-11-15',
      html: `
<h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 16px;">
  á‹¨á‰…áŒ¥áˆ­ á‹áˆ áˆµáˆáˆáŠá‰µ (EMPLOYMENT AGREEMENT)
</h2>
<p style="margin-bottom: 12px;">
  á‹­áˆ… á‹¨á‰…áŒ¥áˆ­ á‹áˆ áˆµáˆáˆáŠá‰µ á‰ áŠ áˆ°áˆªá‹ <strong>${user?.fullName || 'Amis Financial Enterprise'}</strong> (á‹¨áŒá‰¥áˆ­ áŠ¨á‹á‹­ áˆ˜áˆˆá‹« á‰áŒ¥áˆ­: <strong>${user?.tinNumber || '0012938475'}</strong>) áŠ¥áŠ“ á‰ áˆ°áˆ«á‰°áŠ›á‹ áˆ˜áŠ«áŠ¨áˆ á‰ áŠ áˆ°áˆªáŠ“ áˆ°áˆ«á‰°áŠ› áŒ‰á‹³á‹­ áŠ á‹‹áŒ… á‰áŒ¥áˆ­ 1156/2011 (Labour Proclamation No. 1156/2019) áˆ˜áˆ°áˆ¨á‰µ á‰°á‹˜áŒ‹áŒ…á‰¶ á‹›áˆ¬ á‰°áˆáˆ­áˆŸáˆá¢
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  1. á‹¨áˆµáˆ« áˆ˜á‹°á‰¥ áŠ¥áŠ“ áŠƒáˆ‹áŠáŠá‰µ (Job Position & Duties)
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  áˆ°áˆ«á‰°áŠ›á‹ á‰ á‰°áˆ°áŒ á‹ á‹¨áˆ¥áˆ« á‹áˆ­á‹áˆ­ áˆ˜áˆ áˆ¨á‰µ áˆ™á‹«á‹Š áŒá‹´á‰³á‹áŠ• á‰ á‰³áˆ›áŠáŠá‰µá£ á‰ áŒ¥áˆ«á‰µ áŠ¥áŠ“ á‰ á‰µáŒ‹á‰µ áˆˆáˆ›áŠ¨áŠ“á‹ˆáŠ• á‰°áˆµáˆ›áˆá‰·áˆá¢ á‹¨áˆµáˆ« á‰¦á‰³á‹ á‰ áŠ á‹²áˆµ áŠ á‰ á‰£ á‹‹áŠ“ áˆ˜/á‰¤á‰µ á‹­áˆ†áŠ“áˆá¢
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  2. á‹°áˆ˜á‹ˆá‹ áŠ¥áŠ“ á‹¨áŒá‰¥áˆ­ á‰°á‰€áŠ“áˆ½ (Compensation & Statutory Deductions)
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  á‹¨áˆ°áˆ«á‰°áŠ›á‹ á‹ˆáˆ­áˆƒá‹Š áˆ˜áˆ°áˆ¨á‰³á‹Š á‹°áˆ˜á‹ˆá‹ á‰ áˆ•áŒ á‰ á‰°á‹°áŠáŒˆáŒˆá‹ áˆ˜áˆ áˆ¨á‰µ á‹¨áˆšáŠ¨áˆáˆ áˆ²áˆ†áŠ•á£ á‰ 2017/2025 á‹¨áŒˆá‰¢ áŒá‰¥áˆ­ áŠ á‹‹áŒ… áˆ˜áˆ°áˆ¨á‰µ á‰°áŒˆá‰¢á‹ á‹¨áˆµáˆ« áŒá‰¥áˆ­ áŠ¥áŠ“ 7% á‹¨áˆ°áˆ«á‰°áŠ› áŠ¥áŠ•á‹²áˆáˆ 11% á‹¨áŠ áˆ°áˆª á‹¨áŒ¡áˆ¨á‰³ áˆ˜á‹‹áŒ® á‰°á‰€áŠ“áˆ½ á‰°á‹°áˆ­áŒŽ á‰ á‹ˆá‰…á‰± áˆˆáˆ˜áŠ•áŒáˆµá‰µ áŒˆá‰¢ á‹­á‹°áˆ¨áŒ‹áˆá¢
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  3. á‹¨á‹áˆ á€áŠ“á‰ á‰µ áŒŠá‹œ áŠ¥áŠ“ áˆ›á‰‹áˆ¨áŒ¥ (Term & Termination)
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  á‹­áˆ… á‹áˆ áˆ‹áˆá‰°á‹ˆáˆ°áŠ áŒŠá‹œ á‹¨á€áŠ“ áˆ²áˆ†áŠ• á‰ áŠ á‹‹áŒ… á‰áŒ¥áˆ­ 1156/2011 á‰ á‰°á‹°áŠáŒˆáŒ‰á‰µ á‹µáŠ•áŒ‹áŒŒá‹Žá‰½ áˆ˜áˆ áˆ¨á‰µ á‰¥á‰» á‹­á‰‹áˆ¨áŒ£áˆá¢
</p>
<br/>
<div style="display: flex; justify-content: space-between; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
  <div><strong>áŠ áˆ°áˆª (Employer):</strong> ______________________</div>
  <div><strong>áˆ°áˆ«á‰°áŠ› (Employee):</strong> ______________________</div>
</div>
      `,
    },
    {
      id: 'tpl-2',
      title: 'Commercial Property & Office Lease Agreement (á‹¨á‰¢áˆ® áŠªáˆ«á‹­ á‹áˆ)',
      category: 'Real Estate / Leases',
      desc: 'Commercial rental agreement for premises in Addis Ababa. Includes monthly rental rate, security deposit, utility charges, maintenance obligations, and tax withholding compliance.',
      updatedAt: '2026-11-10',
      html: `
<h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 16px;">
  á‹¨á‰¢áˆ®áŠ“ á‹¨áŠ•áŒá‹µ á‰¤á‰µ áŠªáˆ«á‹­ á‹áˆ áˆµáˆáˆáŠá‰µ (COMMERCIAL LEASE AGREEMENT)
</h2>
<p style="margin-bottom: 12px;">
  á‹­áˆ… á‹¨áŠªáˆ«á‹­ á‹áˆ áˆµáˆáˆáŠá‰µ á‰ áŠ áŠ¨áˆ«á‹­ áŠ¥áŠ“ á‰ á‰°áŠ¨áˆ«á‹­ <strong>${user?.fullName || 'Amis Financial Enterprise'}</strong> (TIN: <strong>${user?.tinNumber || '0012938475'}</strong>) áˆ˜áŠ«áŠ¨áˆ á‰ áŠ á‹²áˆµ áŠ á‰ á‰£ áŠ¨á‰°áˆ› á‰°á‹°áˆ­áŒ“áˆá¢
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  1. á‹¨á‰°áŠ¨áˆ«á‹¨á‹ áŠ•á‰¥áˆ¨á‰µ áŠ¥áŠ“ á‹¨áŠªáˆ«á‹­ á‹‹áŒ‹
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  á‰°áŠ¨áˆ«á‹© á‹¨á‰°áŒ á‰€áˆ°á‹áŠ• á‹¨áŠ•áŒá‹µ á‰¢áˆ® á‰ á‹ˆáˆ­ á‹¨á‰°áˆµáˆ›áˆ™á‰ á‰µáŠ• áŠªáˆ«á‹­ á‰ á‹¨á‹ˆáˆ© áˆ˜áŒ€áˆ˜áˆªá‹« 5 á‰€áŠ“á‰µ á‹áˆµáŒ¥ áˆˆáˆ˜áŠ­áˆáˆ á‰°áˆµáˆ›áˆá‰·áˆá¢ á‰°áŠ¨áˆ«á‹© á‰ áˆ•áŒ á‹¨á‰°áŒ£áˆˆá‹áŠ• á‹¨áŠªáˆ«á‹­ áŒˆá‰¢ áŒá‰¥áˆ­ á‰°á‰€áŠ“áˆ½ (Withholding Tax) á‰ áˆ›á‹µáˆ¨áŒ á‹°áˆ¨áˆ°áŠ á‹­áˆ°áŒ£áˆá¢
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  2. á‹¨á‹áˆ á‰†á‹­á‰³
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  á‹­áˆ… á‹áˆ áˆˆáŠ áŠ•á‹µ (1) á‹“áˆ˜á‰µ á‹¨á€áŠ“ áˆ†áŠ– á‰ áˆáˆˆá‰±áˆ á‹ˆáŒˆáŠ–á‰½ á‹¨áŒ‹áˆ« áˆµáˆáˆáŠá‰µ áˆŠá‰³á‹°áˆµ á‹­á‰½áˆ‹áˆá¢
</p>
<br/>
<div style="display: flex; justify-content: space-between; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
  <div><strong>áŠ áŠ¨áˆ«á‹­ (Landlord):</strong> ______________________</div>
  <div><strong>á‰°áŠ¨áˆ«á‹­ (Tenant):</strong> ______________________</div>
</div>
      `,
    },
    {
      id: 'tpl-3',
      title: 'Equipment & Goods Supply Agreement (á‹¨á‹•á‰ƒáŠ“ áˆ˜áˆ£áˆªá‹«á‹Žá‰½ áŠ á‰…áˆ­á‰¦á‰µ á‹áˆ)',
      category: 'Procurement / Stock',
      desc: 'Goods procurement terms covering quality inspection, VAT 15% invoicing, delivery timelines, and 3% withholding tax compliance on transactions above 10,000 ETB.',
      updatedAt: '2026-11-08',
      html: `
<h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 16px;">
  á‹¨á‹•á‰ƒáŠ“ áˆ˜áˆ£áˆªá‹«á‹Žá‰½ áŠ á‰…áˆ­á‰¦á‰µ á‹áˆ (GOODS SUPPLY AGREEMENT)
</h2>
<p style="margin-bottom: 12px;">
  á‹­áˆ… á‹¨áŠ á‰…áˆ­á‰¦á‰µ á‹áˆ á‰ áŠ á‰…áˆ«á‰¢ áŠ¥áŠ“ á‰ áŒˆá‹¢ <strong>${user?.fullName || 'Amis Financial Enterprise'}</strong> áˆ˜áŠ«áŠ¨áˆ á‰°á‹°áˆ­áŒ“áˆá¢
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  1. á‹¨á‹•á‰ƒá‹ á‹“á‹­áŠá‰µ áŠ¥áŠ“ á‹¨áŒ¥áˆ«á‰µ á‹°áˆ¨áŒƒ
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  áŠ á‰…áˆ«á‰¢á‹ á‰ áŒá‹¢ á‰µá‹•á‹›á‹™ (Purchase Order) áˆ‹á‹­ á‹¨á‰°áˆ˜áˆˆáŠ¨á‰±á‰µáŠ• áŠ¥á‰ƒá‹Žá‰½ á‰ á‰°áŒˆá‰¢á‹ áŒ¥áˆ«á‰µ áŠ¥áŠ“ áˆ˜áŒ áŠ• á‰ á‹ˆá‰…á‰± á‹¨áˆ›áˆµáˆ¨áŠ¨á‰¥ áŠƒáˆ‹áŠáŠá‰µ áŠ áˆˆá‰ á‰µá¢
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  2. áŠ­áá‹« áŠ¥áŠ“ á‹¨á‰³áŠ­áˆµ á‹°áˆ¨áˆ°áŠ
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  áŠ­áá‹«á‹ á‹¨áˆšáˆáŒ¸áˆ˜á‹ áˆ•áŒ‹á‹Š á‹¨áŒˆáŠ•á‹˜á‰¥ áˆ˜á‰€á‰ á‹« á‹¨áŒ¥áˆ¬ áŒˆáŠ•á‹˜á‰¥ áˆ˜áˆ˜á‹áŒˆá‰¢á‹« áˆ›áˆ½áŠ• á‹°áˆ¨áˆ°áŠ (Fiscal Cash Register Receipt) áˆ²á‰€áˆ­á‰¥ á‰¥á‰» áŠá‹á¢ 15% á‰°áŒ¨áˆ›áˆª áŠ¥áˆ´á‰µ á‰³áŠ­áˆµ (VAT) áŠ¥áŠ“ 3% á‹¨á‹Šá‹áˆ†áˆá‹²áŠ•áŒ á‰³áŠ­áˆµ á‰ áˆ•áŒ‰ áˆ˜áˆ áˆ¨á‰µ á‰°áˆáŒ»áˆš á‹­áˆ†áŠ“áˆá¢
</p>
<br/>
<div style="display: flex; justify-content: space-between; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
  <div><strong>áŠ á‰…áˆ«á‰¢ (Supplier):</strong> ______________________</div>
  <div><strong>áŒˆá‹¢ (Buyer):</strong> ______________________</div>
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

  const fetchAgreements = async (licId?: string) => {
    try {
      const token = getAuthToken();
      const currentLic = licId ?? activeLicenseId;
      const url = currentLic ? `/api/company/agreements?license_id=${encodeURIComponent(currentLic)}` : '/api/company/agreements';
      const res = await fetch(url, {
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
      const token = getAuthToken();
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
          license_id: activeLicenseId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save agreement');
      toast.success(`Agreement updated for ${activeLicense?.license_name || 'License'} with rich Word formatting!`);
      fetchAgreements(activeLicenseId);
    } catch (err: any) {
      handleAuthError(err, 'Error saving agreement');
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

  const fetchFileBoxes = async (cat?: string, licId?: string) => {
    try {
      const token = getAuthToken();
      const currentLic = licId ?? activeLicenseId;
      const params = new URLSearchParams();
      if (cat) params.set('category', cat);
      if (currentLic) params.set('license_id', currentLic);
      const url = `/api/company/fileboxes${params.toString() ? `?${params.toString()}` : ''}`;
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
      const token = getAuthToken();
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
          license_id: activeLicenseId,
        }),
      });

      const saveJson = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveJson.error || 'Failed to save to File Box');

      toast.success(`Document uploaded to ${FILE_BOX_CATEGORIES.find(c => c.key === fbUploadCat)?.title || 'File Box'} for ${activeLicense?.license_name}!`);
      setIsFileBoxModalOpen(false);
      setFbUploadFile(null);
      setFbUploadName('');
      setFbUploadNotes('');
      fetchFileBoxes(selectedFileBoxCat || undefined, activeLicenseId);
    } catch (err: any) {
      handleAuthError(err, 'Error uploading to File Box');
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

  const fetchStock = async (licId?: string) => {
    try {
      const token = getAuthToken();
      const currentLic = licId ?? activeLicenseId;
      const url = currentLic ? `/api/company/stock?license_id=${encodeURIComponent(currentLic)}` : '/api/company/stock';
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.products) {
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
      const token = getAuthToken();
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
          license_id: activeLicenseId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add product');

      toast.success(`Product "${newProdName}" added to ${activeLicense?.license_name || 'Stock'}!`);
      setIsNewProductModalOpen(false);
      setNewProdName('');
      setNewProdCode('');
      setNewProdImage('');
      fetchStock(activeLicenseId);
    } catch (err: any) {
      handleAuthError(err, 'Error adding product');
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleProductImageUpload = async (file: File) => {
    setProdImageUploading(true);
    try {
      const token = getAuthToken();
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
      handleAuthError(err, 'Failed to upload product image');
    } finally {
      setProdImageUploading(false);
    }
  };

  const handleStockAdjustSubmit = async () => {
    if (!selectedStockProduct || !adjustQty) return;
    try {
      const token = getAuthToken();
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
          license_id: activeLicenseId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to adjust stock');

      toast.success('Stock movement recorded and on-hand balance updated!');
      setIsStockAdjustModalOpen(false);
      fetchStock(activeLicenseId);
    } catch (err: any) {
      handleAuthError(err, 'Error adjusting stock');
    }
  };

  const setEmployeesForLicense = (licId: string, rows: EmployeeRow[]) => {
    setPerLicenseEmployees((prev) => ({ ...prev, [licId]: rows }));
    if (licId === activeLicenseId) {
      setEmployees(rows);
    }
  };

  // Initial Load: Fetch assigned licenses first, then fetch all module data scoped to the primary license
  useEffect(() => {
    fetchLicenses().then((primaryId) => {
      loadAllDataForLicense(primaryId);
    });
  }, []);

  // Refetch the receipt list when the month or the sales/purchases view changes.
  useEffect(() => {
    if (!user) return;
    fetchReceipts();
  }, [receiptMonth, receiptView]);

  // Load the ledger the first time the accounting tab is opened.
  useEffect(() => {
    if (activeTab === 'ledger' && !ledgerReport && !ledgerLoading) {
      fetchLedger();
    }
  }, [activeTab]);

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
                  <span>â€¢</span>
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
            { id: 'receipts', label: 'Sales & Purchase Register', icon: Receipt },
            { id: 'ledger', label: 'Accounting (Peachtree)', icon: BookOpen },
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

        {/* LICENSE SELECTOR BAR */}
        {companyLicenses.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/40 rounded-xl border border-border">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                License / Branch:
              </span>
              {companyLicenses.map((lic) => {
                const isActive = activeLicenseId === lic.id;
                return (
                  <button
                    key={lic.id}
                    onClick={() => handleSelectLicense(lic.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground shadow-xs font-semibold'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-border/80'
                    }`}
                  >
                    <span>{lic.license_name}</span>
                    {lic.license_number && (
                      <span className="font-mono text-[10px] opacity-75">#{lic.license_number}</span>
                    )}
                    {lic.is_primary && (
                      <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        Primary
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Scoped strictly to: </span>
              <strong className="text-foreground not-italic font-semibold">{activeLicense?.license_name}</strong>
            </div>
          </div>
        )}
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
            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-background p-4 rounded-xl border border-border">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm">Sales &amp; Purchases Workspace</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {activeLicense?.license_name || 'Main License'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Monthly register per license. Click any row to open the attached document, the extracted fields,
                  line items, and the posted journal entry.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setReceiptView('sale')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      receiptView === 'sale'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Sales
                  </button>
                  <button
                    onClick={() => setReceiptView('purchase')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      receiptView === 'purchase'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Purchases
                  </button>
                </div>
                <Input
                  type="month"
                  value={receiptMonth}
                  onChange={(e) => e.target.value && setReceiptMonth(e.target.value)}
                  className="h-8 w-[150px] text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchReceipts()}
                  disabled={receiptsLoading}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${receiptsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </Button>
                <Button size="sm" onClick={openReceiptModal} className="h-8 gap-1.5 text-xs shadow-xs">
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Receipt Entry</span>
                </Button>
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border shadow-xs">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Sales · {receiptMonthLabel}
                    </span>
                    {receiptView === 'sale' && <Badge variant="secondary" className="text-[9px]">viewing</Badge>}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold">{formatMoney(receiptSummary?.sales?.total)}</span>
                    <span className="text-[10px] text-muted-foreground">ETB</span>
                    {renderGrowth(receiptSummary?.growth?.sales)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {receiptSummary?.sales?.count ?? 0} invoices · VAT {formatMoney(receiptSummary?.sales?.vat)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-xs">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Purchases · {receiptMonthLabel}
                    </span>
                    {receiptView === 'purchase' && <Badge variant="secondary" className="text-[9px]">viewing</Badge>}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold">{formatMoney(receiptSummary?.purchases?.total)}</span>
                    <span className="text-[10px] text-muted-foreground">ETB</span>
                    {renderGrowth(receiptSummary?.growth?.purchases)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {receiptSummary?.purchases?.count ?? 0} receipts · WHT{' '}
                    {formatMoney(receiptSummary?.purchases?.wht)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Net movement
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className={`text-xl font-bold ${
                        (receiptSummary?.sales?.total ?? 0) - (receiptSummary?.purchases?.total ?? 0) < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-foreground'
                      }`}
                    >
                      {formatMoney((receiptSummary?.sales?.total ?? 0) - (receiptSummary?.purchases?.total ?? 0))}
                    </span>
                    <span className="text-[10px] text-muted-foreground">ETB</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Sales minus purchases for the month</p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    VAT payable
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold">
                      {formatMoney((receiptSummary?.sales?.vat ?? 0) - (receiptSummary?.purchases?.vat ?? 0))}
                    </span>
                    <span className="text-[10px] text-muted-foreground">ETB</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Output VAT − input VAT (before TOT)</p>
                </CardContent>
              </Card>
            </div>

            {/* Status cards + growth chart */}
            <div className="grid gap-3 lg:grid-cols-3">
              <Card className="border-border shadow-xs">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-xs font-semibold">Receipt status</CardTitle>
                  <CardDescription className="text-[10px]">All receipts in {receiptMonthLabel}</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 space-y-2">
                  {[
                    { label: 'Registered', value: receiptSummary?.byState?.registered ?? 0, tone: 'text-emerald-600' },
                    { label: 'Draft / OCR done', value: receiptSummary?.byState?.draft ?? 0, tone: 'text-amber-600' },
                    { label: 'Cancelled', value: receiptSummary?.byState?.cancelled ?? 0, tone: 'text-muted-foreground' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={`font-semibold ${row.tone}`}>{row.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">With evidence attached</span>
                    <span className="font-semibold">
                      {receiptsList.filter((r) => r.has_evidence).length}/{receiptsList.length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-xs">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-xs font-semibold">Month-over-month</CardTitle>
                  <CardDescription className="text-[10px]">
                    Compared with {receiptSummary?.previousMonth || 'the previous month'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Sales growth</span>
                    {renderGrowth(receiptSummary?.growth?.sales)}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Purchase growth</span>
                    {renderGrowth(receiptSummary?.growth?.purchases)}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Sales invoices</span>
                    <span className="font-semibold">{receiptSummary?.sales?.count ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Purchase receipts</span>
                    <span className="font-semibold">{receiptSummary?.purchases?.count ?? 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-xs">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-xs font-semibold">This month at a glance</CardTitle>
                  <CardDescription className="text-[10px]">{activeLicense?.license_name}</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Untaxed sales</span>
                    <span>{formatMoney(receiptSummary?.sales?.untaxed)} ETB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Untaxed purchases</span>
                    <span>{formatMoney(receiptSummary?.purchases?.untaxed)} ETB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">WHT withheld on purchases</span>
                    <span>{formatMoney(receiptSummary?.purchases?.wht)} ETB</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                    Data is isolated to the selected license. Switch licence above to see another branch.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border shadow-xs">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-semibold">Daily growth · {receiptMonthLabel}</CardTitle>
                <CardDescription className="text-[10px]">Sales vs purchases total per day (ETB)</CardDescription>
                <CardAction className="self-center">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Sales
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Purchases
                    </span>
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="px-2 pb-4 pt-0">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={(receiptSummary?.daily ?? []).map((day: any) => ({
                        day: day.date.slice(8),
                        sales: day.sales,
                        purchases: day.purchases,
                      }))}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="purchaseFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={54}
                        tickFormatter={(value) => Number(value).toLocaleString()}
                      />
                      <RechartsTooltip
                        formatter={(value: any) => `${formatMoney(Number(value))} ETB`}
                        labelFormatter={(label) => `Day ${label}`}
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        name="Sales"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#salesFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="purchases"
                        name="Purchases"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#purchaseFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-xs">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-semibold capitalize">{receiptView} register</CardTitle>
                <CardDescription className="text-[10px]">
                  {receiptsList.length} record(s) · click a row for the attached document and extracted data
                </CardDescription>
                <CardAction className="self-center">
                  <Badge variant="outline" className="text-[10px]">
                    {receiptMonthLabel}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Date</TableHead>
                      <TableHead>FS / Machine</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Supply</TableHead>
                      <TableHead className="text-right">Untaxed</TableHead>
                      <TableHead className="text-right">VAT</TableHead>
                      <TableHead className="text-right">WHT</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiptsList.map((r) => (
                      <TableRow
                        key={r.id}
                        onClick={() => fetchReceiptDetail(r.id)}
                        className="text-xs cursor-pointer hover:bg-muted/40"
                      >
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {r.receipt_date || '—'}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-medium block">{r.fs_number}</span>
                          <span className="text-[10px] font-mono text-muted-foreground block">
                            {r.machine_number || 'no machine'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{r.partner_name}</span>
                          <span className="block text-[10px] font-mono text-muted-foreground">
                            {r.partner_tin || 'no TIN'}
                          </span>
                        </TableCell>
                        <TableCell className="capitalize text-[11px] text-muted-foreground">
                          {r.supply_type || 'unknown'}
                        </TableCell>
                        <TableCell className="text-right">{formatMoney(r.untaxed_amount)}</TableCell>
                        <TableCell className="text-right text-blue-600 dark:text-blue-400">
                          +{formatMoney(r.vat_15)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                          {r.wht_3 ? `-${formatMoney(r.wht_3)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right font-bold whitespace-nowrap">
                          {formatMoney(r.total_amount)} ETB
                        </TableCell>
                        <TableCell>
                          {r.has_evidence ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                              <Paperclip className="w-3 h-3" /> attached
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">none</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                            {r.state || 'registered'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {receiptsList.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-10 text-xs text-muted-foreground">
                          {receiptsLoading
                            ? 'Loading receipts…'
                            : `No ${receiptView} receipts registered for ${receiptMonthLabel}.`}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Receipt detail dialog */}
        <Dialog
          open={Boolean(selectedReceiptId)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedReceiptId(null);
              setReceiptDetail(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" />
                {receiptDetail?.receipt?.fs_number
                  ? `Receipt ${receiptDetail.receipt.fs_number}`
                  : 'Receipt details'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {receiptDetail?.receipt
                  ? `${receiptDetail.receipt.partner_name || 'Unknown partner'} · ${
                      receiptDetail.receipt.receipt_date || 'no date'
                    } · ${receiptDetail.receipt.receipt_type}`
                  : 'Loading the stored document and extracted fields…'}
              </DialogDescription>
            </DialogHeader>

            {receiptDetailLoading && (
              <div className="py-10 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading receipt…
              </div>
            )}

            {!receiptDetailLoading && receiptDetail?.receipt && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {receiptDetail.receipt.receipt_type}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {receiptDetail.receipt.state || 'registered'}
                  </Badge>
                  {receiptDetail.receipt.vat_treatment && (
                    <Badge variant="outline" className="text-[10px]">
                      VAT: {String(receiptDetail.receipt.vat_treatment).replace('_', ' ')}
                    </Badge>
                  )}
                  {receiptDetail.receipt.supply_type && (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {receiptDetail.receipt.supply_type}
                    </Badge>
                  )}
                  {receiptDetail.receipt.license_id && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      license: {receiptDetail.receipt.license_id}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    { label: 'Partner TIN', value: receiptDetail.receipt.partner_tin || '—', mono: true },
                    { label: 'Buyer TIN', value: receiptDetail.receipt.buyer_tin || '—', mono: true },
                    { label: 'Seller TIN', value: receiptDetail.receipt.seller_tin || '—', mono: true },
                    { label: 'Machine No.', value: receiptDetail.receipt.machine_number || '—', mono: true },
                    { label: 'Untaxed', value: `${formatMoney(receiptDetail.receipt.untaxed_amount)} ETB` },
                    { label: 'VAT', value: `${formatMoney(receiptDetail.receipt.vat_amount)} ETB` },
                    {
                      label: `WHT ${receiptDetail.receipt.wht_rate ? `(${receiptDetail.receipt.wht_rate}%)` : ''}`,
                      value: `${formatMoney(receiptDetail.receipt.wht_amount)} ETB`,
                    },
                    { label: 'Total', value: `${formatMoney(receiptDetail.receipt.total_amount)} ETB`, strong: true },
                  ].map((field) => (
                    <div key={field.label} className="rounded-lg border border-border p-2 bg-muted/30">
                      <div className="text-[10px] text-muted-foreground">{field.label}</div>
                      <div
                        className={`${field.mono ? 'font-mono' : ''} ${
                          field.strong ? 'font-bold' : 'font-medium'
                        } truncate`}
                      >
                        {field.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Evidence */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" /> Attached documents
                  </div>
                  {(receiptDetail.evidence ?? []).length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      No document stored for this receipt (it may have been entered manually or the upload was not kept).
                    </p>
                  )}
                  {(receiptDetail.evidence ?? []).map((item: any, idx: number) => (
                    <div key={`${item.kind}-${idx}`} className="border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 text-[11px]">
                        <span className="font-medium capitalize">
                          {item.kind === 'pos_receipt' ? 'Cash register receipt' : 'Company document'}
                          {item.name ? ` · ${item.name}` : ''}
                        </span>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" /> Open
                          </a>
                        )}
                      </div>
                      {item.url ? (
                        item.mimeType === 'application/pdf' ? (
                          <iframe src={item.url} title={item.name || 'Receipt PDF'} className="w-full h-72" />
                        ) : (
                          <img
                            src={item.url}
                            alt={item.name || 'Receipt'}
                            className="max-h-[420px] w-full object-contain bg-background"
                          />
                        )
                      ) : (
                        <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                          Preview unavailable.
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {(receiptDetail.lines ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold">Line items</div>
                    <div className="border border-border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[10px]">
                            <TableHead>#</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Unit price</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">VAT</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {receiptDetail.lines.map((line: any) => (
                            <TableRow key={line.id} className="text-[11px]">
                              <TableCell>{line.line_no}</TableCell>
                              <TableCell>{line.description}</TableCell>
                              <TableCell className="text-right">{line.quantity ?? '—'}</TableCell>
                              <TableCell className="text-right">{formatMoney(line.unit_price)}</TableCell>
                              <TableCell className="text-right">{formatMoney(line.untaxed_amount)}</TableCell>
                              <TableCell className="text-right">{formatMoney(line.vat_amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Journal entry
                  </div>
                  {receiptDetail.journal ? (
                    <div className="border border-border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[10px]">
                            <TableHead>Account</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {receiptDetail.journal.lines.map((line: any, idx: number) => (
                            <TableRow key={idx} className="text-[11px]">
                              <TableCell className="font-medium">{line.account}</TableCell>
                              <TableCell className="text-muted-foreground">{line.description}</TableCell>
                              <TableCell className="text-right">{line.debit ? formatMoney(line.debit) : '—'}</TableCell>
                              <TableCell className="text-right">{line.credit ? formatMoney(line.credit) : '—'}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="text-[11px] font-bold bg-muted/40">
                            <TableCell colSpan={2}>Total</TableCell>
                            <TableCell className="text-right">{formatMoney(receiptDetail.journal.totalDebit)}</TableCell>
                            <TableCell className="text-right">{formatMoney(receiptDetail.journal.totalCredit)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Not posted to the ledger yet. Use the Accounting tab → “Post receipts to ledger”.
                    </p>
                  )}
                </div>

                {receiptDetail.receipt.ocr_warnings && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-[11px] text-amber-700 dark:text-amber-400 space-y-1">
                    <div className="font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Extraction warnings
                    </div>
                    {String(receiptDetail.receipt.ocr_warnings)
                      .split('\n')
                      .filter(Boolean)
                      .map((note: string, idx: number) => (
                        <div key={idx}>• {note}</div>
                      ))}
                  </div>
                )}

                {receiptDetail.receipt.raw_text && (
                  <details className="border border-border rounded-lg">
                    <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium bg-muted/40">
                      Raw OCR text ({receiptDetail.receipt.ocr_engine || 'unknown engine'})
                    </summary>
                    <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-56 overflow-y-auto p-3">
                      {receiptDetail.receipt.raw_text}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedReceiptId(null)} className="text-xs h-8">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================================= */}
        {/* TAB: ACCOUNTING / GENERAL LEDGER (PEACHTREE-STYLE) */}
        {/* ========================================================= */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-background p-4 rounded-xl border border-border">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm">General Ledger &amp; Financial Statements</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {activeLicense?.license_name || 'Main License'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Double-entry ledger fed by the sales and purchase registers. Chart of accounts is seeded per
                  Ethiopian SME practice (VAT, TOT, WHT, payroll).
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={ledgerFrom}
                    onChange={(e) => e.target.value && setLedgerFrom(e.target.value)}
                    className="h-8 w-[140px] text-xs"
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={ledgerTo}
                    onChange={(e) => e.target.value && setLedgerTo(e.target.value)}
                    className="h-8 w-[140px] text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchLedger()}
                  disabled={ledgerLoading}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ledgerLoading ? 'animate-spin' : ''}`} />
                  Load
                </Button>
                <Button
                  size="sm"
                  onClick={syncLedger}
                  disabled={ledgerLoading}
                  className="h-8 gap-1.5 text-xs shadow-xs"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Post receipts to ledger
                </Button>
              </div>
            </div>

            {(ledgerReport?.unpostedReceipts ?? 0) > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>{ledgerReport.unpostedReceipts}</strong> receipt(s) in this period are not posted to the
                  ledger yet. Use “Post receipts to ledger” to generate the journal entries.
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Debits = credits
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className={`text-lg font-bold ${
                        ledgerReport &&
                        Math.round(ledgerReport.trialBalance.totalDebit * 100) ===
                          Math.round(ledgerReport.trialBalance.totalCredit * 100)
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatMoney(ledgerReport?.trialBalance?.totalDebit)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">ETB</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Credits {formatMoney(ledgerReport?.trialBalance?.totalCredit)} ETB
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Net profit
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className={`text-lg font-bold ${
                        (ledgerReport?.profitAndLoss?.netProfit ?? 0) < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-foreground'
                      }`}
                    >
                      {formatMoney(ledgerReport?.profitAndLoss?.netProfit)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">ETB</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Income {formatMoney(ledgerReport?.profitAndLoss?.totalIncome)} · Expenses{' '}
                    {formatMoney(ledgerReport?.profitAndLoss?.totalExpenses)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    VAT net payable
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-lg font-bold">{formatMoney(ledgerReport?.vatReturn?.netPayable)}</span>
                    <span className="text-[10px] text-muted-foreground">ETB</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Output {formatMoney(ledgerReport?.vatReturn?.outputVat)} · Input{' '}
                    {formatMoney(ledgerReport?.vatReturn?.inputVat)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border shadow-xs">
                <CardContent className="p-4">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Unposted receipts
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className={`text-lg font-bold ${
                        (ledgerReport?.unpostedReceipts ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {ledgerReport?.unpostedReceipts ?? 0}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Period {ledgerReport?.range?.from || ledgerFrom} → {ledgerReport?.range?.to || ledgerTo}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'trial', label: 'Trial Balance' },
                { id: 'pnl', label: 'Profit & Loss' },
                { id: 'bs', label: 'Balance Sheet' },
                { id: 'tax', label: 'VAT & WHT Return' },
                { id: 'journal', label: 'Journal Entries' },
              ].map((view) => (
                <button
                  key={view.id}
                  onClick={() => setLedgerView(view.id as any)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    ledgerView === view.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>

            {ledgerLoading && !ledgerReport && (
              <Card className="border-border shadow-xs">
                <CardContent className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Building the ledger from journal entries…
                </CardContent>
              </Card>
            )}

            {ledgerView === 'trial' && ledgerReport && (
              <Card className="border-border shadow-xs">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-xs font-semibold">Trial balance</CardTitle>
                  <CardDescription className="text-[10px]">
                    {ledgerReport.range.from} → {ledgerReport.range.to}
                  </CardDescription>
                  <CardAction className="self-center">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        Math.round(ledgerReport.trialBalance.totalDebit * 100) ===
                        Math.round(ledgerReport.trialBalance.totalCredit * 100)
                          ? 'text-emerald-600 border-emerald-500/30'
                          : 'text-red-600 border-red-500/30'
                      }`}
                    >
                      {Math.round(ledgerReport.trialBalance.totalDebit * 100) ===
                      Math.round(ledgerReport.trialBalance.totalCredit * 100)
                        ? 'Balanced'
                        : 'Out of balance'}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Code</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerReport.trialBalance.rows.map((row: any) => (
                        <TableRow key={row.code} className="text-xs">
                          <TableCell className="font-mono">{row.code}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell className="capitalize text-muted-foreground">{row.type}</TableCell>
                          <TableCell className="text-right">{row.debit ? formatMoney(row.debit) : '—'}</TableCell>
                          <TableCell className="text-right">{row.credit ? formatMoney(row.credit) : '—'}</TableCell>
                        </TableRow>
                      ))}
                      {ledgerReport.trialBalance.rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10 text-xs text-muted-foreground">
                            No journal activity in this period. Post receipts or widen the date range.
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow className="text-xs font-bold bg-muted/40">
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell className="text-right">{formatMoney(ledgerReport.trialBalance.totalDebit)}</TableCell>
                        <TableCell className="text-right">{formatMoney(ledgerReport.trialBalance.totalCredit)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {ledgerView === 'pnl' && ledgerReport && (
              <div className="grid gap-3 lg:grid-cols-2">
                <Card className="border-border shadow-xs">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-semibold">Income</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableBody>
                        {ledgerReport.profitAndLoss.income.map((row: any) => (
                          <TableRow key={row.code} className="text-xs">
                            <TableCell className="font-mono w-[70px]">{row.code}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                        {ledgerReport.profitAndLoss.income.length === 0 && (
                          <TableRow>
                            <TableCell className="text-center py-6 text-xs text-muted-foreground">
                              No income posted
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow className="text-xs font-bold bg-muted/40">
                          <TableCell colSpan={2}>Total income</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(ledgerReport.profitAndLoss.totalIncome)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <Card className="border-border shadow-xs">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-semibold">Expenses</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableBody>
                        {ledgerReport.profitAndLoss.expenses.map((row: any) => (
                          <TableRow key={row.code} className="text-xs">
                            <TableCell className="font-mono w-[70px]">{row.code}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                        {ledgerReport.profitAndLoss.expenses.length === 0 && (
                          <TableRow>
                            <TableCell className="text-center py-6 text-xs text-muted-foreground">
                              No expenses posted
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow className="text-xs font-bold bg-muted/40">
                          <TableCell colSpan={2}>Total expenses</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(ledgerReport.profitAndLoss.totalExpenses)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <Card className="border-border shadow-xs lg:col-span-2">
                  <CardContent className="p-4 flex items-center justify-between">
                    <span className="text-sm font-semibold">Net profit / (loss)</span>
                    <span
                      className={`text-lg font-bold ${
                        ledgerReport.profitAndLoss.netProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600'
                      }`}
                    >
                      {formatMoney(ledgerReport.profitAndLoss.netProfit)} ETB
                    </span>
                  </CardContent>
                </Card>
              </div>
            )}

            {ledgerView === 'bs' && ledgerReport && (
              <div className="grid gap-3 lg:grid-cols-3">
                {[
                  { title: 'Assets', rows: ledgerReport.balanceSheet.assets, total: ledgerReport.balanceSheet.totalAssets },
                  {
                    title: 'Liabilities',
                    rows: ledgerReport.balanceSheet.liabilities,
                    total: ledgerReport.balanceSheet.totalLiabilities,
                  },
                  { title: 'Equity', rows: ledgerReport.balanceSheet.equity, total: ledgerReport.balanceSheet.totalEquity },
                ].map((section) => (
                  <Card key={section.title} className="border-border shadow-xs">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-xs font-semibold">{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableBody>
                          {section.rows.map((row: any) => (
                            <TableRow key={row.code} className="text-xs">
                              <TableCell className="font-mono w-[60px]">{row.code}</TableCell>
                              <TableCell>{row.name}</TableCell>
                              <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                            </TableRow>
                          ))}
                          {section.title === 'Equity' && (
                            <TableRow className="text-xs">
                              <TableCell className="font-mono w-[60px]">—</TableCell>
                              <TableCell>Retained earnings (period)</TableCell>
                              <TableCell className="text-right">
                                {formatMoney(ledgerReport.balanceSheet.retainedEarnings)}
                              </TableCell>
                            </TableRow>
                          )}
                          {section.rows.length === 0 && section.title !== 'Equity' && (
                            <TableRow>
                              <TableCell className="text-center py-6 text-xs text-muted-foreground">None</TableCell>
                            </TableRow>
                          )}
                          <TableRow className="text-xs font-bold bg-muted/40">
                            <TableCell colSpan={2}>Total {section.title.toLowerCase()}</TableCell>
                            <TableCell className="text-right">{formatMoney(section.total)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
                <Card className="border-border shadow-xs lg:col-span-3">
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      Assets {formatMoney(ledgerReport.balanceSheet.totalAssets)} · Liabilities + Equity{' '}
                      {formatMoney(
                        ledgerReport.balanceSheet.totalLiabilities +
                          ledgerReport.balanceSheet.totalEquity +
                          ledgerReport.balanceSheet.retainedEarnings
                      )}{' '}
                      ETB
                    </span>
                    <span className="text-muted-foreground">
                      Difference:{' '}
                      <strong className="text-foreground">
                        {formatMoney(
                          ledgerReport.balanceSheet.totalAssets -
                            (ledgerReport.balanceSheet.totalLiabilities +
                              ledgerReport.balanceSheet.totalEquity +
                              ledgerReport.balanceSheet.retainedEarnings)
                        )}{' '}
                        ETB
                      </strong>
                    </span>
                  </CardContent>
                </Card>
              </div>
            )}

            {ledgerView === 'tax' && ledgerReport && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Output VAT (sales)', value: ledgerReport.vatReturn.outputVat },
                    { label: 'Input VAT (purchases)', value: ledgerReport.vatReturn.inputVat },
                    { label: 'Turnover tax (2%)', value: ledgerReport.vatReturn.turnoverTax },
                    { label: 'Net VAT payable', value: ledgerReport.vatReturn.netPayable },
                  ].map((item) => (
                    <Card key={item.label} className="border-border shadow-xs">
                      <CardContent className="p-4">
                        <div className="text-[11px] text-muted-foreground">{item.label}</div>
                        <div className="text-lg font-bold mt-1">{formatMoney(item.value)} ETB</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="border-border shadow-xs">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-semibold">Withholding tax schedule (purchases)</CardTitle>
                    <CardDescription className="text-[10px]">
                      2% goods, 3% services — withheld from vendor payments in this period
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead>Date</TableHead>
                          <TableHead>FS Number</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>TIN</TableHead>
                          <TableHead className="text-right">Untaxed</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">WHT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerReport.whtSchedule.map((row: any, idx: number) => (
                          <TableRow key={`${row.fs_number}-${idx}`} className="text-xs">
                            <TableCell className="text-muted-foreground">{row.date || '—'}</TableCell>
                            <TableCell className="font-mono">{row.fs_number || '—'}</TableCell>
                            <TableCell>{row.partner_name || '—'}</TableCell>
                            <TableCell className="font-mono text-muted-foreground">{row.partner_tin || '—'}</TableCell>
                            <TableCell className="text-right">{formatMoney(row.untaxed_amount)}</TableCell>
                            <TableCell className="text-right">{row.wht_rate ? `${row.wht_rate}%` : '—'}</TableCell>
                            <TableCell className="text-right font-medium">{formatMoney(row.wht_amount)}</TableCell>
                          </TableRow>
                        ))}
                        {ledgerReport.whtSchedule.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                              No withholding tax recorded in this period.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {ledgerView === 'journal' && ledgerReport && (
              <div className="space-y-2">
                {ledgerReport.journal.slice(0, 100).map((entry: any) => (
                  <Card key={entry.id} className="border-border shadow-xs">
                    <CardContent className="p-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-border bg-muted/30">
                        <div className="text-xs">
                          <span className="font-mono text-muted-foreground mr-2">{entry.date}</span>
                          <span className="font-semibold">{entry.reference || entry.source}</span>
                          <span className="text-muted-foreground ml-2">{entry.description}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          Dr {formatMoney(entry.totalDebit)} · Cr {formatMoney(entry.totalCredit)}
                        </span>
                      </div>
                      <Table>
                        <TableBody>
                          {entry.lines.map((line: any, idx: number) => (
                            <TableRow key={idx} className="text-[11px]">
                              <TableCell className="w-[220px] font-medium">{line.account}</TableCell>
                              <TableCell className="text-muted-foreground">{line.description}</TableCell>
                              <TableCell className="text-right w-[110px]">
                                {line.debit ? formatMoney(line.debit) : ''}
                              </TableCell>
                              <TableCell className="text-right w-[110px]">
                                {line.credit ? formatMoney(line.credit) : ''}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
                {ledgerReport.journal.length === 0 && (
                  <Card className="border-border shadow-xs">
                    <CardContent className="py-10 text-center text-xs text-muted-foreground">
                      No journal entries in this period.
                    </CardContent>
                  </Card>
                )}
                {ledgerReport.journal.length > 100 && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Showing the 100 most recent entries of {ledgerReport.journal.length}. Narrow the date range for the
                    rest.
                  </p>
                )}
              </div>
            )}
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
                                  {f.file_size ? `${Math.round(f.file_size / 1024)} KB` : 'â€”'}
                                </TableCell>
                                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                                  {f.notes || 'â€”'}
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
                  <h3 className="font-semibold text-sm">Ethiopian Income Tax & Payroll Calculator</h3>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                    Proclamation No. 979/2016
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calculates 7% employee pension, 11% employer pension, and progressive brackets (0 to 35%). Deducts payroll from company Bank Balance on completion.
                </p>
                {lastCalculatedAt && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    âœ“ Last calculated & deducted on: {new Date(lastCalculatedAt).toLocaleString()}
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
                  onClick={() => {
                    if (companyLicenses.length > 1) {
                      setPayrollTargetLicenseId(activeLicenseId);
                      setPayrollLicenseSelector(true);
                    } else {
                      setIsPayrollModalOpen(true);
                    }
                  }}
                  className="h-8 text-xs gap-1.5 shadow-xs"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  Calculate Income Tax & Payroll
                  {companyLicenses.length > 1 && (
                    <span className="ml-1 text-[10px] opacity-70">({activeLicense?.license_name})</span>
                  )}
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
                        <TableCell className="font-mono text-muted-foreground">{emp.tin || 'â€”'}</TableCell>
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
                      <TableCell>{payrollTotals.basic.toLocaleString()} ETB</TableCell>
                      <TableCell>â€”</TableCell>
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
                        <TableCell className="font-mono text-muted-foreground">{p.code || 'â€”'}</TableCell>
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
              <span>Fields with amber borders were not extracted â€” verify and fill manually before registering.</span>
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
                  <option value={2}>2% (Goods)</option>
                  <option value={3}>3% (Services)</option>
                  <option value={0}>0% (Not withheld)</option>
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Recommended by supply type: {supplyType === 'services' ? '3%' : supplyType === 'goods' ? '2%' : '—'}
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="vat-amount" className="text-xs">VAT Amount on Document (ETB)</Label>
                <Input
                  id="vat-amount"
                  type="number"
                  value={extractedVat ?? ''}
                  onChange={(e) => setExtractedVat(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Read from the printed receipt"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="supply-type" className="text-xs">Supply Type</Label>
                <select
                  id="supply-type"
                  value={supplyType}
                  onChange={(e) => setSupplyType(e.target.value as any)}
                  className="w-full text-xs h-9 rounded-md border border-border bg-background px-3"
                >
                  <option value="goods">Goods</option>
                  <option value="services">Services</option>
                  <option value="mixed">Mixed</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="vat-treatment" className="text-xs">VAT Treatment</Label>
                <select
                  id="vat-treatment"
                  value={vatTreatment}
                  onChange={(e) => setVatTreatment(e.target.value as any)}
                  className="w-full text-xs h-9 rounded-md border border-border bg-background px-3"
                >
                  <option value="standard">Standard rated (15%)</option>
                  <option value="zero_rated">Zero rated (0%)</option>
                  <option value="exempt">Exempt</option>
                  <option value="tot">TOT only (2%)</option>
                  <option value="unknown">Unknown</option>
                </select>
                {ocrCalendar === 'ethiopian' && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    Ethiopian calendar date converted to Gregorian ({receiptDate || '—'})
                  </p>
                )}
              </div>
            </div>

            {/* Calculations preview box */}
            <div className="bg-muted/50 p-3 rounded-lg border border-border text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount before VAT:</span>
                <span>{safeUntaxed.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between text-blue-600 dark:text-blue-400">
                <span>
                  VAT ({vatTreatment === 'standard' ? '15%' : vatTreatment === 'tot' ? 'TOT 2%' : 'not applicable'}):
                </span>
                <span>+{(vatTreatment === 'tot' ? totIncluded : effectiveVat).toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Withholding Tax ({receiptWhtRate}%):</span>
                <span>-{calculatedWht.toLocaleString()} ETB</span>
              </div>
              <div className="border-t border-border pt-1.5 flex justify-between font-bold text-foreground">
                <span>Total on Receipt:</span>
                <span>{calculatedTotal.toLocaleString()} ETB</span>
              </div>
              {extractedTotal != null && Math.abs(extractedTotal - (safeUntaxed + effectiveVat + totIncluded)) > 1 && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>
                    Receipt total ({extractedTotal.toLocaleString()} ETB) differs from untaxed + VAT items. Verify the
                    line items before posting.
                  </span>
                </div>
              )}
            </div>

            {extractedLines.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-muted-foreground">
                  Extracted line items ({extractedLines.length})
                </div>
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[10px]">
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extractedLines.map((line, idx) => (
                        <TableRow key={idx} className="text-[11px]">
                          <TableCell className="py-1.5">{line.description}</TableCell>
                          <TableCell className="py-1.5 text-right">{line.quantity ?? '—'}</TableCell>
                          <TableCell className="py-1.5 text-right">{formatMoney(line.unit_price)}</TableCell>
                          <TableCell className="py-1.5 text-right font-medium">{formatMoney(line.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

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
        <DialogContent className="sm:max-w-[98vw] xl:max-w-[96vw] w-[98vw] max-h-[94vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  <span>Ethiopian Payroll & Income Tax Sheet</span>
                  {companyLicenses.length > 1 && (
                    <Badge variant="secondary" className="text-[10px]">{activeLicense?.license_name}</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                    Proclamation No. 979/2016 Compliant
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Exact Ethiopian payroll calculations (Pension 7%/11%, progressive tax brackets, worked days prorating). On clicking Done, total payroll is deducted from Company Bank Balance.
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
                  Download Payroll Sheet CSV
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
            {/* Full View Editable Employee Table Matching Excel Sheet */}
            <div className="border border-border rounded-lg overflow-x-auto shadow-2xs">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow className="text-[11px] bg-muted/40 font-semibold">
                    <TableHead className="w-40 min-w-[150px]">Employee Name</TableHead>
                    <TableHead className="w-24 min-w-[90px]">Basic Salary</TableHead>
                    <TableHead className="w-16 min-w-[65px]">Days</TableHead>
                    <TableHead className="w-24 min-w-[90px] text-muted-foreground">Basic Earned</TableHead>
                    <TableHead className="w-20 min-w-[75px]">Overtime</TableHead>
                    <TableHead className="w-24 min-w-[85px]">Taxable Allow.</TableHead>
                    <TableHead className="w-24 min-w-[85px]">Transport</TableHead>
                    <TableHead className="w-24 min-w-[90px] text-muted-foreground">Pension 11%</TableHead>
                    <TableHead className="w-24 min-w-[95px] font-medium text-foreground">Gross Earning</TableHead>
                    <TableHead className="w-24 min-w-[95px] font-medium text-foreground">Taxable Earning</TableHead>
                    <TableHead className="w-24 min-w-[95px] text-red-600 dark:text-red-400 font-semibold">Income Tax</TableHead>
                    <TableHead className="w-24 min-w-[90px] text-amber-600 dark:text-amber-400">Pension 7%</TableHead>
                    <TableHead className="w-24 min-w-[95px] text-red-700 dark:text-red-300">Total Deductions</TableHead>
                    <TableHead className="w-28 min-w-[110px] font-bold text-primary">Net Pay</TableHead>
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
                          type="number"
                          value={emp.basic}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'basic', Number(e.target.value))}
                          className="h-8 text-xs font-semibold"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={emp.workDays}
                          onChange={(e) => handleUpdateEmployee(emp.id, 'workDays', Number(e.target.value))}
                          className="h-8 text-xs text-center"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {emp.earnedBasic.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={emp.overtime || ''}
                          placeholder="0"
                          onChange={(e) => handleUpdateEmployee(emp.id, 'overtime', Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={emp.taxableAllowance || ''}
                          placeholder="0"
                          onChange={(e) => handleUpdateEmployee(emp.id, 'taxableAllowance', Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={emp.transport || ''}
                          placeholder="0"
                          onChange={(e) => handleUpdateEmployee(emp.id, 'transport', Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        +{emp.pensionOrg.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono font-medium text-foreground">
                        {emp.gross.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-foreground font-semibold">
                        {emp.taxableIncome.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-red-600 dark:text-red-400 font-semibold">
                        -{emp.tax.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-amber-600 dark:text-amber-400">
                        -{emp.pensionEmp.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-red-700 dark:text-red-300 font-medium">
                        -{emp.totalDeductions.toLocaleString()}
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-muted/40 rounded-xl border border-border text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Basic Salary:</span>
                <span className="text-sm font-bold">{payrollTotals.basic.toLocaleString()} ETB</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Gross Earnings:</span>
                <span className="text-sm font-bold">{payrollTotals.gross.toLocaleString()} ETB</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Income Tax:</span>
                <span className="text-sm font-bold text-red-600">-{payrollTotals.tax.toLocaleString()} ETB</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Pensions (7% + 11%):</span>
                <span className="text-sm font-bold text-amber-600">
                  {(payrollTotals.pensionEmp + payrollTotals.pensionOrg).toLocaleString()} ETB
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Net Pay:</span>
                <span className="text-sm font-bold text-primary">{payrollTotals.net.toLocaleString()} ETB</span>
              </div>

              <div className="col-span-full pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  ðŸ¦ Bank Balance Impact: <strong>{totalPayrollDeduction.toLocaleString()} ETB</strong> (Net Salaries + Taxes + Pensions) will be deducted from your Company Bank Balance upon confirmation.
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
                Adjust Stock â€” {selectedStockProduct.name}
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
                const token = getAuthToken();
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

            const token = getAuthToken();
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
            handleAuthError(err, 'Failed to submit report');
          }
        }}
      />

      {/* PAYROLL LICENSE SELECTOR MODAL */}
      {payrollLicenseSelector && (
        <Dialog open={payrollLicenseSelector} onOpenChange={setPayrollLicenseSelector}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Select Company License for Payroll</DialogTitle>
              <DialogDescription className="text-xs">
                Choose which license's employee roster to calculate and process payroll for.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {companyLicenses.map((lic) => {
                const empCount = getEmployeesForLicense(lic.id).length;
                return (
                  <button
                    key={lic.id}
                    onClick={() => {
                      handleSelectLicense(lic.id);
                      setPayrollTargetLicenseId(lic.id);
                      setPayrollLicenseSelector(false);
                      setIsPayrollModalOpen(true);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-xs text-left transition-colors hover:border-primary/60 hover:bg-muted/30 ${
                      activeLicenseId === lic.id ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      <div>
                        <div className="font-medium">{lic.license_name}</div>
                        {lic.license_number && (
                          <div className="font-mono text-muted-foreground text-[10px]">#{lic.license_number}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {empCount} staff
                    </span>
                  </button>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setPayrollLicenseSelector(false)} className="text-xs h-8">
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}



