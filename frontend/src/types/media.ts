/** A file in the media library. `url` is fixed: replacing the file keeps it. */
export interface MediaFile {
    id: string;
    /** The file's name in its URL, e.g. "rulebook" in /files/rulebook.pdf. Never changes. */
    slug: string;
    object_key: string;
    url: string;
    title: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    uploaded_by: string | null;
    uploaded_by_name: string;
    created_at: string;
    updated_at: string;
}

/** Ask for an upload slot. Send `file_id` to replace a file, or `slug` for a new one. */
export interface PresignMediaPayload {
    file_id?: string;
    slug?: string;
    filename: string;
    content_type: string;
    size: number;
}

export interface PresignMediaResult {
    upload_url: string;
    upload_key: string;
}

export interface CreateMediaPayload {
    slug: string;
    title: string;
    filename: string;
    upload_key: string;
}

export interface ReplaceMediaPayload {
    filename: string;
    upload_key: string;
}
