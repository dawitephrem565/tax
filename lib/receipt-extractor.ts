import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

export type ReceiptCalendar = 'gregorian' | 'ethiopian' | 'unknown';
export type VatTreatment = 'standard' | 'zero_rated' | 'exempt' | 'tot' | 'unknown';
export type SupplyType = 'goods' | 'services' | 'mixed' | 'unknown';

export interface ReceiptLine {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
  vat_amount: number | null;
}

export interface ReceiptExtractionResult {
  classification: 'purchase' | 'sale';
  receipt_date: string | null;
  calendar: ReceiptCalendar;
  fs_number: string | null;
  machine_number: string | null;
  partner_name: string | null;
  partner_tin: string | null;
  buyer_tin: string | null;
  seller_tin: string | null;
  untaxed_amount: number | null;
  vat_amount: number | null;
  total_amount: number | null;
  vat_treatment: VatTreatment;
  supply_type: SupplyType;
  wht_rate: 0 | 2 | 3;
  wht_suggested_rate: number | null;
  vat_inferred: boolean;
  lines: ReceiptLine[];
  confidence_notes: string[];
}

export interface ExtractionInput {
  companyDocument?: {
    buffer: Buffer;
    mimeType: string;
    filename: string;
  };
  posReceipt?: {
    buffer: Buffer;
    mimeType: string;
    filename: string;
  };
  companyTin?: string;
  companyName?: string;
}

// ---------------------------------------------------------------------------
// Primitive parsing helpers
// ---------------------------------------------------------------------------

/** Parses "1,234.56", "1.234,56", "1 234,56", "1234.5 ETB" into a number. */
export function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  let cleaned = raw.replace(/[^0-9.,\-]/g, '');
  if (!cleaned) return null;

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  if (lastDot > -1 && lastComma > -1) {
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length === 3) cleaned = parts.join('');
    else cleaned = cleaned.replace(/,/g, '.');
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

const amountish = z.preprocess((v) => parseAmount(v), z.number().nullable());
const textish = z.preprocess(
  (v) => (typeof v === 'string' ? (v.trim() || null) : v ?? null),
  z.string().nullable()
);

function normalizeClassification(value: unknown): 'purchase' | 'sale' {
  const s = String(value ?? '').toLowerCase();
  if (s.includes('sale') || s.includes('customer')) return 'sale';
  return 'purchase';
}

function normalizeSupplyType(value: unknown): SupplyType {
  const s = String(value ?? '').toLowerCase();
  if (s.includes('mixed') || s.includes('both')) return 'mixed';
  if (s.includes('service') || s.includes('consult') || s.includes('labour') || s.includes('labor')) return 'services';
  if (s.includes('good') || s.includes('merch') || s.includes('product') || s.includes('item')) return 'goods';
  return 'unknown';
}

function normalizeVatTreatment(value: unknown): VatTreatment {
  const s = String(value ?? '').toLowerCase();
  if (s.includes('zero')) return 'zero_rated';
  if (s.includes('exempt')) return 'exempt';
  if (s.includes('tot') || s.includes('turnover')) return 'tot';
  if (s.includes('standard') || s.includes('15')) return 'standard';
  return 'unknown';
}

function normalizeCalendar(value: unknown): ReceiptCalendar {
  const s = String(value ?? '').toLowerCase();
  if (s.includes('ethiop') || s.includes('ec')) return 'ethiopian';
  if (s.includes('greg') || s.includes('gc')) return 'gregorian';
  return 'unknown';
}

export const ReceiptLineSchema = z.object({
  description: z.preprocess((v) => String(v ?? '').trim(), z.string()).catch(''),
  quantity: amountish.optional().default(null),
  unit_price: amountish.optional().default(null),
  amount: amountish.optional().default(null),
  vat_amount: amountish.optional().default(null),
});

