-- +goose Up

-- Comments back two surfaces that never share a table row type: news articles and
-- matches. entity_type/entity_id is a soft polymorphic reference rather than two
-- FK columns because a comment belongs to exactly one of them, and a nullable-FK
-- pair would let a row point at both (or neither) with nothing to stop it.
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('news', 'match')),
    entity_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    -- NULL for top-level comments. Self-referencing cascade means deleting a
    -- parent takes its replies with it, which is what "delete my comment" means
    -- to the person clicking it.
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    likes_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- Top-level page fetch filters on parent_id IS NULL and orders by created_at DESC,
-- so parent_id rides in the index key to keep that path index-only.
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id, parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON comment_likes(user_id);

ALTER TABLE news ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- +goose Down
ALTER TABLE news DROP COLUMN IF EXISTS comments_enabled;
DROP TABLE IF EXISTS comment_likes;
DROP TABLE IF EXISTS comments;
