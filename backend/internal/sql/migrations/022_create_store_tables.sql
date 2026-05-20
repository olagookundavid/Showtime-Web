-- +goose Up

-- 1. Store Products table (specifically for online storefront, completely separate from physical inventory)
CREATE TABLE IF NOT EXISTS store_products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    sku         VARCHAR(100) UNIQUE,
    description TEXT,
    price       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    quantity    INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    threshold   INT NOT NULL DEFAULT 5,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_products_active ON store_products(is_active);

-- 2. Store Product Images table
CREATE TABLE IF NOT EXISTS store_product_images (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    image_url     TEXT NOT NULL,
    is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_product_images_product ON store_product_images(product_id);

-- 3. Store Product Variants table (individual online options, pricing overrides, and variant specific SKU/quantities)
CREATE TABLE IF NOT EXISTS store_product_variants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    variant_name  VARCHAR(100) NOT NULL, -- e.g., 'Size', 'Color'
    variant_value VARCHAR(100) NOT NULL, -- e.g., 'M', 'Navy'
    sku           VARCHAR(100) UNIQUE,
    price         NUMERIC(12, 2),        -- variant custom price override (optional)
    quantity      INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_product_variants_product ON store_product_variants(product_id);

-- 4. User Saved Addresses table
CREATE TABLE IF NOT EXISTS user_saved_addresses (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_name VARCHAR(255) NOT NULL,
    phone          VARCHAR(100) NOT NULL,
    country        VARCHAR(100) NOT NULL,
    state          VARCHAR(100) NOT NULL,
    city           VARCHAR(100) NOT NULL,
    street_address TEXT NOT NULL,
    postal_code    VARCHAR(50),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user ON user_saved_addresses(user_id);

-- 5. Online Orders table
CREATE TABLE IF NOT EXISTS online_orders (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_reference      VARCHAR(100) NOT NULL UNIQUE,
    user_id              UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_name        VARCHAR(255) NOT NULL,
    customer_email       VARCHAR(255) NOT NULL,
    customer_phone       VARCHAR(100) NOT NULL,
    shipping_country     VARCHAR(100) NOT NULL,
    shipping_state       VARCHAR(100) NOT NULL,
    shipping_city        VARCHAR(100) NOT NULL,
    shipping_address     TEXT NOT NULL,
    shipping_postal_code VARCHAR(50),
    total_amount         NUMERIC(12, 2) NOT NULL,
    payment_status       VARCHAR(50) NOT NULL DEFAULT 'pending',
    fulfillment_status   VARCHAR(50) NOT NULL DEFAULT 'pending',
    paystack_reference   VARCHAR(100) UNIQUE,
    paystack_access_code VARCHAR(100),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_online_orders_user     ON online_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_paystack ON online_orders(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_online_orders_status   ON online_orders(payment_status, fulfillment_status);

-- 6. Online Order Items table
CREATE TABLE IF NOT EXISTS online_order_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES online_orders(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES store_products(id) ON DELETE RESTRICT,
    variant_id  UUID REFERENCES store_product_variants(id) ON DELETE SET NULL,
    quantity    INT NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_online_order_items_order ON online_order_items(order_id);

-- +goose Down
DROP TABLE IF EXISTS online_order_items;
DROP TABLE IF EXISTS online_orders;
DROP TABLE IF EXISTS user_saved_addresses;
DROP TABLE IF EXISTS store_product_variants;
DROP TABLE IF EXISTS store_product_images;
DROP TABLE IF EXISTS store_products;
