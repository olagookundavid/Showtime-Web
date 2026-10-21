// Public host for files in R2. Must match the backend's R2_PUBLIC_URL.
export const CDN_URL = (import.meta.env.VITE_CDN_URL || 'https://cdn.showtimeflag.football').replace(/\/$/, '');

export type MediaKind = 'pdf' | 'image' | 'document';

const MB = 1024 * 1024;

/**
 * What the media library accepts, keyed by file extension. Mirrors `mediaTypes`
 * in backend/internal/services/media_service.go, which has the final say; this
 * copy only gives early feedback and sends the exact content type the backend
 * expects (browsers disagree on some, e.g. CSV). No SVG: it can carry script.
 */
export const MEDIA_TYPES: Record<string, { contentType: string; kind: MediaKind; maxBytes: number }> = {
    pdf: { contentType: 'application/pdf', kind: 'pdf', maxBytes: 25 * MB },
    jpg: { contentType: 'image/jpeg', kind: 'image', maxBytes: 10 * MB },
    jpeg: { contentType: 'image/jpeg', kind: 'image', maxBytes: 10 * MB },
    png: { contentType: 'image/png', kind: 'image', maxBytes: 10 * MB },
    webp: { contentType: 'image/webp', kind: 'image', maxBytes: 10 * MB },
    gif: { contentType: 'image/gif', kind: 'image', maxBytes: 10 * MB },
    docx: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'document', maxBytes: 25 * MB },
    xlsx: { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'document', maxBytes: 25 * MB },
    pptx: { contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'document', maxBytes: 25 * MB },
    csv: { contentType: 'text/csv', kind: 'document', maxBytes: 25 * MB },
};

/** For the file picker's `accept`. */
export const MEDIA_ACCEPT = Object.keys(MEDIA_TYPES).map((ext) => `.${ext}`).join(',');

export const MEDIA_TYPES_HINT = 'PDF up to 25 MB, images (JPG, PNG, WebP, GIF) up to 10 MB, or Word, Excel, PowerPoint and CSV files up to 25 MB.';
