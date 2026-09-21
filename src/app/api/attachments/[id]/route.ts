import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { attachments } from '@/db/schema';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { getR2 } from '@/lib/cloudflare';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/attachments/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;

    const rows = await db
      .select({
        id: attachments.id,
        transactionId: attachments.transactionId,
        fileName: attachments.fileName,
        fileType: attachments.fileType,
        fileSize: attachments.fileSize,
        width: attachments.width,
        height: attachments.height,
        createdAt: attachments.createdAt,
      })
      .from(attachments)
      .where(and(eq(attachments.id, id), isNull(attachments.deletedAt)))
      .limit(1);

    if (!rows[0]) {
      return NextResponse.json({ error: 'ไม่พบไฟล์แนบ' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/attachments/[id]
// Hard deletes: R2 original → R2 preview → D1 record
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;

    // Find attachment (include soft-deleted for recovery scenarios)
    const rows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .limit(1);

    if (!rows[0]) {
      return NextResponse.json({ error: 'ไม่พบไฟล์แนบ' }, { status: 404 });
    }

    const attachment = rows[0];

    // Skip if already deleted
    if (attachment.deletedAt) {
      return NextResponse.json({ success: true, alreadyDeleted: true });
    }

    const r2 = getR2();
    const fileKey = attachment.fileKey;

    // [1] Delete original file from R2
    try {
      await r2.delete(fileKey);
    } catch (error) {
      console.warn(`[Attachment DELETE] R2 original file not found or already deleted: ${fileKey}`);
    }

    // [2] Delete preview file from R2
    const previewKey = fileKey.replace(/\.(\w+)$/, '_preview.webp');
    try {
      await r2.delete(previewKey);
    } catch (error) {
      console.warn(`[Attachment DELETE] R2 preview file not found or already deleted: ${previewKey}`);
    }

    // [3] Hard delete from D1
    await db.delete(attachments).where(eq(attachments.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
