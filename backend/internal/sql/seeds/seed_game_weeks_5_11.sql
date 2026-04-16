-- Seed script for Game Weeks 5-11
-- Venue: Showtime Arena

DO $$
DECLARE
    week5_id UUID := gen_random_uuid();
    week6_id UUID := gen_random_uuid();
    week7_id UUID := gen_random_uuid();
    week8_id UUID := gen_random_uuid();
    week9_id UUID := gen_random_uuid();
    week10_id UUID := gen_random_uuid();
    week11_id UUID := gen_random_uuid();
BEGIN
    -- ========================================================================
    -- EVENT DAYS
    -- ========================================================================
    INSERT INTO event_days (id, title, date, venue) VALUES
    (week5_id,  'Game Week 5',  '2026-04-19', 'Showtime Arena'),
    (week6_id,  'Game Week 6',  '2026-04-26', 'Showtime Arena'),
    (week7_id,  'Game Week 7',  '2026-05-03', 'Showtime Arena'),
    (week8_id,  'Game Week 8',  '2026-05-10', 'Showtime Arena'),
    (week9_id,  'Game Week 9',  '2026-05-17', 'Showtime Arena'),
    (week10_id, 'Game Week 10', '2026-05-24', 'Showtime Arena'),
    (week11_id, 'Game Week 11', '2026-05-31', 'Showtime Arena');

    -- ========================================================================
    -- TICKET TIERS
    -- ========================================================================
    -- Week 5 Tiers
    INSERT INTO ticket_tiers (event_day_id, name, price, capacity, description) VALUES
    (week5_id, 'Regular 1', 3000,  0,  'General admission'),
    (week5_id, 'Regular 2', 5000,  0,  'General admission + small chops and cold soda'),
    (week5_id, 'VIP',       30000, 30, 'VIP seating + Food and refreshments');

    -- Week 6 Tiers
    INSERT INTO ticket_tiers (event_day_id, name, price, capacity, description) VALUES
    (week6_id, 'Regular 1', 3000,  0,  'General admission'),
    (week6_id, 'Regular 2', 5000,  0,  'General admission + small chops and cold soda'),
    (week6_id, 'VIP',       30000, 30, 'VIP seating + Food and refreshments');

    -- Week 7 Tiers
    INSERT INTO ticket_tiers (event_day_id, name, price, capacity, description) VALUES
    (week7_id, 'Regular 1', 3000,  0,  'General admission'),
    (week7_id, 'Regular 2', 5000,  0,  'General admission + small chops and cold soda'),
    (week7_id, 'VIP',       30000, 30, 'VIP seating + Food and refreshments');

    -- Week 8 Tiers
    INSERT INTO ticket_tiers (event_day_id, name, price, capacity, description) VALUES
    (week8_id, 'Regular 1', 3000,  0,  'General admission'),
    (week8_id, 'Regular 2', 5000,  0,  'General admission + small chops and cold soda'),
    (week8_id, 'VIP',       30000, 30, 'VIP seating + Food and refreshments');

    -- Week 9 Tiers
    INSERT INTO ticket_tiers (event_day_id, name, price, capacity, description) VALUES
    (week9_id, 'Regular 1', 3000,  0,  'General admission'),
    (week9_id, 'Regular 2', 5000,  0,  'General admission + small chops and cold soda'),
    (week9_id, 'VIP',       30000, 30, 'VIP seating + Food and refreshments');

    -- Week 10 Tiers
    INSERT INTO ticket_tiers (event_day_id, name, price, capacity, description) VALUES
    (week10_id, 'Regular 1', 3000,  0,  'General admission'),
    (week10_id, 'Regular 2', 5000,  0,  'General admission + small chops and cold soda'),
    (week10_id, 'VIP',       30000, 30, 'VIP seating + Food and refreshments');

    -- Week 11 Tiers
    INSERT INTO ticket_tiers (event_day_id, name, price, capacity, description) VALUES
    (week11_id, 'Regular 1', 3000,  0,  'General admission'),
    (week11_id, 'Regular 2', 5000,  0,  'General admission + small chops and cold soda'),
    (week11_id, 'VIP',       30000, 30, 'VIP seating + Food and refreshments');
END $$;
