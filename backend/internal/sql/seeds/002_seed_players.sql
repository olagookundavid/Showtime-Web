-- Seed Players (references teams from 001_seed_match_hub.sql)

INSERT INTO players 
(name, jersey_number, position, team_id, bio, image, touchdowns, yards, interceptions, tackles) 
VALUES

-- Lagos Hurricanes
('J. ADEYEMI', 12, 'QB', 'b1a3d5f7-9c2e-4b6a-8d1f-2e3c4b5a6d71',
 'Star quarterback leading the Hurricanes. Known for accurate throws and strategic play.',
 'https://images.unsplash.com/photo-1546962339-5ff89552b8ed?w=400&q=80',
 18, 2450, 3, 0),

('K. OKAFOR', 7, 'WR', 'b1a3d5f7-9c2e-4b6a-8d1f-2e3c4b5a6d71',
 'Lightning-fast wide receiver with exceptional catching ability.',
 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&q=80',
 12, 1850, 0, 0),

('B. HASSAN', 24, 'RB', 'b1a3d5f7-9c2e-4b6a-8d1f-2e3c4b5a6d71',
 'Powerful running back known for breaking through defensive lines.',
 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400&q=80',
 15, 1920, 0, 0),

-- Abuja Vipers
('M. IBRAHIM', 3, 'QB', 'c2f4e6d8-1a3b-4c5d-9e7f-3a2b1c4d5e82',
 'Veteran quarterback with years of league experience.',
 'https://images.unsplash.com/photo-1541963058-d4c255efe471?w=400&q=80',
 14, 2100, 5, 0),

('A. CHUKWU', 88, 'DE', 'c2f4e6d8-1a3b-4c5d-9e7f-3a2b1c4d5e82',
 'Defensive powerhouse with incredible speed and agility.',
 'https://images.unsplash.com/photo-1511886929837-354d827aae26?w=400&q=80',
 2, 45, 0, 42),

-- Kano Pillars
('E. MUSA', 21, 'CB', 'd3e5f7a9-2b4c-4d6e-8f1a-4c3b2d5e6f93',
 'Elite cornerback with unmatched coverage skills.',
 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=400&q=80',
 1, 120, 8, 38),

('F. LAWAL', 10, 'WR', 'd3e5f7a9-2b4c-4d6e-8f1a-4c3b2d5e6f93',
 'Explosive wide receiver with great route-running ability.',
 'https://images.unsplash.com/photo-1546962339-5ff89552b8ed?w=400&q=80',
 9, 1450, 0, 0),

-- Enugu Rangers
('C. EZE', 1, 'QB', 'e4f6a8b1-3c5d-4e7f-9a2b-5d4c3e6f7a04',
 'Young promising quarterback with exceptional arm strength.',
 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&q=80',
 10, 1800, 4, 0),

('D. NWANKWO', 55, 'LB', 'e4f6a8b1-3c5d-4e7f-9a2b-5d4c3e6f7a04',
 'Veteran linebacker and team captain. Leads by example on and off the field.',
 'https://images.unsplash.com/photo-1511886929837-354d827aae26?w=400&q=80',
 0, 30, 2, 55);
