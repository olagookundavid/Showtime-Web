-- Add tie_breaker_rule column to competitions
-- Values: 'PCT_PD_PF_PA_NAME' (Rule 1: Win % -> Point Diff -> Points For -> Points Against -> Name)
--         'H2H_PCT_PD_PF_PA_NAME' (Rule 2: Head-to-Head -> Win % -> Point Diff -> Points For -> Points Against -> Name)
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS tie_breaker_rule VARCHAR(50) DEFAULT 'PCT_PD_PF_PA_NAME';
