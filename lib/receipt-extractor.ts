import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

// 1. Strict Zod Schema
export const ReceiptExtractionSchema = z.object({
  classification: z.enum(['Purchase (Vendor Receipt)', 'Sale (Customer Invoice)']),
  receipt_date: z.string().nullable(),
  fs_number: z.string().nullable(),
  machine_number: z.string().nullable(),
  partner_name: z.string().nullable(),
  partner_tin: z.string().nullable(),
  untaxed_amount: z.number().nullable(),
  vat_amount: z.number().nullable(),
  total_amount: z.number().nullable(),
  wht_rate: z.number().transform((v) => (v === 2 ? 2 : v === 3 ? 3 : 0) as 0 | 2 | 3),
  confidence_notes: z.array(z.string()),
});

export type ReceiptExtractionResult = z.infer<typeof ReceiptExtractionSchema>;

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

// Helper: Normalize date to YYYY-MM-DD
export function normalizeDate(rawDate?: string | null): string | null {
  if (!rawDate) return null;
  const cleaned = rawDate.trim().replace(/[^\d./\-]/g, '');
  if (!cleaned) return null;

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = cleaned.match(/^(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (dmyMatch) {
    let d = parseInt(dmyMatch[1], 10);
    let m = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000;
    // Swap if month and day inverted
    if (m > 12 && d <= 12) {
      const temp = m;
      m = d;
      d = temp;
    }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

// 2. Tesseract OCR Helper for audit text preview & fallback
export async function runTesseract(buffer: Buffer, originalFilename?: string): Promise<string> {
  const ext = originalFilename ? path.extname(originalFilename) : '.png';
  const safeExt = ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.webp'].includes(ext.toLowerCase())
    ? ext.toLowerCase()
    : '.png';

  const tesseractPaths = [
    'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
    'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
    'tesseract',
  ];

  let tesseractBin = '';
  for (const candidate of tesseractPaths) {
    if (fs.existsSync(candidate)) {
      tesseractBin = candidate;
      break;
    }
  }
  if (!tesseractBin) tesseractBin = 'tesseract';

  const tmpFile = path.join(os.tmpdir(), `receipt_ocr_${Date.now()}_${Math.random().toString(36).slice(2)}${safeExt}`);

  try {
    await fs.promises.writeFile(tmpFile, buffer);

    // Try Tesseract with auto page segmentation
    try {
      const { stdout } = await execFileAsync(tesseractBin, [tmpFile, 'stdout', '-l', 'eng', '--psm', '3'], {
        timeout: 20000,
      });
      if (stdout && stdout.trim().length > 0) return stdout.trim();
    } catch {
      try {
        const { stdout: stdout6 } = await execFileAsync(tesseractBin, [tmpFile, 'stdout', '-l', 'eng', '--psm', '6'], {
          timeout: 20000,
        });
        if (stdout6 && stdout6.trim().length > 0) return stdout6.trim();
      } catch (e2) {
        console.error('Tesseract psm 6 error:', e2);
      }
    }
    return '';
  } catch (err) {
    console.error('Failed to run Tesseract on temp file:', err);
    return '';
  } finally {
    try {
      if (fs.existsSync(tmpFile)) {
        await fs.promises.unlink(tmpFile);
      }
    } catch {}
  }
}

// 3. Fallback Heuristic Extractor from Tesseract text (ZERO MOCK DEFAULTS)
export function parseTesseractTextFallback(
  text: string,
  userCompanyTin?: string,
  userCompanyName?: string
): ReceiptExtractionResult {
  const cleanTin = (val: string) => val.replace(/\D/g, '');
  const normUserTin = cleanTin(userCompanyTin || '');
  const normUserCompany = (userCompanyName || 'Dantel Software PLC').toLowerCase();

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let fs_number: string | null = null;
  let machine_number: string | null = null;
  let partner_name: string | null = null;
  let partner_tin: string | null = null;
  let receipt_date: string | null = null;
  let untaxed_amount: number | null = null;
  let vat_amount: number | null = null;
  let total_amount: number | null = null;
  let classification: 'Purchase (Vendor Receipt)' | 'Sale (Customer Invoice)' = 'Purchase (Vendor Receipt)';
  const confidence_notes: string[] = ['Extracted via Tesseract 5.4 OCR fallback engine.'];

  // Patterns
  const fsRegex = /(?:FS|F\.S\.?|Fiscal\s*(?:Receipt|Serial|No|Number)?)\s*[:#\-.]?\s*([A-Za-z0-9][A-Za-z0-9\-/]{3,})/i;
  const machineRegex = /(?:Machine|Device|Terminal|POS|Register)\s*(?:No|Number|#|ID)?\s*[:#\-.]?\s*([A-Za-z0-9][A-Za-z0-9\-/]{3,})/i;
  const tinRegex = /(?:TIN|T\.I\.N|VAT\s*Reg)\s*[:#\-.]?\s*((?:\d[\s\-]?){9,12})/i;
  const amountRegex = /(?<![\d/])(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d%])/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // FS Number
    if (!fs_number && (line.includes('FS') || line.includes('Fiscal'))) {
      const match = line.match(fsRegex);
      if (match && match[1] && !match[1].toLowerCase().includes('date')) {
        fs_number = match[1].replace(/^[.:#\-]+|[.:#\-]+$/g, '');
      }
    }

    // Machine Number (strictly requires Machine, Terminal, or POS indicator)
    if (!machine_number && /(machine|terminal|erca[-_ ]?pos|device\s*no)/i.test(line)) {
      const match = line.match(machineRegex);
      if (match && match[1]) {
        const val = match[1].replace(/^[.:#\-]+|[.:#\-]+$/g, '');
        // Verify not substring of Customer/Machine
        if (!/customer|invoice|payment|cashier/i.test(val)) {
          machine_number = val;
        }
      }
    }

    // TIN
    const tinMatch = line.match(tinRegex);
    if (tinMatch && tinMatch[1]) {
      const candidateTin = cleanTin(tinMatch[1]);
      if (candidateTin.length >= 9 && candidateTin.length <= 11) {
        if (normUserTin && candidateTin === normUserTin) {
          classification = 'Sale (Customer Invoice)';
        } else if (!partner_tin) {
          partner_tin = candidateTin;
        }
      }
    }

    // Partner name heuristic: first few lines that are not headers or numbers
    if (!partner_name && i < 6) {
      const isEnglishAlpha = /^[A-Za-z\s.&,'\-]{4,}$/.test(line);
      const isSystemWord = /(invoice|receipt|cash|vat|tin|date|total|subtotal|machine|fs)/i.test(line);
      if (isEnglishAlpha && !isSystemWord) {
        if (!line.toLowerCase().includes(normUserCompany)) {
          partner_name = line;
        }
      }
    }

    // Amounts
    if (untaxed_amount === null && /(sub\s*total|taxable|net\s*amount|amount\s*before)/i.test(line)) {
      const matches = [...line.matchAll(amountRegex)];
      if (matches.length > 0) {
        const last = matches[matches.length - 1][0].replace(/,/g, '');
        const val = parseFloat(last);
        if (!isNaN(val)) untaxed_amount = val;
      }
    }
    if (vat_amount === null && /(vat|value\s*added)/i.test(line) && !/reg/i.test(line)) {
      const matches = [...line.matchAll(amountRegex)];
      if (matches.length > 0) {
        const last = matches[matches.length - 1][0].replace(/,/g, '');
        const val = parseFloat(last);
        if (!isNaN(val)) vat_amount = val;
      }
    }
    if (total_amount === null && /(grand\s*total|total\s*(?:amount|due)?|\btotal\b)/i.test(line)) {
      if (!/sub|wht|withhold/i.test(line)) {
        const matches = [...line.matchAll(amountRegex)];
        if (matches.length > 0) {
          const last = matches[matches.length - 1][0].replace(/,/g, '');
          const val = parseFloat(last);
          if (!isNaN(val)) total_amount = val;
        }
      }
    }

    // Date
    if (!receipt_date) {
      const dateMatch = line.match(/\b(\d{1,4}[./\-]\d{1,2}[./\-]\d{2,4})\b/);
      if (dateMatch) {
        receipt_date = normalizeDate(dateMatch[1]);
      }
    }
  }

  // Cross-calculate amounts if missing
  if (untaxed_amount && !vat_amount) {
    vat_amount = Math.round(untaxed_amount * 0.15 * 100) / 100;
  }
  if (untaxed_amount && vat_amount && !total_amount) {
    total_amount = Math.round((untaxed_amount + vat_amount) * 100) / 100;
  } else if (!untaxed_amount && total_amount) {
    vat_amount = Math.round((total_amount * 15 / 115) * 100) / 100;
    untaxed_amount = Math.round((total_amount - vat_amount) * 100) / 100;
  }

  // Withholding rate rule
  let wht_rate: 0 | 2 | 3 = 0;
  const amountForWht = untaxed_amount || total_amount || 0;
  if (amountForWht > 20000) {
    wht_rate = 3;
  } else if (amountForWht > 3000) {
    wht_rate = 2;
  }

  // Validate math consistency
  if (untaxed_amount !== null && total_amount !== null) {
    const expectedTotal = Math.round(untaxed_amount * 1.15 * 100) / 100;
    if (Math.abs(expectedTotal - total_amount) > 0.1) {
      confidence_notes.push(
        `VAT calculation mismatch: Untaxed ${untaxed_amount} * 1.15 = ${expectedTotal.toFixed(2)} ETB, but document shows Total ${total_amount} ETB.`
      );
    }
  }

  return {
    classification,
    receipt_date,
    fs_number,
    machine_number,
    partner_name,
    partner_tin,
    untaxed_amount,
    vat_amount,
    total_amount,
    wht_rate,
    confidence_notes,
  };
}

// 4. Multimodal Vision LLM Structured Extraction (Primary Engine)
export async function extractReceiptWithVisionLLM(
  input: ExtractionInput
): Promise<{ result: ReceiptExtractionResult; rawText: string; engine: 'vision-llm' | 'tesseract-fallback' }> {
  const companyDoc = input.companyDocument;
  const posSlip = input.posReceipt;
  const ourCompanyTin = input.companyTin || '0012938475';
  const ourCompanyName = input.companyName || 'Dantel Software PLC';

  // Run Tesseract in parallel so we have the raw text for audit log preview
  const tesseractPromises: Promise<string>[] = [];
  if (companyDoc) tesseractPromises.push(runTesseract(companyDoc.buffer, companyDoc.filename));
  if (posSlip) tesseractPromises.push(runTesseract(posSlip.buffer, posSlip.filename));

  const tesseractTexts = await Promise.all(tesseractPromises);
  const rawAuditText = tesseractTexts.filter(Boolean).join('\n\n--- NEXT IMAGE ---\n\n').trim();

  // Check for Vision LLM API Key (Gemini or OpenAI)
  const geminiApiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (geminiApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey, apiVersion: 'v1beta' });

      const prompt = `
You are a senior Ethiopian tax auditor and fiscal document specialist examining images of an Ethiopian tax invoice and/or POS cash register machine receipt (Fiscal Cash Receipt).
Our own company is "${ourCompanyName}" with TIN "${ourCompanyTin}".

Your task is to carefully examine the uploaded image(s) and extract the exact fiscal fields according to Ethiopian Ministry of Revenues (MOR / ERCA) regulations:

1. CLASSIFICATION:
   - "Purchase (Vendor Receipt)" if our company (${ourCompanyName} / TIN ${ourCompanyTin}) is the buyer/customer receiving goods or services.
   - "Sale (Customer Invoice)" if our company is the seller/issuer.

2. RECEIPT DATE:
   - Normalize to strictly "YYYY-MM-DD".
   - If written in Ethiopian/European DD/MM/YYYY or DD-MM-YYYY, convert correctly to YYYY-MM-DD.
   - If the date is completely unreadable or absent, return null. Do NOT assume today's date!

3. FS NUMBER (Fiscal Serial Number):
   - Extract the FS Number (e.g., "FS 0012345", "FS-9041", "FS10482").
   - If a POS Cash Register Slip is present, extract "FS No." from the POS slip.
   - If no POS slip exists, extract the "Invoice No." from the company invoice document.
   - If unreadable, return null. Do NOT make up mock values.

4. MACHINE NUMBER (ERCA POS Machine ID):
   - Extract the ERCA cash register machine number (typically prefixed like "AEB...", "MRC...", "MC...", "POS...", or "ERCA-POS-...").
   - If no cash register slip or machine ID is visible, return null. Do NOT guess substrings like slicing "Customer" into "ustomer".

5. PARTNER NAME:
   - The legal registered business name of the external partner/vendor in English (ignore pure Amharic headers).
   - Must NOT be our own company ("${ourCompanyName}"). Return null if unreadable.

6. PARTNER TIN:
   - Exactly 10 digits (Ethiopian Tax Identification Number).
   - Must NOT be our own TIN ("${ourCompanyTin}"). Return null if unreadable.

7. AMOUNTS (Numeric floats in ETB):
   - untaxed_amount: subtotal before 15% VAT.
   - vat_amount: 15% VAT amount.
   - total_amount: Grand total / balance due.

8. WITHHOLDING TAX RATE (wht_rate):
   - Return 3 if goods purchase > 20,000 ETB.
   - Return 2 if service purchase > 3,000 ETB.
   - Otherwise return 0.

9. CONFIDENCE NOTES:
   - Compare calculations: if untaxed_amount * 1.15 does not match total_amount within 0.05 ETB, flag it.
   - If both an invoice document and a POS slip were provided, verify whether their total amounts match. If they disagree, add an explicit warning.
   - If any critical field is missing or degraded by shadows/glare, add an explanatory note.

Return strictly a valid JSON object matching this schema:
{
  "classification": "Purchase (Vendor Receipt)" | "Sale (Customer Invoice)",
  "receipt_date": string | null,
  "fs_number": string | null,
  "machine_number": string | null,
  "partner_name": string | null,
  "partner_tin": string | null,
  "untaxed_amount": number | null,
  "vat_amount": number | null,
  "total_amount": number | null,
  "wht_rate": 0 | 2 | 3,
  "confidence_notes": string[]
}
`;

      const parts: any[] = [{ text: prompt }];

      if (companyDoc) {
        parts.push({
          inlineData: {
            mimeType: companyDoc.mimeType || 'image/jpeg',
            data: companyDoc.buffer.toString('base64'),
          },
        });
      }

      if (posSlip) {
        parts.push({
          inlineData: {
            mimeType: posSlip.mimeType || 'image/jpeg',
            data: posSlip.buffer.toString('base64'),
          },
        });
      }

      const modelsToTry = [
        'gemini-3.1-flash-lite',
        'gemini-3-flash-preview',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
      ];
      let rawJsonText = '';

      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts }],
            config: {
              responseMimeType: 'application/json',
            },
          });
          if (response && response.text) {
            rawJsonText = response.text;
            break;
          }
        } catch (mErr) {
          console.warn(`Vision model ${model} failed, trying next:`, mErr);
        }
      }

      if (rawJsonText) {
        const parsedJson = JSON.parse(rawJsonText);
        // Normalize date through validator
        if (parsedJson.receipt_date) {
          parsedJson.receipt_date = normalizeDate(parsedJson.receipt_date);
        }
        const validated = ReceiptExtractionSchema.parse(parsedJson);
        return {
          result: validated,
          rawText: rawAuditText || rawJsonText,
          engine: 'vision-llm',
        };
      }
    } catch (visionErr) {
      console.error('Gemini Vision extraction failed, falling back to Tesseract:', visionErr);
    }
  }

  // 5. OpenAI Vision Fallback if OPENAI_API_KEY configured
  if (openaiApiKey) {
    try {
      const messagesContent: any[] = [
        {
          type: 'text',
          text: `You are an Ethiopian tax auditor. Extract the fiscal fields from the attached invoice/POS receipt. Our company is "${ourCompanyName}" (TIN: "${ourCompanyTin}"). Ignore our TIN. Output pure JSON matching schema: { "classification": "Purchase (Vendor Receipt)" | "Sale (Customer Invoice)", "receipt_date": "YYYY-MM-DD" | null, "fs_number": string | null, "machine_number": string | null, "partner_name": string | null, "partner_tin": string | null, "untaxed_amount": number | null, "vat_amount": number | null, "total_amount": number | null, "wht_rate": 0 | 2 | 3, "confidence_notes": string[] }`,
        },
      ];

      if (companyDoc) {
        messagesContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${companyDoc.mimeType};base64,${companyDoc.buffer.toString('base64')}`,
          },
        });
      }
      if (posSlip) {
        messagesContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${posSlip.mimeType};base64,${posSlip.buffer.toString('base64')}`,
          },
        });
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: messagesContent }],
          response_format: { type: 'json_object' },
        }),
      });

      if (res.ok) {
        const openAiData = await res.json();
        const contentStr = openAiData.choices?.[0]?.message?.content;
        if (contentStr) {
          const parsed = JSON.parse(contentStr);
          if (parsed.receipt_date) parsed.receipt_date = normalizeDate(parsed.receipt_date);
          const validated = ReceiptExtractionSchema.parse(parsed);
          return {
            result: validated,
            rawText: rawAuditText || contentStr,
            engine: 'vision-llm',
          };
        }
      }
    } catch (openAiErr) {
      console.error('OpenAI Vision extraction failed:', openAiErr);
    }
  }

  // 6. Graceful Tesseract Heuristic Fallback (NO MOCK STRINGS)
  const tesseractCombined = rawAuditText;
  const fallbackResult = parseTesseractTextFallback(tesseractCombined, ourCompanyTin, ourCompanyName);

  return {
    result: fallbackResult,
    rawText: rawAuditText || 'No plain text could be extracted from image.',
    engine: 'tesseract-fallback',
  };
}
