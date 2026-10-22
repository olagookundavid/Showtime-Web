-- +goose Up

-- The media library: files an admin uploads to R2 to link to from anywhere (PDFs,
-- images, documents). Each file lives at a fixed key, files/<slug>.<ext>, so its
-- public URL never changes — replacing the file overwrites that key in place.
CREATE TABLE IF NOT EXISTS media_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The file's name in its URL. Set once, never edited: changing it would break links.
    slug VARCHAR(80) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    object_key TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    title VARCHAR(160) NOT NULL,
    original_filename VARCHAR(255) NOT NULL DEFAULT '',
    content_type VARCHAR(120) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_files_updated ON media_files (updated_at DESC);

-- The Media Library admin page (feature "media"), given to the roles that already edit
-- the other public content. app_admin has everything regardless.
-- Selected from roles so a role deleted since migration 115 doesn't break this.
INSERT INTO role_permissions (role_key, feature, level)
SELECT key, 'media', 'full' FROM roles WHERE key IN ('admin', 'content_creator')
ON CONFLICT (role_key, feature) DO NOTHING;

-- +goose Down

DELETE FROM role_permissions WHERE feature = 'media';
DROP TABLE IF EXISTS media_files;