const ReceiptExtractionModelSchema = z.object({
  classification: z.preprocess(normalizeClassification, z.enum(['purchase', 'sale'])),
  receipt_date: textish.optional().default(null),
  calendar: z.preprocess((v) => normalizeCalendar(v), z.enum(['gregorian', 'ethiopian', 'unknown'])).catch('unknown'),
  fs_number: textish.optional().default(null),
  machine_number: textish.optional().default(null),
  partner_name: textish.optional().default(null),
  partner_tin: textish.optional().default(null),
  buyer_tin: textish.optional().default(null),
  seller_tin: textish.optional().default(null),
  untaxed_amount: amountish.optional().default(null),
  vat_amount: amountish.optional().default(null),
  total_amount: amountish.optional().default(null),
  vat_treatment: z.preprocess((v) => normalizeVatTreatment(v), z.enum(['standard', 'zero_rated', 'exempt', 'tot', 'unknown'])).catch('unknown'),
  supply_type: z.preprocess((v) => normalizeSupplyType(v), z.enum(['goods', 'services', 'mixed', 'unknown'])).catch('unknown'),
  wht_rate: z.preprocess(
    (v) => {
      const n = parseAmount(v);
      return n === 2 || n === 3 ? n : 0;
    },
    z.union([z.literal(0), z.literal(2), z.literal(3)])
  ),
  wht_suggested_rate: amountish.optional().default(null),
  lines: z.array(ReceiptLineSchema).optional().default([]),
  confidence_notes: z.array(z.string()).optional().default([]),
});

export type ReceiptExtractionModelResult = z.infer<typeof ReceiptExtractionModelSchema>;

// ---------------------------------------------------------------------------
// Ethiopian calendar support
// ---------------------------------------------------------------------------

function ethiopianToJdn(year: number, month: number, day: number): number | null {
  if (month < 1 || month > 13 || day < 1 || day > 30) return null;
  if (month === 13 && day > 6) return null;
  return 1724221 + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + (day - 1);
}

function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

export function ethiopianToGregorian(
  year: number,
  month: number,
  day: number
): { year: number; month: number; day: number } | null {
  const jdn = ethiopianToJdn(year, month, day);
  return jdn === null ? null : jdnToGregorian(jdn);
}

function toIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface NormalizedReceiptDate {
  date: string | null;
  calendar: ReceiptCalendar;
  convertedFromEc: boolean;
}

/**
 * Normalizes a printed receipt date to YYYY-MM-DD.
 *
 * Ethiopian fiscal documents often print the Ethiopian calendar date
 * (e.g. 12/03/2018 E.C.). Treating that as a Gregorian year puts receipts
 * seven to eight years out of the filing period, so EC years are converted.
 */
export function resolveReceiptDate(
  rawDate?: string | null,
  calendarHint: ReceiptCalendar = 'unknown'
): NormalizedReceiptDate {
  if (!rawDate) return { date: null, calendar: calendarHint, convertedFromEc: false };

  const raw = String(rawDate);
  const cleaned = raw.trim().replace(/[^\d./\-]/g, '');
  const parts = cleaned.split(/[./\-]/).map((p) => parseInt(p, 10)).filter((n) => Number.isFinite(n));

  if (parts.length !== 3) return { date: null, calendar: calendarHint, convertedFromEc: false };

  let year: number;
  let month: number;
  let day: number;

  if (parts[0] > 31) {
    // YYYY-MM-DD / YYYY/MM/DD
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else {
    // Ethiopian documents write DD/MM/YYYY by convention.
    let a = parts[0];
    let b = parts[1];
    year = parts[2];
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }
  }

  if (year < 100) year += 2000;

  const explicitEc = /ዓ\.?\s*ም|እ\.?\s*ቀ|E\.?\s*C\.?/i.test(raw);
  const currentYear = new Date().getFullYear();
  const looksEc = month === 13 || year < 1900 || year < currentYear - 5;
  const treatAsEc = explicitEc || calendarHint === 'ethiopian' || (calendarHint !== 'gregorian' && looksEc);

  // Guard against double conversion: an already-converted Gregorian date is
  // never more than a year behind the current year.
  if (treatAsEc && year < currentYear - 5) {
    const converted = ethiopianToGregorian(year, month, day);
    if (converted) {
      const iso = toIso(converted.year, converted.month, converted.day);
      if (iso) return { date: iso, calendar: 'ethiopian', convertedFromEc: true };
    }
  }

  const iso = toIso(year, month, day);
  return {
    date: iso,
    calendar: treatAsEc ? 'ethiopian' : calendarHint === 'unknown' ? 'gregorian' : calendarHint,
    convertedFromEc: false,
  };
}

/** Backwards-compatible helper: returns only the ISO date. */
export function normalizeDate(rawDate?: string | null): string | null {
  return resolveReceiptDate(rawDate).date;
}

