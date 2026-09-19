/**
 * Browser-side Image Compression Utility
 * Phase 2.2 - Smart Family Finance
 *
 * Features:
 * - Resize to max 1600px
 * - Convert to WebP
 * - Quality 85%
 * - Support JPG, JPEG, PNG, WebP
 * - No HEIC support in V1
 */

export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  dataUrl: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface CompressionOptions {
  maxDimension?: number; // default: 1600
  quality?: number; // default: 0.85 (85%)
  outputFormat?: 'webp' | 'jpeg' | 'png';
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxDimension: 1600,
  quality: 0.85,
  outputFormat: 'webp',
};

/**
 * Load an image file and return its HTMLImageElement
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Validate if file is a supported image type
 */
export function isSupportedImageType(file: File): boolean {
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return supportedTypes.includes(file.type.toLowerCase());
}

/**
 * Validate file type and throw error if not supported
 */
export function validateImageType(file: File): void {
  if (!isSupportedImageType(file)) {
    throw new Error(
      `ไม่รองรับไฟล์ประเภท ${file.type || 'unknown'} รองรับเฉพาะ JPG, JPEG, PNG, WebP`
    );
  }
}

/**
 * Get image dimensions from a File or Blob
 */
export async function getImageDimensions(file: File | Blob): Promise<ImageDimensions> {
  const img = await loadImage(file);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): { width: number; height: number } {
  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return { width: originalWidth, height: originalHeight };
  }

  const aspectRatio = originalWidth / originalHeight;

  if (originalWidth > originalHeight) {
    return {
      width: maxDimension,
      height: Math.round(maxDimension / aspectRatio),
    };
  } else {
    return {
      width: Math.round(maxDimension * aspectRatio),
      height: maxDimension,
    };
  }
}

/**
 * Resize and compress an image
 */
export async function compressImage(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  // Load and validate image
  const img = await loadImage(file);
  validateImageType(file as File);

  // Calculate new dimensions
  const { width, height } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    opts.maxDimension
  );

  // Create canvas and draw resized image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw resized image
  ctx.drawImage(img, 0, 0, width, height);

  // Determine output mime type
  const mimeType = opts.outputFormat === 'jpeg'
    ? 'image/jpeg'
    : opts.outputFormat === 'png'
      ? 'image/png'
      : 'image/webp';

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) {
          resolve(b);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      mimeType,
      opts.quality
    );
  });

  // Generate data URL for preview
  const dataUrl = await blobToDataUrl(blob);

  return {
    blob,
    width,
    height,
    originalSize,
    compressedSize: blob.size,
    dataUrl,
  };
}

/**
 * Convert Blob to base64 data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert data URL to Blob
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * Calculate compression ratio
 */
export function getCompressionRatio(original: number, compressed: number): string {
  if (original === 0) return '0%';
  const ratio = ((original - compressed) / original) * 100;
  const sign = ratio >= 0 ? '-' : '+';
  return `${sign}${Math.abs(ratio).toFixed(1)}%`;
}
