import { NextRequest, NextResponse } from 'next/server';
import { getD1, getR2 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { getRequestContext } from '@/lib/api-auth';
import { and, eq, isNull } from 'drizzle-orm';
import { attachments, transactions } from '@/db/schema';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/attachments/[id]/image?size=preview
// size: 'original' (default) | 'preview'
// Requires auth + ownership check via transaction.createdByUserId
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const size = searchParams.get('size') || 'original';
  const isPreview = size === 'preview';

  try {
    // [SECURITY] Auth required
    const { db, session } = await getRequestContext(request);

    // [SECURITY] Ownership check - must be attachment owner or admin
    const ownershipRows = await db
      .select({ userId: transactions.createdByUserId })
      .from(attachments)
      .leftJoin(transactions, eq(attachments.transactionId, transactions.id))
      .where(and(eq(attachments.id, id), isNull(attachments.deletedAt)))
      .limit(1);

    if (!ownershipRows[0]) {
      return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 });
    }

    const isOwner = ownershipRows[0].userId === session.user.id;
    const isUserAdmin = (session.user as { role?: string }).role === 'admin';
    if (!isOwner && !isUserAdmin) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    // DB Query
    const d1 = await getD1();
    const dbClient = getDb(d1);

    const rows = await dbClient
      .select({ fileKey: attachments.fileKey, fileType: attachments.fileType })
      .from(attachments)
      .where(and(eq(attachments.id, id), isNull(attachments.deletedAt)))
      .limit(1);

    if (!rows[0]) {
      return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 });
    }

    const { fileKey, fileType } = rows[0];
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
