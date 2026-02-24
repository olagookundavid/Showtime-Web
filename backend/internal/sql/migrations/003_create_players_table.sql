-- +goose Up
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    jersey_number INT,
    position VARCHAR(50),
    team_id UUID REFERENCES teams(id),
    bio TEXT,
    image TEXT,
    touchdowns INT DEFAULT 0,
    yards INT DEFAULT 0,
    interceptions INT DEFAULT 0,
    tackles INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- +goose Down
DROP TABLE IF EXISTS players;
