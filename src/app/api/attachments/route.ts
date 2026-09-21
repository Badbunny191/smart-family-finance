import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { attachments, transactions } from '@/db/schema';
import { getRequestContext, handleApiError } from '@/lib/api-auth';
import { getR2 } from '@/lib/cloudflare';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/attachments?transactionId=xxx
export async function GET(request: NextRequest) {
  try {
    const { db } = await getRequestContext(request);
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');

    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
    }

    // Verify transaction exists
    const txRows = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), isNull(transactions.deletedAt)))
      .limit(1);

    if (!txRows[0]) {
      return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
    }

    // Fetch attachments
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
      .where(and(eq(attachments.transactionId, transactionId), isNull(attachments.deletedAt)));

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/attachments
// Body: FormData with { transactionId, imageData, fileName }
// OR JSON: { transactionId, imageData, fileName }
export async function POST(request: NextRequest) {
  try {
    const { db } = await getRequestContext(request);

    // Support both FormData and JSON
    let transactionId: string;
    let imageData: string;
    let fileName: string;
    let previewData: string | undefined; // V1: optional preview from client

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Parse FormData
      const formData = await request.formData();
      transactionId = formData.get('transactionId') as string;
      imageData = formData.get('imageData') as string;
      fileName = (formData.get('fileName') as string) || '';
      previewData = formData.get('previewData') as string | undefined;
    } else {
      // Parse JSON
      const body = (await request.json()) as {
        transactionId?: string;
        imageData?: string;
        fileName?: string;
        previewData?: string;
      };
      transactionId = body.transactionId || '';
      imageData = body.imageData || '';
      fileName = body.fileName || '';
      previewData = body.previewData;
    }

    // Validate input
    if (!transactionId || typeof transactionId !== 'string') {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
    }
    if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
      return NextResponse.json({ error: 'imageData must be a base64 data URL' }, { status: 400 });
    }

    const txId = transactionId.trim();

    // Verify transaction exists
    const txRows = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.id, txId), isNull(transactions.deletedAt)))
      .limit(1);

    if (!txRows[0]) {
      return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
    }

    // Count existing attachments (max 5)
    const countResult = await db
      .select({ id: attachments.id })
      .from(attachments)
      .where(and(eq(attachments.transactionId, transactionId), isNull(attachments.deletedAt)));

    if (countResult.length >= 5) {
      return NextResponse.json({ error: 'จำนวนไฟล์แนบสูงสุด 5 รูป' }, { status: 400 });
    }

    // Parse base64 image
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: 'Invalid image data format' }, { status: 400 });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    // Decode base64 using atob (available in Workers)
    const binaryString = atob(base64Data);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }

    // Validate image type (only webp, jpeg, png, gif)
    const allowedTypes = ['webp', 'jpeg', 'jpg', 'png', 'gif'];
    if (!allowedTypes.includes(mimeType)) {
      return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ WebP, JPEG, PNG, GIF' }, { status: 400 });
    }

    // Validate file size (max 10MB before compression)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      return NextResponse.json({ error: 'ไฟล์มีขนาดใหญ่เกิน 10MB' }, { status: 400 });
    }

    // Get image dimensions and compress
    const { width, height, compressedData } = await compressImage(buffer, mimeType);

    // Generate unique file key for R2
    const id = crypto.randomUUID();
    const extension = mimeType === 'jpeg' ? 'jpg' : mimeType;
    const fileKey = `attachments/${txId}/${id}.${extension}`;
    const fname = fileName || `image-${Date.now()}.${extension}`;

    // Upload to R2 using BUCKET binding
    const r2 = getR2();

    // 1. Upload original to R2
    await r2.put(fileKey, compressedData, {
      httpMetadata: {
        contentType: `image/${mimeType}`,
      },
      customMetadata: {
        transactionId: txId,
      },
    });

    // 2. Create and upload preview (800px max, WebP quality 80)
    const previewKey = fileKey.replace(/\.(\w+)$/, '_preview.webp');

    if (previewData) {
      // Use client-compressed preview as actual preview
      const previewMatches = previewData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (previewMatches) {
        const previewBinary = atob(previewMatches[2]);
        const previewBuffer = new Uint8Array(previewBinary.length);
        for (let i = 0; i < previewBinary.length; i++) {
          previewBuffer[i] = previewBinary.charCodeAt(i);
        }
        await r2.put(previewKey, previewBuffer, {
          httpMetadata: {
            contentType: 'image/webp',
          },
          customMetadata: {
            transactionId: txId,
            isPreview: 'true',
          },
        });
      }
    } else {
      // Fallback: use original if no client preview provided
      await r2.put(previewKey, compressedData, {
        httpMetadata: {
          contentType: `image/${mimeType}`,
        },
        customMetadata: {
          transactionId: txId,
          isPreview: 'true',
          fallback: 'original',
        },
      });
    }

    // Save to D1
    const now = new Date();
    const attachment = {
      id,
      transactionId: txId,
      fileKey,
      fileName: fname,
      fileType: `image/${mimeType}`,
      fileSize: compressedData.byteLength,
      width,
      height,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(attachments).values(attachment);

    return NextResponse.json({
      id,
      transactionId: txId,
      fileName: fname,
      fileType: `image/${mimeType}`,
      fileSize: compressedData.byteLength,
      width,
      height,
      createdAt: now,
    }, { status: 201 });
  } catch (error) {
    console.error('[ATTACHMENT UPLOAD ERROR]', error);

    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.stack || error.message
          : String(error),
      },
      { status: 500 }
    );
  }
}

