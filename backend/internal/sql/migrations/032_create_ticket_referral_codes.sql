-- +goose Up
CREATE TABLE IF NOT EXISTS ticket_referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_referral_codes_code ON ticket_referral_codes(code);

ALTER TABLE tickets
ADD COLUMN referral_code VARCHAR(50) NULL REFERENCES ticket_referral_codes(code) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_referral_code ON tickets(referral_code);

-- +goose Down
DROP INDEX IF EXISTS idx_tickets_referral_code;
ALTER TABLE tickets DROP COLUMN IF EXISTS referral_code;
DROP INDEX IF EXISTS idx_ticket_referral_codes_code;
DROP TABLE IF EXISTS ticket_referral_codes;