// ---------------------------------------------------------------------------
// Tesseract (local audit text / heuristic fallback)
// ---------------------------------------------------------------------------

function isPdfFile(mimeType?: string, filename?: string): boolean {
  return (
    (mimeType || '').toLowerCase().includes('pdf') ||
    (filename || '').toLowerCase().endsWith('.pdf')
  );
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.webp'];

export async function runTesseract(buffer: Buffer, originalFilename?: string, mimeType?: string): Promise<string> {
  // Tesseract cannot read PDFs; Gemini handles PDF pages natively.
  if (isPdfFile(mimeType, originalFilename)) return '';

  const ext = originalFilename ? path.extname(originalFilename) : '.png';
  const safeExt = IMAGE_EXTENSIONS.includes(ext.toLowerCase()) ? ext.toLowerCase() : '.png';

  const tesseractPaths = [
    process.env.TESSERACT_PATH,
    'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
    'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
    'tesseract',
  ].filter(Boolean) as string[];

  let tesseractBin = 'tesseract';
  for (const candidate of tesseractPaths) {
    if (candidate === 'tesseract' || fs.existsSync(candidate)) {
      tesseractBin = candidate;
      break;
    }
  }

  const tmpFile = path.join(
    os.tmpdir(),
    `receipt_ocr_${Date.now()}_${Math.random().toString(36).slice(2)}${safeExt}`
  );

  try {
    await fs.promises.writeFile(tmpFile, buffer);

    const language = process.env.TESSERACT_LANG || 'eng';
    const attempts = [
      { lang: language, psm: '3' },
      { lang: 'eng', psm: '3' },
      { lang: 'eng', psm: '6' },
    ];

    for (const attempt of attempts) {
      try {
        const { stdout } = await execFileAsync(
          tesseractBin,
          [tmpFile, 'stdout', '-l', attempt.lang, '--psm', attempt.psm],
          { timeout: 15000 }
        );
        if (stdout && stdout.trim().length > 0) return stdout.trim();
      } catch {
        // try the next configuration
      }
    }
    return '';
  } catch (err) {
    console.error('Tesseract execution failed:', err);
    return '';
  } finally {
    try {
      if (fs.existsSync(tmpFile)) await fs.promises.unlink(tmpFile);
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Heuristic fallback (used only when the vision model is unavailable)
// ---------------------------------------------------------------------------

export function parseTesseractTextFallback(
  text: string,
  userCompanyTin?: string,
  userCompanyName?: string
): ReceiptExtractionResult {
  const cleanTin = (val: string) => val.replace(/\D/g, '');
  const normUserTin = cleanTin(userCompanyTin || '');
  const normUserCompany = (userCompanyName || '').toLowerCase().trim();

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let fs_number: string | null = null;
  let machine_number: string | null = null;
  let partner_name: string | null = null;
  let receipt_date: string | null = null;
  let calendar: ReceiptCalendar = 'unknown';
  let untaxed_amount: number | null = null;
  let vat_amount: number | null = null;
  let total_amount: number | null = null;
  let partner_tin: string | null = null;
  const notes: string[] = ['Extracted with the local Tesseract fallback — verify every field against the document.'];

  const fsRegex = /(?:FS|F\.S\.?|Fiscal\s*(?:Receipt|Serial|No|Number)?)\s*[:#\-.]?\s*([A-Za-z0-9][A-Za-z0-9\-/]{3,})/i;
  const machineRegex = /(?:Machine|Device|Terminal|POS|Register)\s*(?:No|Number|#|ID)?\s*[:#\-.]?\s*([A-Za-z0-9][A-Za-z0-9\-/]{3,})/i;
  const tinRegex = /(?:TIN|T\.I\.N|VAT\s*Reg)\s*[:#\-.]?\s*((?:\d[\s\-]?){9,12})/i;
  const amountRegex = /(?<![\d/])(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d%])/g;
  const ethiopicName = /^[\u1200-\u137F A-Za-z][\u1200-\u137F A-Za-z\s.&,'()\-]{2,}$/u;

  const tins: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!fs_number && /\bFS\b|Fiscal/i.test(line)) {
      const match = line.match(fsRegex);
      if (match && match[1]) {
        const candidate = match[1].replace(/^[.:#\-]+|[.:#\-]+$/g, '');
        if (!/date/i.test(candidate)) fs_number = candidate;
      }
    }

    if (!machine_number && /(machine|terminal|erca[-_ ]?pos|device\s*no)/i.test(line)) {
      const match = line.match(machineRegex);
      if (match && match[1]) {
        const candidate = match[1].replace(/^[.:#\-]+|[.:#\-]+$/g, '');
        if (!/customer|invoice|payment|cashier/i.test(candidate)) machine_number = candidate;
      }
    }

    const tinMatch = line.match(tinRegex);
    if (tinMatch && tinMatch[1]) {
      const candidateTin = cleanTin(tinMatch[1]);
      if (candidateTin.length >= 9 && candidateTin.length <= 12 && !tins.includes(candidateTin)) {
        tins.push(candidateTin);
      }
    }

    if (!partner_name && i < 8) {
      const isSystemWord = /(invoice|receipt|cash|vat|tin|date|total|subtotal|machine|fs\s*no|proforma)/i.test(line);
      const hasLetters = /[A-Za-z\u1200-\u137F]{3,}/u.test(line);
      if (hasLetters && !isSystemWord && cleanTin(line).length < 8 && ethiopicName.test(line)) {
        if (!normUserCompany || !line.toLowerCase().includes(normUserCompany)) {
          partner_name = line;
        }
      }
    }

    const hasAmount = (label: RegExp) => {
      if (!label.test(line)) return null;
      const matches = [...line.matchAll(amountRegex)];
      if (matches.length === 0) return null;
      const last = matches[matches.length - 1][0].replace(/,/g, '').replace(/\s/g, '');
      const parsed = parseFloat(last);
      return Number.isFinite(parsed) ? parsed : null;
    };

    if (untaxed_amount === null && /(sub\s*total|taxable\s*(?:amount)?|net\s*amount|amount\s*before)/i.test(line) && !/\bvat\b/i.test(line)) {
      untaxed_amount = hasAmount(/$/);
    }

    // "Total VAT" must be treated as VAT, never as the grand total.
    if (vat_amount === null && /\bvat\b|value\s*added/i.test(line) && !/reg/i.test(line)) {
      vat_amount = hasAmount(/$/);
    }

    if (total_amount === null && /\b(grand\s*total|total)\b/i.test(line)) {
      if (!/sub\s*total|vat|wht|withhold|tax|amount\s*before/i.test(line)) {
        total_amount = hasAmount(/$/);
      }
    }

    if (!receipt_date) {
      const dateMatch = line.match(/\b(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})\b/) || line.match(/\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})\b/);
      if (dateMatch) {
        const hint: ReceiptCalendar = /ዓ\.?\s*ም|E\.?\s*C\.?/i.test(line) ? 'ethiopian' : 'unknown';
        const resolved = resolveReceiptDate(dateMatch[0], hint);
        if (resolved.date) {
          receipt_date = resolved.date;
          calendar = resolved.calendar;
        }
      }
    }
  }

  // Reconcile TINs: first is normally the issuer, second the buyer.
  const issuerTin = tins[0] ?? null;
  const buyerTin = tins[1] ?? null;
  const classification: 'purchase' | 'sale' =
    normUserTin && issuerTin === normUserTin ? 'sale' : 'purchase';
  partner_tin =
    classification === 'sale'
      ? buyerTin
      : issuerTin && issuerTin !== normUserTin
        ? issuerTin
        : buyerTin && buyerTin !== normUserTin
          ? buyerTin
          : null;

  // Only infer VAT when the document looks standard-rated; never invent tax
  // on zero-rated, exempt, or TOT documents.
  let vat_inferred = false;
  if (vat_amount === null && untaxed_amount !== null && vat_amount === null) {
    vat_amount = Math.round(untaxed_amount * 0.15 * 100) / 100;
    vat_inferred = true;
    notes.push('VAT was not printed on the document; 15% was inferred. Confirm the VAT treatment before filing.');
  }
  if (total_amount === null && untaxed_amount !== null) {
    total_amount = Math.round((untaxed_amount + (vat_amount ?? 0)) * 100) / 100;
  }
  if (untaxed_amount === null && total_amount !== null) {
    const base = vat_amount !== null ? total_amount - vat_amount : Math.round((total_amount * 100) / 115 * 100) / 100;
    untaxed_amount = Math.round(base * 100) / 100;
    if (vat_amount === null) {
      vat_amount = Math.round((total_amount - untaxed_amount) * 100) / 100;
      vat_inferred = true;
    }
  }

  if (untaxed_amount !== null && total_amount !== null) {
    const expected = Math.round((untaxed_amount + (vat_amount ?? 0)) * 100) / 100;
    if (Math.abs(expected - total_amount) > 0.1) {
      notes.push(
        `Amount mismatch: subtotal + VAT = ${expected.toFixed(2)} ETB but the document total is ${total_amount.toFixed(2)} ETB.`
      );
    }
  }

  return {
    classification,
    receipt_date,
    calendar,
    fs_number,
    machine_number,
    partner_name,
    partner_tin,
    buyer_tin: classification === 'purchase' ? normUserTin || null : buyerTin,
    seller_tin: classification === 'sale' ? normUserTin || null : issuerTin,
    untaxed_amount,
    vat_amount,
    total_amount,
    vat_treatment: vat_inferred ? 'unknown' : vat_amount && vat_amount > 0 ? 'standard' : 'unknown',
    supply_type: 'unknown',
    wht_rate: 0,
    wht_suggested_rate: null,
    vat_inferred,
    lines: [],
    confidence_notes: notes,
  };
}

// ---------------------------------------------------------------------------
// Vision extraction (primary engine)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = (companyName: string, companyTin: string) => `
You are a senior Ethiopian tax auditor reading fiscal documents issued under Ministry of Revenues (MOR / ERCA) rules.
Our own company is "${companyName}"${companyTin ? ` with TIN "${companyTin}"` : ''}.

Read every attachment (invoice photo, PDF, or POS cash register slip) and return the fields below.

RULES
1. classification: "sale" when our company is the issuer/seller; "purchase" when our company is the buyer.
2. Dates: return the date exactly as printed in YYYY-MM-DD. If the document uses the Ethiopian calendar (ዓ.ም / E.C.), keep the Ethiopian year and set "calendar": "ethiopian" — do not convert it yourself. If it prints both calendars, use the Gregorian date and set "calendar": "gregorian".
3. Names: preserve the vendor/customer name exactly as printed. If the document is bilingual, prefer the Latin-script legal name; if only Amharic is printed, return the Amharic name unchanged.
4. TINs: Ethiopian TINs have 10 digits. Return buyer_tin and seller_tin separately when visible. partner_tin is the external party's TIN. Never return our own TIN as partner_tin.
5. FS number: fiscal serial from the POS slip (e.g. "FS 0012345"), otherwise the invoice number. machine_number: the ERCA POS machine ID (e.g. AEB..., MRC..., MC..., POS...). Return null rather than guessing.
6. Amounts are numbers in ETB: untaxed_amount (before tax), vat_amount (printed VAT), total_amount (grand total including tax). Do not apply 15% yourself when the document states otherwise.
7. vat_treatment: "standard" (15% VAT charged), "zero_rated", "exempt", "tot" (2% turnover tax, no VAT), or "unknown".
8. supply_type: "goods", "services", "mixed", or "unknown".
9. Withholding tax in Ethiopia is 2% on goods and 3% on services paid to a TIN-registered business. Return wht_rate 2 or 3 only when the document or its supply type supports it; otherwise 0. Never derive WHT from an amount threshold.
10. lines: every line item you can read (description, quantity, unit_price, amount, vat_amount). For PDFs, include items from all pages.
11. confidence_notes: flag anything illegible, inconsistent, or inferred (for example subtotal + VAT ≠ total, or a date/calendar that was ambiguous).

Return ONLY valid JSON:
{
  "classification": "purchase" | "sale",
  "receipt_date": string | null,
  "calendar": "gregorian" | "ethiopian" | "unknown",
  "fs_number": string | null,
  "machine_number": string | null,
  "partner_name": string | null,
  "partner_tin": string | null,
  "buyer_tin": string | null,
  "seller_tin": string | null,
  "untaxed_amount": number | null,
  "vat_amount": number | null,
  "total_amount": number | null,
  "vat_treatment": "standard" | "zero_rated" | "exempt" | "tot" | "unknown",
  "supply_type": "goods" | "services" | "mixed" | "unknown",
  "wht_rate": 0 | 2 | 3,
  "wht_suggested_rate": number | null,
  "lines": [{ "description": string, "quantity": number | null, "unit_price": number | null, "amount": number | null, "vat_amount": number | null }],
  "confidence_notes": string[]
}
`.trim();

function parseJsonLoose(text: string): any {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  const candidate = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  return JSON.parse(candidate);
}

function finalizeExtraction(
  raw: ReceiptExtractionModelResult,
  companyTin: string,
  engineNote: string
): ReceiptExtractionResult {
  const resolved = resolveReceiptDate(raw.receipt_date, raw.calendar);
  const notes = [...(raw.confidence_notes || [])];
  if (engineNote) notes.push(engineNote);
  if (raw.receipt_date && !resolved.date) {
    notes.push(`Unreadable date "${raw.receipt_date}" — enter it manually.`);
  }
  if (resolved.convertedFromEc) {
    notes.push(`Ethiopian calendar date converted to Gregorian (${resolved.date}).`);
  }

  let { untaxed_amount, vat_amount, total_amount } = raw;
  let vat_treatment = raw.vat_treatment;
  let vat_inferred = false;

  if (vat_treatment === 'unknown' && vat_amount !== null && vat_amount > 0) {
    vat_treatment = 'standard';
  }

  if (vat_amount === null && untaxed_amount !== null && vat_treatment === 'standard') {
    vat_amount = Math.round(untaxed_amount * 0.15 * 100) / 100;
    vat_inferred = true;
    notes.push('VAT was not printed but the document is standard-rated; 15% was inferred.');
  }

  if (total_amount === null && untaxed_amount !== null) {
    total_amount = Math.round((untaxed_amount + (vat_amount ?? 0)) * 100) / 100;
  }
  if (untaxed_amount === null && total_amount !== null) {
    untaxed_amount =
      vat_amount !== null
        ? Math.round((total_amount - vat_amount) * 100) / 100
        : Math.round(((total_amount * 100) / 115) * 100) / 100;
    if (vat_amount === null && vat_treatment === 'standard') {
      vat_amount = Math.round((total_amount - untaxed_amount) * 100) / 100;
      vat_inferred = true;
    }
  }

  if (untaxed_amount !== null && total_amount !== null) {
    const expected = Math.round((untaxed_amount + (vat_amount ?? 0)) * 100) / 100;
    if (Math.abs(expected - total_amount) > 0.1) {
      notes.push(
        `Amount mismatch: subtotal + VAT = ${expected.toFixed(2)} ETB but the document total is ${total_amount.toFixed(2)} ETB.`
      );
    }
  }

  const normCompanyTin = (companyTin || '').replace(/\D/g, '');
  let classification = raw.classification;
  const seller = (raw.seller_tin || '').replace(/\D/g, '');
  if (normCompanyTin && seller && seller === normCompanyTin) {
    classification = 'sale';
  } else if (normCompanyTin && raw.buyer_tin && raw.buyer_tin.replace(/\D/g, '') === normCompanyTin) {
    classification = 'purchase';
  }

  const partnerTin =
    classification === 'sale'
      ? raw.buyer_tin || raw.partner_tin
      : raw.seller_tin || raw.partner_tin;
  if (partnerTin && normCompanyTin && partnerTin.replace(/\D/g, '') === normCompanyTin) {
    notes.push('The partner TIN matched our own TIN and was discarded.');
  }

  let whtSuggested = raw.wht_suggested_rate ?? null;
  if (whtSuggested === null && raw.wht_rate === 0 && raw.supply_type === 'goods') whtSuggested = 2;
  if (whtSuggested === null && raw.wht_rate === 0 && raw.supply_type === 'services') whtSuggested = 3;

  return {
    classification,
    receipt_date: resolved.date,
    calendar: resolved.calendar,
    fs_number: raw.fs_number,
    machine_number: raw.machine_number,
    partner_name: raw.partner_name,
    partner_tin:
      partnerTin && normCompanyTin && partnerTin.replace(/\D/g, '') === normCompanyTin ? null : partnerTin,
    buyer_tin: raw.buyer_tin,
    seller_tin: raw.seller_tin,
    untaxed_amount,
    vat_amount,
    total_amount,
    vat_treatment,
    supply_type: raw.supply_type,
    wht_rate: raw.wht_rate,
    wht_suggested_rate: whtSuggested,
    vat_inferred,
    lines: (raw.lines || []).filter((line) => line.description?.trim()),
    confidence_notes: notes,
  };
}

export async function extractReceiptWithVisionLLM(
  input: ExtractionInput
): Promise<{ result: ReceiptExtractionResult; rawText: string; engine: 'vision-llm' | 'tesseract-fallback' }> {
  const companyDoc = input.companyDocument;
  const posSlip = input.posReceipt;
  const ourCompanyTin = (input.companyTin || '').trim();
  const ourCompanyName = (input.companyName || '').trim();

  if (!ourCompanyTin && !ourCompanyName) {
    throw new Error('Company identity (name or TIN) is required to classify a receipt.');
  }

  // Local audit text. PDFs are skipped: Tesseract cannot read them.
  const tesseractPromises: Promise<string>[] = [];
  if (companyDoc) tesseractPromises.push(runTesseract(companyDoc.buffer, companyDoc.filename, companyDoc.mimeType));
  if (posSlip) tesseractPromises.push(runTesseract(posSlip.buffer, posSlip.filename, posSlip.mimeType));

  const tesseractTexts = await Promise.all(tesseractPromises);
  const rawAuditText = tesseractTexts.filter(Boolean).join('\n\n--- NEXT IMAGE ---\n\n').trim();

  const geminiApiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (geminiApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey, apiVersion: 'v1beta' });
      const parts: any[] = [{ text: SYSTEM_PROMPT(ourCompanyName, ourCompanyTin) }];

      for (const doc of [companyDoc, posSlip]) {
        if (!doc) continue;
        parts.push({
          inlineData: {
            mimeType: doc.mimeType || 'image/jpeg',
            data: doc.buffer.toString('base64'),
          },
        });
      }

      const configured = (process.env.GEMINI_MODEL || '')
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
      const modelsToTry = configured.length
        ? configured
        : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

      let rawJsonText = '';
      let lastError: unknown = null;

      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts }],
            config: { responseMimeType: 'application/json' },
          });
          if (response?.text) {
            rawJsonText = response.text;
            break;
          }
        } catch (err) {
          lastError = err;
          console.warn(`Vision model ${model} failed:`, err);
        }
      }

      if (rawJsonText) {
        const parsedJson = parseJsonLoose(rawJsonText);
        const parsed = ReceiptExtractionModelSchema.parse(parsedJson);
        return {
          result: finalizeExtraction(parsed, ourCompanyTin, ''),
          rawText: rawAuditText || rawJsonText,
          engine: 'vision-llm',
        };
      }
      console.error('All Gemini models failed:', lastError);
    } catch (visionErr) {
      console.error('Gemini Vision extraction failed:', visionErr);
    }
  }

  if (openaiApiKey) {
    try {
      const content: any[] = [{ type: 'text', text: SYSTEM_PROMPT(ourCompanyName, ourCompanyTin) }];
      for (const doc of [companyDoc, posSlip]) {
        if (!doc) continue;
        // Chat Completions vision accepts images only; skip PDFs here.
        if (isPdfFile(doc.mimeType, doc.filename)) continue;
        content.push({
          type: 'image_url',
          image_url: { url: `data:${doc.mimeType || 'image/jpeg'};base64,${doc.buffer.toString('base64')}` },
        });
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'user', content }],
          response_format: { type: 'json_object' },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const contentStr = data.choices?.[0]?.message?.content;
        if (contentStr) {
          const parsed = ReceiptExtractionModelSchema.parse(parseJsonLoose(contentStr));
          return {
            result: finalizeExtraction(parsed, ourCompanyTin, 'Extracted with OpenAI vision fallback.'),
            rawText: rawAuditText || contentStr,
            engine: 'vision-llm',
          };
        }
      }
    } catch (openAiErr) {
      console.error('OpenAI Vision extraction failed:', openAiErr);
    }
  }

  const fallback = parseTesseractTextFallback(rawAuditText, ourCompanyTin, ourCompanyName);
  if (!rawAuditText) {
    fallback.confidence_notes.push(
      'No vision model is configured and the local OCR binary returned no text. Fill the fields manually or set GEMINI_API_KEY.'
    );
  }
  return {
    result: fallback,
    rawText: rawAuditText || 'No plain text could be extracted from the uploaded document.',
    engine: 'tesseract-fallback',
  };
}
