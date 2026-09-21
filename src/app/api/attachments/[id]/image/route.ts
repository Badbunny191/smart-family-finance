import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/attachments/[id]/image?size=preview
// size: 'original' (default) | 'preview'
// Public endpoint - returns image if it exists (auth check is done at page level)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const size = searchParams.get('size') || 'original';
  const isPreview = size === 'preview';

  try {
    // DB Query
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
      return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 });
    }

    const { fileKey, fileType } = rows[0];
    const { getR2 } = await import('@/lib/cloudflare');
    const r2 = getR2();

    // R2 GET - prefer preview, fallback to original
    let r2Object = null;
    let targetKey = fileKey;
    let targetContentType = fileType || 'image/webp';

    if (isPreview) {
      const previewKey = fileKey.replace(/\.(\w+)$/, '_preview.webp');
      r2Object = await r2.get(previewKey);
      if (r2Object) {
        targetKey = previewKey;
        targetContentType = 'image/webp';
      } else {
        r2Object = await r2.get(fileKey);
      }
    } else {
      r2Object = await r2.get(fileKey);
    }

    if (!r2Object) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ใน storage' }, { status: 404 });
    }

    // Stream R2 response directly - no buffering
    const contentLength = r2Object.size;
    return new Response(r2Object.body, {
      status: 200,
      headers: {
        'Content-Type': targetContentType,
        'Content-Length': String(contentLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[IMAGE API] ERROR:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการโหลดรูปภาพ' }, { status: 500 });
  }
}
