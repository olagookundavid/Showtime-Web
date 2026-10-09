-- +goose Up
-- Article bodies are now rich-text HTML. content_text is their plain-text
-- projection (written by the app on every save, and back-filled at boot by
-- services.BackfillNewsRichText) so admin search matches words, not markup —
-- searching "strong" must not hit every article with bold text.
ALTER TABLE news ADD COLUMN IF NOT EXISTS content_text TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS idx_news_content_trgm;
CREATE INDEX IF NOT EXISTS idx_news_content_text_trgm ON news USING gin (content_text gin_trgm_ops);

-- +goose Down
DROP INDEX IF EXISTS idx_news_content_text_trgm;
CREATE INDEX IF NOT EXISTS idx_news_content_trgm ON news USING gin (content gin_trgm_ops);
ALTER TABLE news DROP COLUMN IF EXISTS content_text;
