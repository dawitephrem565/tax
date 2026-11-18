import { NextRequest, NextResponse } from 'next/server';
import { extractReceiptWithVisionLLM, ExtractionInput } from '@/lib/receipt-extractor';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const companyTin = (formData.get('companyTin') as string) || '';
    const companyName = (formData.get('companyName') as string) || '';

    const companyDocEntry = formData.get('invoiceFile') || formData.get('companyDocument');
    const posReceiptEntry = formData.get('cashSlipFile') || formData.get('posReceipt');

    if (!companyDocEntry && !posReceiptEntry) {
      return NextResponse.json(
        { error: 'At least one receipt or invoice file must be uploaded' },
        { status: 400 }
      );
    }

    const extractionInput: ExtractionInput = {
      companyTin,
      companyName,
    };

    if (companyDocEntry instanceof File && companyDocEntry.size > 0) {
      extractionInput.companyDocument = {
        buffer: Buffer.from(await companyDocEntry.arrayBuffer()),
        mimeType: companyDocEntry.type || 'image/jpeg',
        filename: companyDocEntry.name,
      };
    }

    if (posReceiptEntry instanceof File && posReceiptEntry.size > 0) {
      extractionInput.posReceipt = {
        buffer: Buffer.from(await posReceiptEntry.arrayBuffer()),
        mimeType: posReceiptEntry.type || 'image/jpeg',
        filename: posReceiptEntry.name,
      };
    }

    const { result, rawText, engine } = await extractReceiptWithVisionLLM(extractionInput);

    // Map fields for backward compatibility with existing frontends
    const compatibleData = {
      ...result,
      issuer_name: result.partner_name || '',
      issuer_tin: result.partner_tin || '',
      invoice_date: result.receipt_date || '',
      receipt_type: result.classification.includes('Sale') ? 'sale' : 'purchase',
    };

    return NextResponse.json({
      success: true,
      data: compatibleData,
      rawText,
      engine,
    });
  } catch (error: any) {
    console.error('OCR Route Error:', error);
    return NextResponse.json(
      { error: error.message || 'Receipt extraction failed' },
      { status: 500 }
    );
  }
}
