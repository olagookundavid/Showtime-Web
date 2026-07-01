import React, { useRef, useState, useEffect } from 'react';
import { PhotoIcon, XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { useImageUpload } from '../../hooks/useImageUpload';
import toast from 'react-hot-toast';
import { LightboxImage } from './LightboxImage';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: 'players' | 'teams' | 'competitions' | 'news' | 'hero-slides';
  error?: string;
  helperText?: string;
  isCommitted?: boolean;
  // Max accepted file size in MB (default 5). Larger for full-width surfaces
  // like hero slides where higher-resolution source images are expected.
  maxSizeMB?: number;
  // Optional compression override (output). Defaults to ~1MB / 1920px; raise
  // for full-width surfaces (hero slides) that need higher-quality output.
  compression?: { maxSizeMB?: number; maxWidthOrHeight?: number };
  // 'single' (default) keeps the preview as the currently-selected image and
  // shows "Change Image". 'picker' clears the preview after each successful
  // upload — used when the parent immediately consumes the URL into a list
  // (e.g. product gallery) so the picker stays ready for the next image.
  mode?: 'single' | 'picker';
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  value,
  onChange,
  folder,
  error,
  helperText,
  isCommitted = false,
  maxSizeMB = 5,
  compression,
  mode = 'single',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, deleteImage, isUploading, progress, error: uploadError } = useImageUpload();
  const [preview, setPreview] = useState<string | null>(value || null);
  const uncommittedUrlRef = useRef<string | null>(null);
  const isCommittedRef = useRef(isCommitted);

  useEffect(() => {
    isCommittedRef.current = isCommitted;
  }, [isCommitted]);

  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  useEffect(() => {
    return () => {
      // If we unmount and we have an uncommitted upload that wasn't saved, delete it
      if (uncommittedUrlRef.current && !isCommittedRef.current && uncommittedUrlRef.current !== value) {
        deleteImage(uncommittedUrlRef.current);
      }
    };
  }, []); // Only on mount/unmount 
  // wait, I need to check the latest value in the cleanup.
  // Actually, uncommittedUrlRef and isCommittedRef are refs, so they'll have latest values.

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }

    // Local preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      const publicUrl = await uploadImage(file, folder, compression);
      if (publicUrl) {
        // If there was a previous uncommitted upload, delete it
        if (uncommittedUrlRef.current && uncommittedUrlRef.current !== value) {
          deleteImage(uncommittedUrlRef.current);
        }
        uncommittedUrlRef.current = publicUrl;
        onChange(publicUrl);
        toast.success('Image uploaded successfully');

        // Picker mode: the parent immediately consumes the URL into a list,
        // so the inline preview/picker should reset to empty for the next pick.
        if (mode === 'picker') {
          uncommittedUrlRef.current = null;
          setPreview(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      } else {
        toast.error(uploadError || 'Failed to upload image. Please try again.');
        setPreview(value || null);
      }
    } catch (err: any) {
      console.error('Upload caught error:', err);
      toast.error(err?.message || 'An unexpected error occurred during upload');
      setPreview(value || null);
    }
  };

  const removeImage = () => {
    if (uncommittedUrlRef.current && uncommittedUrlRef.current !== value) {
      deleteImage(uncommittedUrlRef.current);
      uncommittedUrlRef.current = null;
    }
    setPreview(null);
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>

      <div className="flex items-start space-x-4">
        <div className="relative w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-gray-800">
          {preview ? (
            <>
              <LightboxImage
                src={preview}
                alt="Preview"
                thumbnailClassName="w-full h-full object-cover"
              />
              {!isUploading && (
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 focus:outline-none"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <PhotoIcon className="w-10 h-10 text-gray-400" />
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
              <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] text-white mt-1">Uploading...</span>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
            {mode === 'picker' ? 'Select Image' : (preview ? 'Change Image' : 'Upload Image')}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {helperText || `JPG, PNG or WEBP. Max ${maxSizeMB}MB (will be compressed).`}
          </p>

          {(error || uploadError) && (
            <p className="text-xs text-red-500 mt-1">{error || uploadError}</p>
          )}
        </div>
      </div>
    </div>
  );
};
