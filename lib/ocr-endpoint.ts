import { NextResponse } from 'next/server';
import { authenticate, getMemberships } from '@/lib/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { fileUrl } from '@/lib/documents';
import { extractReceiptWithVisionLLM, ExtractionInput } from '@/lib/receipt-extractor';

/** Vercel caps serverless request bodies at ~4.5 MB; stay under it. */
export const MAX_OCR_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_OCR_TOTAL_BYTES = 4.2 * 1024 * 1024;

const ACCEPTED_OCR_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/heic',
  'image/heif',
  'application/pdf',
];

type StoredFile = { path: string | null; name: string | null };

function firstEntry(form: FormData, names: string[]): FormDataEntryValue | null {
  for (const name of names) {
    const entry = form.get(name);
    if (entry) return entry;
  }
  return null;
}

export async function handleOcrPost(req: Request): Promise<NextResponse> {
  const ctx = await authenticate(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Content-Type must be multipart/form-data with at least one document' },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const memberships = await getMemberships(ctx);
  const membershipCompanyId = memberships[0]?.company_id ?? null;
  const requestedCompanyId = String(form.get('companyId') || '') || null;
  const companyId = ctx.isPlatformAdmin ? requestedCompanyId || membershipCompanyId : membershipCompanyId;

  if (!companyId) {
    return NextResponse.json({ error: 'No company is associated with this account' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('id, name, tin')
    .eq('id', companyId)
    .maybeSingle();

  if (companyError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const fileEntry = firstEntry(form, ['companyDocument', 'invoiceFile']);
  const posEntry = firstEntry(form, ['posReceipt', 'cashSlipFile']);
  const filePath = String(firstEntry(form, ['companyDocumentPath', 'invoicePath']) || '') || null;
  const posPath = String(firstEntry(form, ['posReceiptPath', 'cashSlipPath']) || '') || null;

  if (!fileEntry && !posEntry && !filePath && !posPath) {
    return NextResponse.json(
      { error: 'Upload an invoice or a POS cash register receipt' },
      { status: 400 }
    );
  }

  const uploads: File[] = [];
  for (const entry of [fileEntry, posEntry]) {
    if (entry instanceof File && entry.size > 0) uploads.push(entry);
  }

  for (const file of uploads) {
    if (file.size > MAX_OCR_FILE_BYTES) {
      return NextResponse.json(
        { error: `${file.name} is larger than 4 MB. Compress the photo or upload a smaller PDF.` },
        { status: 413 }
      );
    }
    if (file.type && !ACCEPTED_OCR_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `${file.name}: only JPEG, PNG, WEBP, TIFF, HEIC or PDF documents are supported.` },
        { status: 415 }
      );
    }
  }

  const totalBytes = uploads.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_OCR_TOTAL_BYTES) {
    return NextResponse.json(
      { error: 'The combined upload is larger than 4 MB. Upload one document at a time or compress the images.' },
      { status: 413 }
    );
  }

  function assertOwnedPath(path: string | null) {
    if (!path) return;
    if (ctx?.isPlatformAdmin) return;
    if (!path.startsWith(`companies/${companyId}/`)) {
      throw new Error('Invalid document path');
    }
  }

  try {
    assertOwnedPath(filePath);
    assertOwnedPath(posPath);
  } catch {
    return NextResponse.json({ error: 'Invalid document path' }, { status: 403 });
  }

  async function storeFile(file: File): Promise<StoredFile> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `companies/${companyId}/receipts/${Date.now()}-${crypto
      .randomUUID()
      .slice(0, 8)}-${safeName}`;
    const { error } = await admin.storage
      .from('documents')
      .upload(objectPath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
    if (error) throw new Error(error.message || 'Failed to store the receipt document');
    return { path: objectPath, name: file.name };
  }

  async function loadStored(path: string): Promise<{ buffer: Buffer; name: string; mimeType: string }> {
    const { data, error } = await admin.storage.from('documents').download(path);
    if (error || !data) throw new Error('Stored document could not be read');
    const name = path.split('/').pop() || 'document';
    const mimeType = name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
    return { buffer: Buffer.from(await data.arrayBuffer()), name, mimeType };
  }

  try {
    const input: ExtractionInput = {
      companyTin: company.tin || undefined,
      companyName: company.name || undefined,
    };

    const stored: { companyDocument: StoredFile; posReceipt: StoredFile } = {
      companyDocument: { path: filePath, name: null },
      posReceipt: { path: posPath, name: null },
    };

    if (fileEntry instanceof File && fileEntry.size > 0) {
      stored.companyDocument = await storeFile(fileEntry);
      input.companyDocument = {
        buffer: Buffer.from(await fileEntry.arrayBuffer()),
        mimeType: fileEntry.type || 'image/jpeg',
        filename: fileEntry.name,
      };
    } else if (filePath) {
      const loaded = await loadStored(filePath);
      stored.companyDocument.name = loaded.name;
      input.companyDocument = { buffer: loaded.buffer, mimeType: loaded.mimeType, filename: loaded.name };
    }

    if (posEntry instanceof File && posEntry.size > 0) {
      stored.posReceipt = await storeFile(posEntry);
      input.posReceipt = {
        buffer: Buffer.from(await posEntry.arrayBuffer()),
        mimeType: posEntry.type || 'image/jpeg',
        filename: posEntry.name,
      };
    } else if (posPath) {
      const loaded = await loadStored(posPath);
      stored.posReceipt.name = loaded.name;
      input.posReceipt = { buffer: loaded.buffer, mimeType: loaded.mimeType, filename: loaded.name };
    }

    const { result, rawText, engine } = await extractReceiptWithVisionLLM(input);

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        // Backwards-compatible aliases for older dashboards.
        issuer_name: result.partner_name || '',
        issuer_tin: result.partner_tin || '',
        invoice_date: result.receipt_date || '',
        receipt_type: result.classification,
      },
      rawText,
      engine,
      company: { id: company.id, name: company.name, tin: company.tin },
      files: {
        companyDocument: {
          path: stored.companyDocument.path,
          name: stored.companyDocument.name,
          url: stored.companyDocument.path ? fileUrl(stored.companyDocument.path) : null,
        },
        posReceipt: {
          path: stored.posReceipt.path,
          name: stored.posReceipt.name,
          url: stored.posReceipt.path ? fileUrl(stored.posReceipt.path) : null,
        },
      },
    });
  } catch (error: any) {
    console.error('OCR extraction pipeline error:', error);
    return NextResponse.json(
      { error: error?.message || 'Receipt extraction failed' },
      { status: 500 }
    );
  }
}
