-- +goose Up
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id),
    email VARCHAR(255) NOT NULL,
    user_id UUID,
    quantity INT NOT NULL DEFAULT 1,
    unit_price INT NOT NULL,
    total_amount INT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    paystack_reference VARCHAR(255) UNIQUE,
    paystack_access_code VARCHAR(255),
    ticket_code VARCHAR(50) UNIQUE,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    checked_in_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tickets_match ON tickets(match_id);
CREATE INDEX idx_tickets_email ON tickets(email);
CREATE INDEX idx_tickets_reference ON tickets(paystack_reference);
CREATE INDEX idx_tickets_code ON tickets(ticket_code);

-- +goose Down
DROP TABLE IF EXISTS tickets;
