import { NextRequest, NextResponse } from 'next/server';
import { extractReceiptWithVisionLLM, ExtractionInput } from '@/lib/receipt-extractor';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data with image file(s)' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const companyTin = (formData.get('companyTin') as string) || '';
    const companyName = (formData.get('companyName') as string) || '';

    // Accept either companyDocument/posReceipt or invoiceFile/cashSlipFile
    const companyDocEntry = formData.get('companyDocument') || formData.get('invoiceFile');
    const posReceiptEntry = formData.get('posReceipt') || formData.get('cashSlipFile');

    if (!companyDocEntry && !posReceiptEntry) {
      return NextResponse.json(
        { error: 'At least one document (Company Invoice or POS Cash Register Slip) is required' },
        { status: 400 }
      );
    }

    const extractionInput: ExtractionInput = {
      companyTin,
      companyName,
    };

    if (companyDocEntry instanceof File && companyDocEntry.size > 0) {
      const buffer = Buffer.from(await companyDocEntry.arrayBuffer());
      extractionInput.companyDocument = {
        buffer,
        mimeType: companyDocEntry.type || 'image/jpeg',
        filename: companyDocEntry.name,
      };
    }

    if (posReceiptEntry instanceof File && posReceiptEntry.size > 0) {
      const buffer = Buffer.from(await posReceiptEntry.arrayBuffer());
      extractionInput.posReceipt = {
        buffer,
        mimeType: posReceiptEntry.type || 'image/jpeg',
        filename: posReceiptEntry.name,
      };
    }

    const { result, rawText, engine } = await extractReceiptWithVisionLLM(extractionInput);

    return NextResponse.json({
      success: true,
      data: result,
      rawText,
      engine,
    });
  } catch (error: any) {
    console.error('OCR Extraction Pipeline Error:', error);
    return NextResponse.json(
      { error: error.message || 'Receipt extraction pipeline failed' },
      { status: 500 }
    );
  }
}
