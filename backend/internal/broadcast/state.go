package broadcast

// BroadcastState represents the complete live state of a match's on-air broadcast overlay.
type BroadcastState struct {
	MatchID      string        `json:"match_id"`
	Home         string        `json:"home"`
	Away         string        `json:"away"`
	HomeShort    string        `json:"home_short"`
	AwayShort    string        `json:"away_short"`
	HomeLogo     string        `json:"home_logo"`
	AwayLogo     string        `json:"away_logo"`
	ManualHome   int           `json:"manual_home"`
	ManualAway   int           `json:"manual_away"`
	PBPHome      int           `json:"pbp_home"`
	PBPAway      int           `json:"pbp_away"`
	Period       string        `json:"period"`
	ClockSeconds int           `json:"clock_seconds"`
	ClockRunning bool          `json:"clock_running"`
	ClockStamp   int64         `json:"clock_stamp"` // Unix milliseconds when clock was set/started
	Down         string        `json:"down"`
	Possession   string        `json:"possession"`
	TimeoutsHome int           `json:"timeouts_home"`
	TimeoutsAway int           `json:"timeouts_away"`
	ScoreBug     bool          `json:"scorebug"`
	Graphic      *GraphicEvent `json:"graphic"`
	GraphicID    int           `json:"graphic_id"`
	UpdatedAt    int64         `json:"updated_at"`

	// Scene is the full-screen scene on air: "" (none), "opening", "facts",
	// "standings" or "lineup". It shows on the scenes layer and the combined one.
	Scene string `json:"scene"`
	// LineupAttack is the side shown attacking on the lineup scene: "home" or "away".
	LineupAttack string `json:"lineup_attack"`
	// LineupIntro drives the starting-lineup introductions; nil when not running.
	LineupIntro *LineupIntro `json:"lineup_intro"`
}

// LineupIntro is the starting-lineup introductions sequence. Starters are
// introduced one at a time in a fixed order; every overlay derives the same
// picture from Cursor, so separate vMix inputs stay in step.
type LineupIntro struct {
	// Cursor is how many starters have been introduced and placed; the starter
	// at Cursor is the one being introduced now.
	Cursor int `json:"cursor"`
}

// GraphicEvent defines an active lower-third banner displayed on screen.
type GraphicEvent struct {
	Type     string `json:"type"` // TOUCHDOWN, FIRST DOWN, SACK, PENALTY, etc.
	Number   string `json:"number,omitempty"`
	Player   string `json:"player,omitempty"`
	Team     string `json:"team,omitempty"`
	Stat     string `json:"stat,omitempty"`
	Photo    string `json:"photo,omitempty"`
	Compact  bool   `json:"compact"`
	Large    bool   `json:"large,omitempty"` // show the big breakout player portrait instead of the small avatar circle
	Duration int    `json:"duration"`        // Display duration in ms (default 5500)
}

// BroadcastPlayer represents a player available for broadcast graphic assignment.
type BroadcastPlayer struct {
	PlayerID     string `json:"player_id"`
	Name         string `json:"name"`
	JerseyNumber int    `json:"jersey_number"`
	Position     string `json:"position"`
	TeamID       string `json:"team_id"`
	TeamName     string `json:"team_name"`
	Image        string `json:"image"`
}
