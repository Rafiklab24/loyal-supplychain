/**
 * Inline Photo Upload Component
 * Simple photo upload for before/after photos in the Elleçleme request form
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CameraIcon,
  XMarkIcon,
  PhotoIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

interface PhotoFile {
  file: File;
  preview: string;
}

interface InlinePhotoUploadProps {
  label: string;
  photos: PhotoFile[];
  onChange: (photos: PhotoFile[]) => void;
  variant: 'before' | 'after';
  maxPhotos?: number;
}

export default function InlinePhotoUpload({
  label,
  photos,
  onChange,
  variant,
  maxPhotos = 5,
}: InlinePhotoUploadProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const variantStyles = variant === 'before'
    ? {
        border: 'border-amber-200',
        bg: 'bg-amber-50',
        hoverBg: 'hover:bg-amber-100',
        icon: 'text-amber-500',
        badge: 'bg-amber-100 text-amber-700',
      }
    : {
        border: 'border-emerald-200',
        bg: 'bg-emerald-50',
        hoverBg: 'hover:bg-emerald-100',
        icon: 'text-emerald-500',
        badge: 'bg-emerald-100 text-emerald-700',
      };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newPhotos: PhotoFile[] = [];
    const remainingSlots = maxPhotos - photos.length;

    Array.from(files).slice(0, remainingSlots).forEach((file) => {
      if (file.type.startsWith('image/')) {
        newPhotos.push({
          file,
          preview: URL.createObjectURL(file),
        });
      }
    });

    onChange([...photos, ...newPhotos]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = (index: number) => {
    const newPhotos = [...photos];
    URL.revokeObjectURL(newPhotos[index].preview);
    newPhotos.splice(index, 1);
    onChange(newPhotos);
  };

  return (
    <div className={`rounded-lg border ${variantStyles.border} ${variantStyles.bg} p-3`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CameraIcon className={`h-4 w-4 ${variantStyles.icon}`} />
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        {photos.length > 0 && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${variantStyles.badge}`}>
            {photos.length} {t('ellecleme.photos.count', 'صورة')}
          </span>
        )}
      </div>

      {/* Photos Grid */}
      <div className="flex flex-wrap gap-2">
        {/* Existing Photos */}
        {photos.map((photo, index) => (
          <div
            key={index}
            className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-white group"
          >
            <img
              src={photo.preview}
              alt={`${variant} ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Add Photo Button */}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`w-16 h-16 rounded-lg border-2 border-dashed ${variantStyles.border} ${variantStyles.hoverBg} flex flex-col items-center justify-center transition-colors`}
          >
            <PlusIcon className={`h-5 w-5 ${variantStyles.icon}`} />
            <span className="text-xs text-slate-500 mt-0.5">
              {t('common.add', 'إضافة')}
            </span>
          </button>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Empty State */}
      {photos.length === 0 && (
        <p className="text-xs text-slate-500 mt-1">
          {t('ellecleme.photos.clickToAdd', 'اضغط على + لإضافة صور')}
        </p>
      )}
    </div>
  );
}

// Type export for parent components
export type { PhotoFile };
