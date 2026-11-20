import { handleOcrPost } from '@/lib/ocr-endpoint';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  return handleOcrPost(req);
}
