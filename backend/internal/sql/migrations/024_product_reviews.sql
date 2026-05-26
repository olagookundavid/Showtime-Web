-- +goose Up

-- Customer-written reviews. One row per (product, user) — repeat reviews from
-- the same user upsert in place. `order_id` is a snapshot of the verifying
-- purchase at the time the review was written; it stays even if the order is
-- later cancelled so the "verified" badge doesn't flicker.
CREATE TABLE IF NOT EXISTS product_reviews (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id     UUID REFERENCES online_orders(id) ON DELETE SET NULL,
    rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title        VARCHAR(255) NOT NULL DEFAULT '',
    body         TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user    ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created ON product_reviews(product_id, created_at DESC);

-- Denormalize the rating summary onto the product so list / detail / card
-- queries don't have to fan out into product_reviews. Maintained by the
-- service layer after every review write.
ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS rating_avg   NUMERIC(3,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rating_count INT          NOT NULL DEFAULT 0;

-- +goose Down

ALTER TABLE store_products
    DROP COLUMN IF EXISTS rating_avg,
    DROP COLUMN IF EXISTS rating_count;

DROP INDEX IF EXISTS idx_product_reviews_created;
DROP INDEX IF EXISTS idx_product_reviews_user;
DROP INDEX IF EXISTS idx_product_reviews_product;
DROP TABLE IF EXISTS product_reviews;
