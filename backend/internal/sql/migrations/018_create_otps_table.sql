-- +goose Up
-- Creates the otps table for storing various OTPs (e.g., password reset)
CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    purpose VARCHAR(50) NOT NULL, -- e.g., 'password_reset'
    used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otps_email ON otps (email);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps (expires_at);

-- +goose Down
DROP TABLE IF EXISTS otps;
