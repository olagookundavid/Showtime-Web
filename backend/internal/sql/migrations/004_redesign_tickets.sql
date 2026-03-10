-- +goose Up

-- Event Days: a date-scoped concept grouping all matches on a single day
CREATE TABLE IF NOT EXISTS event_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    date DATE NOT NULL UNIQUE,
    venue VARCHAR(255) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Tiers: pricing tiers per event day (Regular, VIP, VVIP, Custom)
CREATE TABLE IF NOT EXISTS ticket_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_day_id UUID NOT NULL REFERENCES event_days(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price INT NOT NULL,
    capacity INT NOT NULL DEFAULT 0,
    sold_count INT NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_day_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event_day ON ticket_tiers(event_day_id);

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_day_id UUID NOT NULL REFERENCES event_days(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES ticket_tiers(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_tickets_event_day ON tickets(event_day_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tier ON tickets(tier_id);
CREATE INDEX IF NOT EXISTS idx_tickets_email ON tickets(email);
CREATE INDEX IF NOT EXISTS idx_tickets_reference ON tickets(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_tickets_code ON tickets(ticket_code);

-- +goose Down
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS ticket_tiers;
DROP TABLE IF EXISTS event_days;
