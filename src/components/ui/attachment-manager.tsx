'use client';

import { useState, useCallback, useRef } from 'react';
import {
  compressImage,
  formatFileSize,
  getCompressionRatio,
  isSupportedImageType,
  type CompressionResult,
} from '@/lib/image-compression';

// Preview compression options: 128px max, WebP quality 30 - EXTREME for testing
const PREVIEW_MAX_DIMENSION = 128;
const PREVIEW_QUALITY = 0.3;

export interface Attachment {
  id?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  width?: number;
  height?: number;
  dataUrl: string;
}

export interface PendingAttachment {
  id: string;
  file: File;
  originalPreview: CompressionResult; // 1600px WebP Q90 - for upload as original
  previewImage: CompressionResult; // 800px WebP Q80 - for upload as preview
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  serverId?: string;
}

export interface AttachmentManagerProps {
  transactionId: string;
  maxAttachments?: number;
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  apiEndpoint?: string;
}

const DEFAULT_MAX_ATTACHMENTS = 5;

export function AttachmentManager({
  transactionId,
  maxAttachments = DEFAULT_MAX_ATTACHMENTS,
  onAttachmentsChange,
  apiEndpoint = '/api/attachments',
}: AttachmentManagerProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing attachments on mount
  const loadExistingAttachments = useCallback(async () => {
    if (!transactionId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}?transactionId=${transactionId}`);
      if (response.ok) {
        const data = await response.json();
        // Fetch image URLs for each attachment - use preview for grid/list
        const attachmentsWithUrls = await Promise.all(
          (data as Attachment[]).map(async (att) => {
            // V1: Try preview first, fallback to original
            const imgResponse = await fetch(`${apiEndpoint}/${att.id}/image?size=preview`);
            if (imgResponse.ok) {
              const blob = await imgResponse.blob();
              const dataUrl = await blobToDataUrl(blob);
              return { ...att, dataUrl };
            }
            // Fallback to original if preview fails
            const originalResponse = await fetch(`${apiEndpoint}/${att.id}/image`);
            if (originalResponse.ok) {
              const blob = await originalResponse.blob();
              const dataUrl = await blobToDataUrl(blob);
              return { ...att, dataUrl };
            }
            return { ...att, dataUrl: '' };
          })
        );
        setExistingAttachments(attachmentsWithUrls);
        onAttachmentsChange?.(attachmentsWithUrls);
      }
    } catch (error) {
      console.error('Failed to load attachments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [transactionId, apiEndpoint, onAttachmentsChange]);

  // Initial load
  useState(() => {
    loadExistingAttachments();
  });

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const currentTotal = pendingFiles.length + existingAttachments.length;
      const availableSlots = maxAttachments - currentTotal;

      if (availableSlots <= 0) {
        alert(`จำนวนไฟล์แนบสูงสุด ${maxAttachments} รูป`);
        return;
      }

      // Limit to available slots
      const filesToProcess = fileArray.slice(0, availableSlots);

      // Validate and compress each file
      const newPending: PendingAttachment[] = [];

      for (const file of filesToProcess) {
        if (!isSupportedImageType(file)) {
          alert(`ไม่รองรับไฟล์ ${file.name} รองรับเฉพาะ JPG, JPEG, PNG, WebP`);
          continue;
        }

        try {
          // Create original preview (1600px, WebP Q90) - this will be uploaded as original
          const originalPreview = await compressImage(file, {
            maxDimension: 1600,
            quality: 0.9,
            outputFormat: 'webp',
          });

          // Create preview image (128px, WebP Q30) - this will be uploaded as preview
          const previewImage = await compressImage(file, {
            maxDimension: PREVIEW_MAX_DIMENSION,
            quality: PREVIEW_QUALITY,
            outputFormat: 'webp',
          });

          newPending.push({
            id: crypto.randomUUID(),
            file,
            originalPreview,
            previewImage,
            status: 'pending',
          });
        } catch (error) {
          alert(`ไม่สามารถประมวลผลไฟล์ ${file.name}: ${error}`);
        }
      }

      setPendingFiles((prev) => [...prev, ...newPending]);
    },
    [maxAttachments, pendingFiles.length, existingAttachments.length]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const removePending = useCallback((id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const uploadAll = useCallback(async () => {
    if (pendingFiles.length === 0) return;

    setPendingFiles((prev) =>
      prev.map((f) => (f.status === 'pending' ? { ...f, status: 'uploading' } : f))
    );

    const results = await Promise.allSettled(
      pendingFiles.map(async (pending) => {
        const formData = new FormData();
        formData.append('transactionId', transactionId);
        formData.append('imageData', pending.originalPreview.dataUrl);
        formData.append('previewData', pending.previewImage.dataUrl);
        formData.append('fileName', pending.file.name);

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(errorData.error || 'Upload failed');
        }

        const responseData = (await response.json()) as { id: string };
        return { id: pending.id, serverId: responseData.id };
      })
    );

    // Update states based on results
    setPendingFiles((prev) =>
      prev.map((f, i) => {
        const result = results[i];
        if (result.status === 'fulfilled') {
          return { ...f, status: 'uploaded' as const, serverId: result.value.serverId };
        } else {
          return { ...f, status: 'error' as const, error: result.reason.message };
        }
      })
    );

    // Reload existing attachments
    await loadExistingAttachments();
  }, [pendingFiles, transactionId, apiEndpoint, loadExistingAttachments]);

  const deleteAttachment = useCallback(
    async (id: string) => {
      if (!confirm('ลบไฟล์แนบนี้?')) return;

      try {
        const response = await fetch(`${apiEndpoint}/${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setExistingAttachments((prev) => prev.filter((a) => a.id !== id));
          onAttachmentsChange?.(existingAttachments.filter((a) => a.id !== id));
        }
      } catch (error) {
        alert('ไม่สามารถลบไฟล์แนบ');
      }
    },
    [apiEndpoint, existingAttachments, onAttachmentsChange]
  );

  const totalAttachments = pendingFiles.length + existingAttachments.length;
  const canAddMore = totalAttachments < maxAttachments;

  return (
    <div className="attachment-manager">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">
          ไฟล์แนบ ({totalAttachments}/{maxAttachments})
        </span>
        {pendingFiles.filter((f) => f.status === 'pending').length > 0 && (
          <button
            onClick={uploadAll}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            อัปโหลดทั้งหมด ({pendingFiles.filter((f) => f.status === 'pending').length})
          </button>
        )}
      </div>

      {/* Drop Zone */}
      {canAddMore && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div className="pointer-events-none">
            <svg
              className="mx-auto h-10 w-10 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium text-blue-600">คลิกเพื่อเลือกไฟล์</span> หรือลากไฟล์มาวาง
            </p>
            <p className="mt-1 text-xs text-gray-500">
              รองรับ JPG, JPEG, PNG, WebP (สูงสุด 10MB)
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mt-4 text-center text-sm text-gray-500">กำลังโหลดไฟล์แนบ...</div>
      )}

      {/* Pending Files */}
      {pendingFiles.length > 0 && (
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-700">รออัปโหลด</h4>
          {pendingFiles.map((pending) => (
            <PendingFileCard
              key={pending.id}
              pending={pending}
              onRemove={() => removePending(pending.id)}
            />
          ))}
        </div>
      )}

      {/* Existing Attachments */}
      {existingAttachments.length > 0 && (
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-700">ไฟล์ที่อัปโหลดแล้ว</h4>
          {existingAttachments.map((attachment) => (
            <AttachmentCard
              key={attachment.id}
              attachment={attachment}
              onDelete={() => attachment.id && deleteAttachment(attachment.id)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && totalAttachments === 0 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          ยังไม่มีไฟล์แนบ
        </div>
      )}
    </div>
  );
}

// Pending File Card Component
interface PendingFileCardProps {
  pending: PendingAttachment;
  onRemove: () => void;
}

function PendingFileCard({ pending, onRemove }: PendingFileCardProps) {
  const { originalPreview, previewImage, status, error } = pending;

  // Use previewImage (800px) for display, originalPreview (1600px) for upload
  const displayPreview = previewImage;

  return (
    <div className="relative flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      {/* Preview Image */}
      <div className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-gray-200">
        <img
          src={displayPreview.dataUrl}
          alt="Preview"
          className="w-full h-full object-cover"
        />
        {status === 'uploading' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <svg
              className="animate-spin h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
        {status === 'uploaded' && (
          <div className="absolute inset-0 bg-green-500/80 flex items-center justify-center">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {pending.file.name}
        </p>
        <div className="mt-1 text-xs text-gray-500 space-y-0.5">
          <div className="flex items-center gap-2">
            <span>ก่อน: {formatFileSize(originalPreview.originalSize)}</span>
            <span>→</span>
            <span className="text-green-600 font-medium">
              Original: {formatFileSize(originalPreview.compressedSize)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              Original: {originalPreview.width}×{originalPreview.height}
            </span>
            <span className="text-blue-600">
              Preview: {previewImage.width}×{previewImage.height} ({previewImage.compressedSize < originalPreview.compressedSize ? '-' : ''}{getCompressionRatio(originalPreview.compressedSize, previewImage.compressedSize)})
            </span>
          </div>
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}
      </div>

      {/* Remove Button */}
      {(status === 'pending' || status === 'error') && (
        <button
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title="ลบ"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

// Attachment Card Component
interface AttachmentCardProps {
  attachment: Attachment;
  onDelete: () => void;
}

function AttachmentCard({ attachment, onDelete }: AttachmentCardProps) {
  return (
    <div className="relative flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
      {/* Preview Image */}
      <div className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-gray-200">
        {attachment.dataUrl ? (
          <img
            src={attachment.dataUrl}
            alt={attachment.fileName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {attachment.fileName}
        </p>
        <div className="mt-1 text-xs text-gray-500">
          {formatFileSize(attachment.fileSize)}
          {attachment.width && attachment.height && (
            <span className="ml-2">
              {attachment.width}×{attachment.height}
            </span>
          )}
        </div>
      </div>

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
        title="ลบไฟล์แนบ"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
}

// Helper function
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export default AttachmentManager;
