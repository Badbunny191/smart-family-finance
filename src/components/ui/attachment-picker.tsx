'use client';

import { useState, useCallback, useRef } from 'react';
import {
  compressImage,
  formatFileSize,
  getCompressionRatio,
  isSupportedImageType,
  type CompressionResult,
} from '@/lib/image-compression';

export interface AttachmentPickerFile {
  id: string;
  file: File;
  preview: CompressionResult;
}

export interface AttachmentPickerProps {
  selectedFiles: AttachmentPickerFile[];
  onFilesChange: (files: AttachmentPickerFile[]) => void;
  maxAttachments?: number;
}

const DEFAULT_MAX_ATTACHMENTS = 5;

export function AttachmentPicker({
  selectedFiles,
  onFilesChange,
  maxAttachments = DEFAULT_MAX_ATTACHMENTS,
}: AttachmentPickerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAddMore = selectedFiles.length < maxAttachments;

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const availableSlots = maxAttachments - selectedFiles.length;

      if (availableSlots <= 0) {
        alert(`จำนวนไฟล์แนบสูงสุด ${maxAttachments} รูป`);
        return;
      }

      // Limit to available slots
      const filesToProcess = fileArray.slice(0, availableSlots);
      setIsProcessing(true);

      try {
        const newFiles: AttachmentPickerFile[] = [];

        for (const file of filesToProcess) {
          if (!isSupportedImageType(file)) {
            alert(`ไม่รองรับไฟล์ ${file.name} รองรับเฉพาะ JPG, JPEG, PNG, WebP`);
            continue;
          }

          try {
            const preview = await compressImage(file);
            newFiles.push({
              id: crypto.randomUUID(),
              file,
              preview,
            });
          } catch (error) {
            alert(`ไม่สามารถประมวลผลไฟล์ ${file.name}: ${error}`);
          }
        }

        onFilesChange([...selectedFiles, ...newFiles]);
      } finally {
        setIsProcessing(false);
      }
    },
    [maxAttachments, selectedFiles, onFilesChange]
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

  const removeFile = useCallback(
    (id: string) => {
      onFilesChange(selectedFiles.filter((f) => f.id !== id));
    },
    [selectedFiles, onFilesChange]
  );

  return (
    <div className="mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-700">
          รูปภาพประกอบ ({selectedFiles.length}/{maxAttachments})
        </span>
        {selectedFiles.length > 0 && (
          <span className="text-xs text-slate-500">
            {formatFileSize(selectedFiles.reduce((acc, f) => acc + f.preview.compressedSize, 0))} รวม
          </span>
        )}
      </div>

      {/* Drop Zone */}
      {canAddMore && (
        <div
          className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div>
            {isProcessing ? (
              <>
                <svg
                  className="mx-auto h-10 w-10 text-blue-500 animate-spin"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <p className="mt-2 text-sm text-slate-600">กำลังประมวลผล...</p>
              </>
            ) : (
              <>
                <svg
                  className="mx-auto h-10 w-10 text-slate-400"
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
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-medium text-blue-600">คลิกเพื่อเลือกไฟล์</span> หรือลากไฟล์มาวาง
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  รองรับ JPG, JPEG, PNG, WebP
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Selected Files Grid */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {selectedFiles.map((item) => (
            <div
              key={item.id}
              className="relative group bg-slate-100 rounded-xl overflow-hidden aspect-square"
            >
              {/* Preview */}
              <img
                src={item.preview.dataUrl}
                alt={item.file.name}
                className="w-full h-full object-cover"
              />

              {/* Remove Button */}
              <button
                onClick={() => removeFile(item.id)}
                className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                title="ลบ"
              >
                <svg
                  className="w-4 h-4 text-white"
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

              {/* Compression Info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-xs text-white/90 truncate">{item.file.name}</p>
                <p className="text-xs text-green-400">
                  {formatFileSize(item.preview.originalSize)} → {formatFileSize(item.preview.compressedSize)}
                  <span className="ml-1 text-green-300">
                    ({getCompressionRatio(item.preview.originalSize, item.preview.compressedSize)})
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isProcessing && selectedFiles.length === 0 && (
        <p className="mt-3 text-xs text-slate-500 text-center">
          ไม่บังคับเลือกรูป
        </p>
      )}
    </div>
  );
}
