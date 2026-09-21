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

    let targetKey = fileKey;
    let targetContentType = fileType || 'image/webp';

    if (isPreview) {
      const previewKey = fileKey.replace(/\.(\w+)$/, '_preview.webp');
      const previewObject = await r2.get(previewKey);
      if (previewObject) {
        targetKey = previewKey;
        targetContentType = 'image/webp';
      }
    }
    const r2Object = await r2.get(targetKey);

    if (!r2Object) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ใน storage' }, { status: 404 });
    }

    const imageData = await r2Object.arrayBuffer();

    const response = new Response(imageData, {
      status: 200,
      headers: {
        'Content-Type': targetContentType,
        'Content-Length': String(imageData.byteLength),
        'Cache-Control': 'public, max-age=31536000',
      },
    });

    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('R2 binding') || error.message.includes('Cloudflare context')) {
        return NextResponse.json({ error: 'Storage service unavailable' }, { status: 503 });
      }
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการโหลดรูปภาพ' }, { status: 500 });
  }
}
