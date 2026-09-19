import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/attachments/[id]/image
// Public endpoint - returns image if it exists (auth check is done at page level)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  
  try {
    const d1 = await getD1();
    const db = getDb(d1);

    const { attachments } = await import('@/db/schema');
    const { and, eq, isNull } = await import('drizzle-orm');

    const rows = await db
      .select({ fileKey: attachments.fileKey, fileType: attachments.fileType })
      .from(attachments)
      .where(and(eq(attachments.id, id), isNull(attachments.deletedAt)))
      .limit(1);

    if (!rows[0]) {
      console.log(`[Image API] Attachment not found: ${id}`);
      return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 });
    }

    const { fileKey, fileType } = rows[0];
    console.log(`[Image API] Found attachment ${id}, fileKey: ${fileKey}`);

    // Get R2 bucket using dynamic import to avoid context issues
    const { getR2 } = await import('@/lib/cloudflare');
    const r2 = getR2();

    const r2Object = await r2.get(fileKey);
    if (!r2Object) {
      console.log(`[Image API] R2 object not found: ${fileKey}`);
      return NextResponse.json({ error: 'ไม่พบไฟล์ใน storage' }, { status: 404 });
    }

    // Use arrayBuffer() for reliable data extraction
    const imageData = await r2Object.arrayBuffer();

    console.log(`[Image API] Returning image ${id}, size: ${imageData.byteLength} bytes`);

    return new Response(imageData, {
      status: 200,
      headers: {
        'Content-Type': fileType || 'image/webp',
        'Content-Length': String(imageData.byteLength),
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error(`[Image API] Error for ${id}:`, error);
    if (error instanceof Error) {
      if (error.message.includes('R2 binding') || error.message.includes('Cloudflare context')) {
        return NextResponse.json({ error: 'Storage service unavailable' }, { status: 503 });
      }
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการโหลดรูปภาพ' }, { status: 500 });
  }
}
