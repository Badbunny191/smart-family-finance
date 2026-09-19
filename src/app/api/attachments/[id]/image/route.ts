import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext, handleApiError } from '@/lib/api-auth';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/attachments/[id]/image
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await getRequestContext(request);
    const { id } = await params;

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

    // Get image from R2
    const r2Binding = (globalThis as { BUCKET?: R2Bucket }).BUCKET;
    if (!r2Binding) {
      return NextResponse.json({ error: 'Storage service unavailable' }, { status: 503 });
    }

    const r2Object = await r2Binding.get(fileKey);
    if (!r2Object) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ใน storage' }, { status: 404 });
    }

    // Convert ReadableStream to Buffer
    const reader = r2Object.body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const imageData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      imageData.set(chunk, offset);
      offset += chunk.length;
    }

    return new NextResponse(imageData, {
      status: 200,
      headers: {
        'Content-Type': fileType || 'image/webp',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
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
