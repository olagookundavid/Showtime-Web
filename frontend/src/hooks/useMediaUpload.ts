import { useState } from 'react';
import { MEDIA_TYPES } from '../constants';
import { createMediaFile, presignMediaUpload, replaceMediaFile } from '../services';
import type { MediaFile } from '../types';
import { getApiErrorMessage } from '../utils';

/** The file's extension, lower-cased, without the dot ("" when it has none). */
export const fileExtension = (name: string) => {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/** The media library's rules for a file, or null when its type isn't allowed. */
export const mediaTypeForFile = (file: File) => MEDIA_TYPES[fileExtension(file.name)] ?? null;

// PUT the file straight to R2. XHR rather than fetch, for upload progress; and
// not the axios instance, whose interceptors would attach our auth header.
const putToStorage = (url: string, file: File, contentType: string, onProgress: (pct: number) => void) =>
    new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('The upload was rejected by storage. Try again.')));
        xhr.onerror = () => reject(new Error('The upload failed. Check your connection and try again.'));
        xhr.send(file);
    });

type Target = { slug: string; title: string } | { fileId: string };

/**
 * Uploads a file to the media library: presign, PUT to R2, then create the
 * record (new file) or swap the file behind an existing link (replace).
 */
export const useMediaUpload = () => {
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const upload = async (file: File, target: Target): Promise<MediaFile> => {
        const type = mediaTypeForFile(file);
        if (!type) throw new Error("That file type isn't allowed.");
        if (file.size > type.maxBytes) {
            throw new Error(`The file is too large. ${fileExtension(file.name).toUpperCase()} files can be up to ${type.maxBytes / (1024 * 1024)} MB.`);
        }

        setIsUploading(true);
        setProgress(0);
        try {
            const replacing = 'fileId' in target;
            const { upload_url, upload_key } = await presignMediaUpload({
                ...(replacing ? { file_id: target.fileId } : { slug: target.slug }),
                filename: file.name,
                content_type: type.contentType,
                size: file.size,
            });
            await putToStorage(upload_url, file, type.contentType, setProgress);
            return replacing
                ? await replaceMediaFile(target.fileId, { filename: file.name, upload_key })
                : await createMediaFile({ slug: target.slug, title: target.title, filename: file.name, upload_key });
        } catch (err) {
            throw new Error(getApiErrorMessage(err, err instanceof Error ? err.message : 'The upload failed. Try again.'));
        } finally {
            setIsUploading(false);
        }
    };

    return { upload, isUploading, progress };
};
