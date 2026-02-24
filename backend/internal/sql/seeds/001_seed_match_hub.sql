TRUNCATE TABLE standings, matches, teams, competitions CASCADE;

-- =========================
-- Competitions
-- =========================
INSERT INTO competitions (id, name, logo) VALUES 
('8f3c2e91-6b7d-4a1a-9c3e-2f4b5d6e7a81', 'Showtime Ball', 'https://via.placeholder.com/100?text=SB'),
('3d9a7f44-1c2b-4f5e-b8c1-9a6d2e3f4b77', 'Showtime Playoff', 'https://via.placeholder.com/100?text=SP');

-- =========================
-- Teams
-- =========================
INSERT INTO teams (id, name, short_name, logo) VALUES
('b1a3d5f7-9c2e-4b6a-8d1f-2e3c4b5a6d71', 'Lagos Hurricanes', 'HUR', 'https://via.placeholder.com/60?text=HUR'),
('c2f4e6d8-1a3b-4c5d-9e7f-3a2b1c4d5e82', 'Abuja Vipers', 'VIP', 'https://via.placeholder.com/60?text=VIP'),
('d3e5f7a9-2b4c-4d6e-8f1a-4c3b2d5e6f93', 'Kano Pillars', 'PIL', 'https://via.placeholder.com/60?text=PIL'),
('e4f6a8b1-3c5d-4e7f-9a2b-5d4c3e6f7a04', 'Enugu Rangers', 'RAN', 'https://via.placeholder.com/60?text=RAN');

-- =========================
-- Matches (Finished)
-- =========================
INSERT INTO matches 
(competition_id, home_team_id, away_team_id, date, time, venue, status, home_score, away_score)
VALUES
(
 '8f3c2e91-6b7d-4a1a-9c3e-2f4b5d6e7a81',
 'b1a3d5f7-9c2e-4b6a-8d1f-2e3c4b5a6d71',
 'c2f4e6d8-1a3b-4c5d-9e7f-3a2b1c4d5e82',
 '2023-10-01',
 '16:00:00',
 'Showtime Arena',
 'FINISHED',
 2,
 1
),
(
 '8f3c2e91-6b7d-4a1a-9c3e-2f4b5d6e7a81',
 'd3e5f7a9-2b4c-4d6e-8f1a-4c3b2d5e6f93',
 'e4f6a8b1-3c5d-4e7f-9a2b-5d4c3e6f7a04',
 '2023-10-01',
 '18:00:00',
 'Showtime Arena',
 'FINISHED',
 0,
 0
);

-- =========================
-- Matches (Live)
-- =========================
INSERT INTO matches
(competition_id, home_team_id, away_team_id, date, time, venue, status, home_score, away_score)
VALUES
(
 '8f3c2e91-6b7d-4a1a-9c3e-2f4b5d6e7a81',
 'b1a3d5f7-9c2e-4b6a-8d1f-2e3c4b5a6d71',
 'd3e5f7a9-2b4c-4d6e-8f1a-4c3b2d5e6f93',
 CURRENT_DATE,
 CURRENT_TIME,
 'Showtime Arena',
 'LIVE',
 1,
 0
);

-- =========================
-- Matches (Upcoming)
-- =========================
INSERT INTO matches
(competition_id, home_team_id, away_team_id, date, time, venue, status)
VALUES
(
 '8f3c2e91-6b7d-4a1a-9c3e-2f4b5d6e7a81',
 'c2f4e6d8-1a3b-4c5d-9e7f-3a2b1c4d5e82',
 'e4f6a8b1-3c5d-4e7f-9a2b-5d4c3e6f7a04',
 CURRENT_DATE + INTERVAL '1 day',
 CURRENT_TIME,
 'Showtime Arena',
 'SCHEDULED'
),
(
 '3d9a7f44-1c2b-4f5e-b8c1-9a6d2e3f4b77',
 'b1a3d5f7-9c2e-4b6a-8d1f-2e3c4b5a6d71',
 'e4f6a8b1-3c5d-4e7f-9a2b-5d4c3e6f7a04',
 CURRENT_DATE + INTERVAL '7 day',
 CURRENT_TIME,
 'Showtime Arena - Playoff',
 'SCHEDULED'
);

-- =========================
-- Standings (Showtime Ball)
-- =========================
INSERT INTO standings
(competition_id, team_id, position, played, won, drawn, lost, goals_for, goals_against, points)
VALUES
('8f3c2e91-6b7d-4a1a-9c3e-2f4b5d6e7a81','b1a3d5f7-9c2e-4b6a-8d1f-2e3c4b5a6d71',1,2,2,0,0,3,1,6),
('8f3c2e91-6b7d-4a1a-9c3e-2f4b5d6e7a81','e4f6a8b1-3c5d-4e7f-9a2b-5d4c3e6f7a04',2,1,0,1,0,0,0,1),
('8f3c2e91-6b7d-4a1a-9c3e-2f4b5d6e7a81','d3e5f7a9-2b4c-4d6e-8f1a-4c3b2d5e6f93',3,2,0,1,1,0,1,1),
('8f3c2e91-6b7d-4a1a-9c3e-2f4b5d6e7a81','c2f4e6d8-1a3b-4c5d-9e7f-3a2b1c4d5e82',4,1,0,0,1,1,2,0);
