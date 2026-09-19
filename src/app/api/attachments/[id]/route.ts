import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { attachments } from '@/db/schema';
import { getRequestContext, handleApiError } from '@/lib/api-auth';

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
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;

    const rows = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, id), isNull(attachments.deletedAt)))
      .limit(1);

    if (!rows[0]) {
      return NextResponse.json({ error: 'ไม่พบไฟล์แนบ' }, { status: 404 });
    }

    const attachment = rows[0];

    // Delete from R2
    const r2Binding = (globalThis as { BUCKET?: R2Bucket }).BUCKET;
    if (r2Binding) {
      await r2Binding.delete(attachment.fileKey);
    }

    // Soft delete in D1
    await db
      .update(attachments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(attachments.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// Type definitions for R2 binding
interface R2Bucket {
  put(key: string, value: Uint8Array | ReadableStream, options?: {
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  }): Promise<void>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
  head(key: string): Promise<R2Object | null>;
}

interface R2Object {
  body: ReadableStream;
  httpMetadata: { contentType?: string };
  customMetadata: Record<string, string>;
  size: number;
}
