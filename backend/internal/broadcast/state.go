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

	// Scene is the full-screen scene on air: "" (none), "opening", "attack",
	// "defence", "standings" or "lineup" ("facts", from before the stats were
	// split, shows as "attack"). It shows on the scenes layer and the combined one.
	Scene string `json:"scene"`
	// ShowKickoff puts the scheduled kickoff time on the opening matchup. Off
	// by default: matches rarely start at the time on the fixture list.
	ShowKickoff bool `json:"show_kickoff"`
	// LineupTeam is the team whose starting lineup is shown: "home" or "away".
	// The lineup is one team at a time: its offence, its defence and its bench.
	LineupTeam string `json:"lineup_team"`
	// LineupIntro drives the starting-lineup introductions; nil when not running.
	LineupIntro *LineupIntro `json:"lineup_intro"`
}

// LineupIntro is the starting-lineup introductions sequence for the team
// shown: its offence, then its defence, one player at a time, then its bench
// as a whole. Every overlay derives the same picture from Cursor, so separate
// vMix inputs stay in step.
type LineupIntro struct {
	// Cursor is the step being introduced: each starter in turn, then the
	// bench; past the last step the full lineup shows.
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
