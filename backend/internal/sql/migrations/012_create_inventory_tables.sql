-- +goose Up

-- Products catalogue
CREATE TABLE IF NOT EXISTS inventory_products (
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

-- Sale records  
CREATE TABLE IF NOT EXISTS inventory_sales (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID NOT NULL REFERENCES inventory_products(id) ON DELETE RESTRICT,
    seller_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    quantity_sold    INT NOT NULL CHECK (quantity_sold > 0),
    unit_price       NUMERIC(12, 2) NOT NULL,
    total_amount     NUMERIC(12, 2) GENERATED ALWAYS AS (quantity_sold * unit_price) STORED,
    notes            TEXT,
    sold_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_sales_product   ON inventory_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sales_seller    ON inventory_sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sales_sold_at   ON inventory_sales(sold_at);
CREATE INDEX IF NOT EXISTS idx_inventory_products_active ON inventory_products(is_active);

-- +goose Down
DROP TABLE IF EXISTS inventory_sales;
DROP TABLE IF EXISTS inventory_products;