interface CompressResult {
  width: number;
  height: number;
  compressedData: Uint8Array;
}

async function compressImage(data: Uint8Array, mimeType: string): Promise<CompressResult> {
  // Get image dimensions from header
  const dimensions = getImageDimensions(data, mimeType);
  const originalWidth = dimensions.width;
  const originalHeight = dimensions.height;

  // Target max dimension
  const maxDimension = 1600;
  let targetWidth = originalWidth;
  let targetHeight = originalHeight;

  // Calculate new dimensions maintaining aspect ratio
  if (originalWidth > maxDimension || originalHeight > maxDimension) {
    if (originalWidth > originalHeight) {
      targetWidth = maxDimension;
      targetHeight = Math.round((originalHeight * maxDimension) / originalWidth);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((originalWidth * maxDimension) / originalHeight);
    }
  }

  // For Phase 2.1: Skip actual resizing, dimensions are for display
  // Compression will happen in Phase 2.2 (Image Compression Utility)
  return {
    width: targetWidth,
    height: targetHeight,
    compressedData: data,
  };
}

function getImageDimensions(data: Uint8Array, mimeType: string): { width: number; height: number } {
  // Helper: read 16-bit big-endian from Uint8Array
  const readUInt16BE = (arr: Uint8Array, offset: number): number => {
    return (arr[offset] << 8) | arr[offset + 1];
  };

  // Helper: read 32-bit big-endian from Uint8Array
  const readUInt32BE = (arr: Uint8Array, offset: number): number => {
    return (arr[offset] << 24) | (arr[offset + 1] << 16) | (arr[offset + 2] << 8) | arr[offset + 3];
  };

  // PNG: bytes 16-24 contain width and height (big-endian, 4 bytes each)
  if (mimeType === 'png') {
    return {
      width: readUInt32BE(data, 16),
      height: readUInt32BE(data, 20),
    };
  }

  // JPEG: parse SOF markers
  if (mimeType === 'jpeg' || mimeType === 'jpg') {
    let width = 0;
    let height = 0;
    let offset = 2;

    while (offset < data.length - 4) {
      if (data[offset] !== 0xff) break;
      const marker = data[offset + 1];

      // SOF markers (0xC0-0xCF except 0xC4, 0xC8, 0xCC)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        height = readUInt16BE(data, offset + 5);
        width = readUInt16BE(data, offset + 7);
        break;
      }

      const length = readUInt16BE(data, offset + 2);
      offset += 2 + length;
    }

    return { width: width || 800, height: height || 600 };
  }

  // GIF: bytes 6-10 contain width and height (little-endian)
  if (mimeType === 'gif') {
    return {
      width: data[6] | (data[7] << 8),
      height: data[8] | (data[9] << 8),
    };
  }

  // Default for unknown formats
  return { width: 800, height: 600 };
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
