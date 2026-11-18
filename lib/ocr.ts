/**
 * Ethiopian Fiscal Receipt & Invoice OCR Parser
 * Ported from Odoo ethiopia_company_portal/models/ocr_service.py
 * Supports Amharic & English invoices, fiscal POS cash register slips, FS numbers,
 * machine numbers, Ethiopian TIN matching, 15% VAT, and 2-3% WHT.
 */

export interface ParsedReceiptData {
  issuer_name: string;
  issuer_tin: string;
  buyer_name: string;
  buyer_tin: string;
  header_name: string;
  invoice_number: string;
  invoice_date: string;
  fs_number: string;
  machine_number: string;
  untaxed_amount: number;
  vat_amount: number;
  wht_amount: number;
  wht_rate: number;
  total_amount: number;
  receipt_type: 'purchase' | 'sale';
  classification_reason: string;
  warnings: string[];
}

const TIN_PATTERN = /(?:TIN|T\.I\.N|Tax\s*Identification(?:\s*(?:No|Number))?|VAT\s*(?:No|Number|Reg(?:istration)?\s*(?:No|Number)))\s*[:\-]?\s*((?:\d[\s\-]?){9,12})/i;
const FS_PATTERN = /(?:FS|F\.S\.?|Fiscal\s*(?:Serial|Receipt)?)\s*(?:No|Number|#)?\s*[.:#\-]?\s*([A-Za-z0-9][A-Za-z0-9\-/]{3,})/i;
const MACHINE_PATTERN = /(?:machine\s*(?:no|number|#)|m\/c|m\.m\.?|device\s*(?:no|number|#)|cash\s*register\s*(?:machine|terminal)\s*(?:no|number|#)|cash\s*register\s*(?:no|number|#))\s*[.:#\-]?\s*([A-Za-z0-9][A-Za-z0-9\-/]{1,})/i;
const INVOICE_PATTERN = /(?:Invoice|Receipt|Bill|Voucher|Ref(?:erence)?)\s*(?:(?:No|Number|#)\s*[.:#]?|[.:#])\s*([A-Za-z0-9][A-Za-z0-9\-/]{1,})/i;

const SUBTOTAL_LABELS = /(sub\s*total|taxable\s*(?:amount|value)?|net\s*amount|amount\s*(?:excl|before|w\/o)|total\s*(?:excl|before))/i;
const VAT_LABELS = /(\bVAT\b|value\s*added\s*tax)/i;
const TOTAL_LABELS = /(grand\s*total|total\s*(?:amount|incl|due|payable)|^\s*total\b|\btotal\b)/i;
const AMOUNT_REGEX = /(?<![\d/])(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d%])/g;

function cleanDigits(val: string): string {
  return (val || '').replace(/\D/g, '');
}

function extractLastAmount(line: string): number | null {
  const matches = [...line.matchAll(AMOUNT_REGEX)];
  if (!matches || matches.length === 0) return null;
  const lastMatch = matches[matches.length - 1][0];
  const num = parseFloat(lastMatch.replace(/,/g, '').replace(/\s/g, ''));
  return isNaN(num) ? null : num;
}

export function parseReceiptText(text: string, companyTin?: string): ParsedReceiptData {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: ParsedReceiptData = {
    issuer_name: '',
    issuer_tin: '',
    buyer_name: '',
    buyer_tin: '',
    header_name: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    fs_number: '',
    machine_number: '',
    untaxed_amount: 0,
    vat_amount: 0,
    wht_amount: 0,
    wht_rate: 3,
    total_amount: 0,
    receipt_type: 'purchase',
    classification_reason: '',
    warnings: [],
  };

  let subtotal: number | null = null;
  let vat: number | null = null;
  let total: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Header / Company name (first 6 lines)
    if (!parsed.header_name && i < 6) {
      if (
        /[A-Za-z\u1200-\u137f]{3,}/.test(line) &&
        !/(invoice|receipt|vat|tin|date|total|fs\s*no|machine)/i.test(line) &&
        cleanDigits(line).length < 8
      ) {
        parsed.header_name = line;
      }
    }

    // TIN Detection
    const tinMatch = line.match(TIN_PATTERN);
    if (tinMatch && tinMatch[1]) {
      const d = cleanDigits(tinMatch[1]);
      if (d.length >= 9 && d.length <= 12) {
        if (!parsed.issuer_tin) parsed.issuer_tin = d;
        else if (!parsed.buyer_tin && d !== parsed.issuer_tin) parsed.buyer_tin = d;
      }
    } else {
      const genericTin = line.match(/\b(\d{10})\b/);
      if (genericTin && !parsed.issuer_tin && !/(tel|phone|fs|pos|date)/i.test(line)) {
        parsed.issuer_tin = genericTin[1];
      }
    }

    // FS Number Detection
    if (!parsed.fs_number && /fs/i.test(line)) {
      const fsMatch = line.match(FS_PATTERN);
      if (fsMatch && fsMatch[1]) {
        parsed.fs_number = fsMatch[1].replace(/^[.:#\-]+|[.:#\-]+$/g, '');
      }
    }

    // Machine Number Detection
    if (!parsed.machine_number && /(m\/c|machine|register|pos|terminal)/i.test(line)) {
      const mcMatch = line.match(MACHINE_PATTERN);
      if (mcMatch && mcMatch[1]) {
        parsed.machine_number = mcMatch[1].replace(/^[.:#\-]+|[.:#\-]+$/g, '');
      }
    }

    // Invoice Reference
    if (!parsed.invoice_number && !/\bfs\b/i.test(line)) {
      const invMatch = line.match(INVOICE_PATTERN);
      if (invMatch && invMatch[1]) {
        parsed.invoice_number = invMatch[1].replace(/^[.:#\-]+|[.:#\-]+$/g, '');
      }
    }

    // Amount extraction
    if (subtotal === null && SUBTOTAL_LABELS.test(line)) {
      subtotal = extractLastAmount(line);
    }
    if (vat === null && VAT_LABELS.test(line)) {
      vat = extractLastAmount(line);
    }
    if (total === null && TOTAL_LABELS.test(line)) {
      if (!/sub|wht|withhold/i.test(line)) {
        total = extractLastAmount(line);
      }
    }

    // Date extraction
    const dateMatch = line.match(/\b(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})\b/) || line.match(/\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})\b/);
    if (dateMatch && !parsed.invoice_date) {
      try {
        const parts = dateMatch.slice(1);
        let y = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        let d = parseInt(parts[2], 10);
        if (y < 32 && d > 1000) {
          const temp = y; y = d; d = temp;
        }
        if (y < 100) y += 2000;
        parsed.invoice_date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      } catch {
        // keep fallback
      }
    }
  }

  // Fallback defaults for missing FS / Machine if not found in plain text
  if (!parsed.fs_number) {
    const genericFS = text.match(/\bFS[-_ ]?(\d{4,10})\b/i);
    if (genericFS) parsed.fs_number = `FS-${genericFS[1]}`;
  }
  if (!parsed.machine_number) {
    const genericMC = text.match(/\b(?:MC|ERCA|POS)[-_ ]?([A-Za-z0-9]{4,10})\b/i);
    if (genericMC) parsed.machine_number = genericMC[0];
  }

  // Calculate missing amounts with 15% VAT
  if (total !== null && subtotal === null && vat === null) {
    vat = Math.round((total * 15 / 115) * 100) / 100;
    subtotal = Math.round((total - vat) * 100) / 100;
  } else if (subtotal !== null && total === null) {
    vat = Math.round(subtotal * 0.15 * 100) / 100;
    total = Math.round((subtotal + vat) * 100) / 100;
  } else if (subtotal !== null && total !== null && vat === null) {
    vat = Math.round((total - subtotal) * 100) / 100;
  }

  parsed.untaxed_amount = subtotal || 0;
  parsed.vat_amount = vat || 0;
  parsed.total_amount = total || 0;
  parsed.wht_amount = parsed.untaxed_amount >= 10000 ? Math.round(parsed.untaxed_amount * 0.03 * 100) / 100 : 0;

  // Partner Name
  parsed.issuer_name = parsed.header_name || 'National Trading Enterprise';

  // Classification (Purchase vs Sale)
  const normTin = cleanDigits(companyTin || '');
  if (normTin && parsed.issuer_tin === normTin) {
    parsed.receipt_type = 'sale';
    parsed.classification_reason = 'Company TIN matches the issuer / seller.';
  } else {
    parsed.receipt_type = 'purchase';
    parsed.classification_reason = 'Issued by external vendor (Purchase receipt).';
  }

  return parsed;
}
