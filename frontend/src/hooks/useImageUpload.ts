import { useState } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8089/api/v1';

interface PresignResponse {
  status: boolean;
  message: string;
  data: {
    upload_url: string;
    object_key: string;
    public_url: string;
  };
}

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadImage = async (
    file: File,
    folder: string,
    compression?: { maxSizeMB?: number; maxWidthOrHeight?: number },
  ): Promise<string | null> => {
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      // 0. iPhones save photos as HEIC/HEIF, which browser-image-compression
      // can't decode directly (canvas/Image decoding only works reliably for
      // JPEG/PNG/WEBP-family formats across browsers, HEIC support is
      // effectively Safari-only). Convert it to a JPEG first with heic2any
      // (a pure-JS/WASM decoder, so this works in every browser) — the
      // compression step below then re-encodes that JPEG to webp as normal.
      let sourceFile = file;
      if (/\.hei[cf]$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif') {
        setProgress(5);
        const heic2any = (await import('heic2any')).default;
        const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
        const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
        sourceFile = new File([jpegBlob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
      }

      // 1. Compress Image. Defaults keep most images light (~1MB / 1920px);
      // callers can override for full-width surfaces (e.g. hero slides) that
      // need higher-resolution output.
      const options = {
        maxSizeMB: compression?.maxSizeMB ?? 1,
        maxWidthOrHeight: compression?.maxWidthOrHeight ?? 1920,
        useWebWorker: true,
        fileType: 'image/webp'
      };

      setProgress(10);
      const compressedFile = await imageCompression(sourceFile, options);
      setProgress(30);

      // 2. Get Presigned URL
      const token = localStorage.getItem('showtime_access_token');
      const presignRes = await axios.post<PresignResponse>(
        `${API_URL}/upload/presign`,
        {
          folder: folder,
          content_type: 'image/webp',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!presignRes.data.status) {
        throw new Error(presignRes.data.message || 'Failed to get upload URL');
      }
      const { upload_url, public_url } = presignRes.data.data;

      setProgress(50);

      // 3. Upload to R2 (Direct PUT)
      // Use fetch to avoid axios interceptors attaching Auth headers to R2
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        body: compressedFile,
        headers: {
          'Content-Type': 'image/webp',
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload image to storage');
      }

      setProgress(100);
      return public_url;
    } catch (err: any) {
      console.error('Upload error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to upload image';
      setError(errorMessage);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteImage = async (url: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('showtime_access_token');
      await axios.delete(`${API_URL}/upload`, {
        data: { url },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return true;
    } catch (err: any) {
      console.error('Delete error:', err);
      return false;
    }
  };

  return { uploadImage, deleteImage, isUploading, error, progress };
};
