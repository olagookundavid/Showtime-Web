package domain

import (
	"fmt"
	"strings"
	"time"
)

// ─── Scoring Engine Constants & Calculation ───────────────────────────────────

const FantasyScoringVersion = "FANTASY_SCORING_V1.0"

// FantasySlot defines allowable roster positions
type FantasySlot string

const (
	// Offense (7 Slots)
	SlotQBMale   FantasySlot = "QB_M"
	SlotQBFemale FantasySlot = "QB_F"
	SlotRec1     FantasySlot = "REC_1"
	SlotRec2     FantasySlot = "REC_2"
	SlotRec3     FantasySlot = "REC_3"
	SlotRec4     FantasySlot = "REC_4"
	SlotRec5     FantasySlot = "REC_5"

	// Defense (7 Slots)
	SlotRusher FantasySlot = "RUSHER"
	SlotDef1   FantasySlot = "DEF_1"
	SlotDef2   FantasySlot = "DEF_2"
	SlotDef3   FantasySlot = "DEF_3"
	SlotDef4   FantasySlot = "DEF_4"
	SlotDef5   FantasySlot = "DEF_5"
	SlotDef6   FantasySlot = "DEF_6"
)

// AllValidSlots lists all 14 required roster slots
var AllValidSlots = []FantasySlot{
	SlotQBMale, SlotQBFemale, SlotRec1, SlotRec2, SlotRec3, SlotRec4, SlotRec5,
	SlotRusher, SlotDef1, SlotDef2, SlotDef3, SlotDef4, SlotDef5, SlotDef6,
}

// FantasyUnit splits the roster into the two halves the gender quotas apply to.
type FantasyUnit string

const (
	UnitOffense FantasyUnit = "OFFENSE"
	UnitDefense FantasyUnit = "DEFENSE"
)

// SlotSpec is the single source of truth for what may occupy a roster slot.
// Both the API validation and the squad builder's filtering derive from this,
// so the two layers cannot drift apart.
type SlotSpec struct {
	Slot             FantasySlot `json:"slot"`
	Unit             FantasyUnit `json:"unit"`
	Label            string      `json:"label"`
	AllowedPositions []string    `json:"allowed_positions"`
	RequiredGender   string      `json:"required_gender,omitempty"` // "M", "F", or "" for either
}

// Receiver slots accept Centers: the rating engine scores a Center with the
// Receiver formula verbatim (see RateByPosition), so they are the same
// fantasy asset and a Center left unpickable would be off the board entirely.
var receiverPositions = []string{"Receiver", "Center"}

// SlotSpecs describes all 14 slots in roster order.
var SlotSpecs = []SlotSpec{
	{SlotQBMale, UnitOffense, "Male Starting QB", []string{"QB"}, "M"},
	{SlotQBFemale, UnitOffense, "Female Starting QB", []string{"QB"}, "F"},
	{SlotRec1, UnitOffense, "Wide Receiver 1", receiverPositions, ""},
	{SlotRec2, UnitOffense, "Wide Receiver 2", receiverPositions, ""},
	{SlotRec3, UnitOffense, "Wide Receiver 3", receiverPositions, ""},
	{SlotRec4, UnitOffense, "Wide Receiver 4", receiverPositions, ""},
	{SlotRec5, UnitOffense, "Wide Receiver 5", receiverPositions, ""},
	{SlotRusher, UnitDefense, "Pass Rusher", []string{"Rusher"}, ""},
	{SlotDef1, UnitDefense, "Defender 1", []string{"Defender"}, ""},
	{SlotDef2, UnitDefense, "Defender 2", []string{"Defender"}, ""},
	{SlotDef3, UnitDefense, "Defender 3", []string{"Defender"}, ""},
	{SlotDef4, UnitDefense, "Defender 4", []string{"Defender"}, ""},
	{SlotDef5, UnitDefense, "Defender 5", []string{"Defender"}, ""},
	{SlotDef6, UnitDefense, "Defender 6", []string{"Defender"}, ""},
}

var slotSpecIndex = func() map[FantasySlot]SlotSpec {
	m := make(map[FantasySlot]SlotSpec, len(SlotSpecs))
	for _, s := range SlotSpecs {
		m[s.Slot] = s
	}
	return m
}()

// SlotSpecFor returns the spec for a slot key, and whether the key is valid.
func SlotSpecFor(slot FantasySlot) (SlotSpec, bool) {
	s, ok := slotSpecIndex[slot]
	return s, ok
}

// NormalizeGender collapses the players.gender column ('M'/'F', possibly NULL
// or stray whitespace) to "M" or "F". Anything unrecognised reads as "M" so an
// unset gender can never silently satisfy a female quota.
func NormalizeGender(g string) string {
	if strings.EqualFold(strings.TrimSpace(g), "F") {
		return "F"
	}
	return "M"
}

// Accepts reports whether a player of this position/gender may fill the slot.
func (s SlotSpec) Accepts(position, gender string) bool {
	if s.RequiredGender != "" && NormalizeGender(gender) != s.RequiredGender {
		return false
	}
	for _, allowed := range s.AllowedPositions {
		if strings.EqualFold(strings.TrimSpace(position), allowed) {
			return true
		}
	}
	return false
}

// PositionsLabel renders a slot's eligible positions for an error message
// ("Receiver or Center").
func (s SlotSpec) PositionsLabel() string {
	switch len(s.AllowedPositions) {
	case 0:
		return ""
	case 1:
		return s.AllowedPositions[0]
	default:
		return strings.Join(s.AllowedPositions[:len(s.AllowedPositions)-1], ", ") +
			" or " + s.AllowedPositions[len(s.AllowedPositions)-1]
	}
}

// ─── Lineup Validation (pure) ─────────────────────────────────────────────────

// LineupCandidate is one resolved pick: the slot being filled plus the only
// player facts the rules care about, already loaded from the database.
type LineupCandidate struct {
	Slot     FantasySlot
	PlayerID string
	Name     string
	Position string
	Gender   string
	TeamID   string
	Price    float64
}

// LineupRules are the season's configurable squad constraints.
type LineupRules struct {
	Budget           float64
	MinFemaleOffense int
	MinFemaleDefense int
	MaxPerClub       int
}

// LineupTotals is the accounting ValidateLineup produces as a side benefit, so
// callers don't recompute it.
type LineupTotals struct {
	TotalSpent     float64
	OffenseFemales int
	DefenseFemales int
}

// ValidateLineup enforces every squad rule against a fully-resolved set of
// picks. It is deliberately pure — no database, no clock — so the rules can be
// exercised directly in tests and so the identical logic backs both the API and
// (mirrored) the squad builder.
func ValidateLineup(picks []LineupCandidate, rules LineupRules) (LineupTotals, error) {
	var totals LineupTotals

	if len(picks) != len(AllValidSlots) {
		return totals, fmt.Errorf("lineup must contain exactly %d slots, received %d", len(AllValidSlots), len(picks))
	}

	bySlot := make(map[FantasySlot]LineupCandidate, len(picks))
	seenPlayers := make(map[string]bool, len(picks))
	clubCounts := make(map[string]int)

	for _, p := range picks {
		spec, ok := SlotSpecFor(p.Slot)
		if !ok {
			return totals, fmt.Errorf("unknown roster slot: %s", p.Slot)
		}
		if _, dup := bySlot[p.Slot]; dup {
			return totals, fmt.Errorf("duplicate slot %s in submission", p.Slot)
		}
		bySlot[p.Slot] = p

		if seenPlayers[p.PlayerID] {
			return totals, fmt.Errorf("%s is selected in more than one slot", displayName(p))
		}
		seenPlayers[p.PlayerID] = true

		if !spec.Accepts(p.Position, p.Gender) {
			if spec.RequiredGender != "" {
				return totals, fmt.Errorf("slot %s must be a %s %s", p.Slot, genderWord(spec.RequiredGender), spec.PositionsLabel())
			}
			return totals, fmt.Errorf("slot %s must be a %s", p.Slot, spec.PositionsLabel())
		}

		if NormalizeGender(p.Gender) == "F" {
			if spec.Unit == UnitOffense {
				totals.OffenseFemales++
			} else {
				totals.DefenseFemales++
			}
		}

		if p.TeamID != "" {
			clubCounts[p.TeamID]++
		}
		totals.TotalSpent += p.Price
	}

	for _, required := range AllValidSlots {
		if _, ok := bySlot[required]; !ok {
			return totals, fmt.Errorf("missing required slot: %s", required)
		}
	}

	if rules.MaxPerClub > 0 {
		for _, count := range clubCounts {
			if count > rules.MaxPerClub {
				return totals, fmt.Errorf("no more than %d players may come from the same team", rules.MaxPerClub)
			}
		}
	}

	if totals.OffenseFemales < rules.MinFemaleOffense {
		return totals, fmt.Errorf("offensive unit requires at least %d female athletes, current: %d",
			rules.MinFemaleOffense, totals.OffenseFemales)
	}
	if totals.DefenseFemales < rules.MinFemaleDefense {
		return totals, fmt.Errorf("defensive unit requires at least %d female athletes, current: %d",
			rules.MinFemaleDefense, totals.DefenseFemales)
	}

	if rules.Budget > 0 && totals.TotalSpent > rules.Budget+budgetEpsilon {
		return totals, fmt.Errorf("lineup total cost %.2f SC exceeds budget of %.2f SC", totals.TotalSpent, rules.Budget)
	}

	return totals, nil
}

// budgetEpsilon absorbs float drift when summing NUMERIC(10,2) prices, so a
// squad costing exactly the budget can never be rejected by a rounding tail.
const budgetEpsilon = 0.0001

func displayName(p LineupCandidate) string {
	if p.Name != "" {
		return p.Name
	}
	return "player " + p.PlayerID
}

func genderWord(g string) string {
	if g == "F" {
		return "Female"
	}
	return "Male"
}

// FantasyWeights implements the official calibrated scoring rules.
type FantasyWeights struct{}

func (FantasyWeights) Calculate(s PlayerStat) FantasyPointsBreakdown {
	var b FantasyPointsBreakdown
	b.Version = FantasyScoringVersion

	// ── Offensive Points ──
	b.PassingYardsPts = float64(s.PassingYards) * 0.010                // +1 pt / 100 yds
	b.PassingTDsPts = float64(s.PassingTDs) * 2.000                    // +2.000
	b.InterceptionsThrownPts = float64(s.InterceptionsThrown) * -0.500 // -0.500
	b.QBSacksPts = float64(s.QBSacks) * -0.250                         // -0.250
	b.RushingYardsPts = float64(s.RushingYards) * 0.025                // +1 pt / 40 yds
	b.RushingTDsPts = float64(s.RushingTDs) * 2.000                    // +2.000
	b.ReceptionsPts = float64(s.Receptions) * 0.250                    // +0.250
	b.ReceivingYardsPts = float64(s.ReceivingYards) * 0.025            // +1 pt / 40 yds
	b.ReceivingTDsPts = float64(s.ReceivingTDs) * 2.000                // +2.000
	b.DropsPts = float64(s.Drops) * -0.250                             // -0.250
	b.XPGoodPts = float64(s.XPGood) * 0.250                            // +0.250
	b.ExtraPointTDsPts = float64(s.ExtraPointsTDs) * 0.250             // +0.250
	b.BadSnapsPts = float64(s.BadSnaps) * -0.250                       // -0.250

	b.OffensivePositive = b.PassingYardsPts + b.PassingTDsPts + b.RushingYardsPts +
		b.RushingTDsPts + b.ReceptionsPts + b.ReceivingYardsPts +
		b.ReceivingTDsPts + b.XPGoodPts + b.ExtraPointTDsPts

	b.OffensiveNegative = b.InterceptionsThrownPts + b.QBSacksPts +
		b.DropsPts + b.BadSnapsPts

	b.OffensiveTotal = b.OffensivePositive + b.OffensiveNegative

	// ── Defensive Points (Positive Only — Safeties Conceded = 0) ──
	b.FlagPullsPts = float64(s.FlagPulls) * 0.050             // 5 pulls = 0.250
	b.PassDeflectionsPts = float64(s.PassDeflections) * 0.250 // +0.250
	b.InterceptionsPts = float64(s.Interceptions) * 1.250     // +1.250
	b.DefSacksPts = float64(s.DefSacks) * 0.750               // +0.750
	b.DefensiveTDsPts = float64(s.DefensiveTDs) * 2.000       // +2.000 (pick-six = 1.25 + 2.0 = 3.25)
	b.DefensiveXPTDsPts = float64(s.DefensiveXPTDs) * 1.000   // +1.000
	b.SafetyPts = float64(s.Safety) * 1.250                   // +1.250
	b.SafetyConcededPts = 0.000                               // Zero weight per spec

	b.DefensiveTotal = b.FlagPullsPts + b.PassDeflectionsPts + b.InterceptionsPts +
		b.DefSacksPts + b.DefensiveTDsPts + b.DefensiveXPTDsPts + b.SafetyPts

	// ── Combined Net Total ──
	b.NetTotal = b.OffensiveTotal + b.DefensiveTotal
	return b
}

// SumBreakdowns folds per-match breakdowns into a single gameweek total. A
// player can appear in more than one fixture on an event day, and their
// gameweek score is the sum of all of them.
func SumBreakdowns(parts []FantasyPointsBreakdown) FantasyPointsBreakdown {
	var t FantasyPointsBreakdown
	t.Version = FantasyScoringVersion
	for _, b := range parts {
		t.PassingYardsPts += b.PassingYardsPts
		t.PassingTDsPts += b.PassingTDsPts
		t.InterceptionsThrownPts += b.InterceptionsThrownPts
		t.QBSacksPts += b.QBSacksPts
		t.RushingYardsPts += b.RushingYardsPts
		t.RushingTDsPts += b.RushingTDsPts
		t.ReceptionsPts += b.ReceptionsPts
		t.ReceivingYardsPts += b.ReceivingYardsPts
		t.ReceivingTDsPts += b.ReceivingTDsPts
		t.DropsPts += b.DropsPts
		t.XPGoodPts += b.XPGoodPts
		t.ExtraPointTDsPts += b.ExtraPointTDsPts
		t.BadSnapsPts += b.BadSnapsPts
		t.OffensivePositive += b.OffensivePositive
		t.OffensiveNegative += b.OffensiveNegative
		t.OffensiveTotal += b.OffensiveTotal
		t.FlagPullsPts += b.FlagPullsPts
		t.PassDeflectionsPts += b.PassDeflectionsPts
		t.InterceptionsPts += b.InterceptionsPts
		t.DefSacksPts += b.DefSacksPts
		t.DefensiveTDsPts += b.DefensiveTDsPts
		t.DefensiveXPTDsPts += b.DefensiveXPTDsPts
		t.SafetyPts += b.SafetyPts
		t.SafetyConcededPts += b.SafetyConcededPts
		t.DefensiveTotal += b.DefensiveTotal
		t.NetTotal += b.NetTotal
	}
	return t
}

type FantasyPointsBreakdown struct {
	Version string `json:"version"`

	// Offense
	PassingYardsPts        float64 `json:"passing_yards_pts"`
	PassingTDsPts          float64 `json:"passing_tds_pts"`
	InterceptionsThrownPts float64 `json:"interceptions_thrown_pts"`
	QBSacksPts             float64 `json:"qb_sacks_pts"`
	RushingYardsPts        float64 `json:"rushing_yards_pts"`
	RushingTDsPts          float64 `json:"rushing_tds_pts"`
	ReceptionsPts          float64 `json:"receptions_pts"`
	ReceivingYardsPts      float64 `json:"receiving_yards_pts"`
	ReceivingTDsPts        float64 `json:"receiving_tds_pts"`
	DropsPts               float64 `json:"drops_pts"`
	XPGoodPts              float64 `json:"xp_good_pts"`
	ExtraPointTDsPts       float64 `json:"extra_point_tds_pts"`
	BadSnapsPts            float64 `json:"bad_snaps_pts"`
	OffensivePositive      float64 `json:"offensive_positive"`
	OffensiveNegative      float64 `json:"offensive_negative"`
	OffensiveTotal         float64 `json:"offensive_total"`

	// Defense (Positive Only)
	FlagPullsPts       float64 `json:"flag_pulls_pts"`
	PassDeflectionsPts float64 `json:"pass_deflections_pts"`
	InterceptionsPts   float64 `json:"interceptions_pts"`
	DefSacksPts        float64 `json:"def_sacks_pts"`
	DefensiveTDsPts    float64 `json:"defensive_tds_pts"`
	DefensiveXPTDsPts  float64 `json:"defensive_xp_tds_pts"`
	SafetyPts          float64 `json:"safety_pts"`
	SafetyConcededPts  float64 `json:"safety_conceded_pts"`
	DefensiveTotal     float64 `json:"defensive_total"`

	NetTotal float64 `json:"net_total"`
}

// ─── Fantasy Season ───────────────────────────────────────────────────────────

type FantasySeasonStatus string

const (
	FantasySeasonDraft     FantasySeasonStatus = "DRAFT"
	FantasySeasonActive    FantasySeasonStatus = "ACTIVE"
	FantasySeasonCompleted FantasySeasonStatus = "COMPLETED"
)

type FantasySeason struct {
	ID               string              `json:"id"`
	CompetitionID    string              `json:"competition_id"`
	Name             string              `json:"name"`
	SquadSize        int                 `json:"squad_size"`         // 14
	Budget           float64             `json:"budget"`             // 230.00 SC
	MinFemaleOffense int                 `json:"min_female_offense"` // Default 3
	MinFemaleDefense int                 `json:"min_female_defense"` // Default 3
	MaxPerClub       int                 `json:"max_per_club"`       // Default 4
	LockMinsBefore   int                 `json:"lock_mins_before"`   // Default 15
	Status           FantasySeasonStatus `json:"status"`
	CreatedAt        time.Time           `json:"created_at"`
	UpdatedAt        time.Time           `json:"updated_at"`
}

// ─── Fantasy Gameweek ─────────────────────────────────────────────────────────

type GameweekStatus string

const (
	GameweekScheduled GameweekStatus = "SCHEDULED"
	GameweekLocked    GameweekStatus = "LOCKED"
	GameweekLive      GameweekStatus = "LIVE"
	GameweekFinalized GameweekStatus = "FINALIZED"
)

type FantasyGameweek struct {
	ID         string         `json:"id"`
	SeasonID   string         `json:"season_id"`
	Number     int            `json:"number"`
	EventDayID string         `json:"event_day_id"` // Links to existing event_days
	Deadline   time.Time      `json:"deadline"`     // Kickoff - lock_mins_before
	Status     GameweekStatus `json:"status"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
}

// ─── Dynamic Player Pricing ───────────────────────────────────────────────────

type FantasyPlayerPrice struct {
	ID         string    `json:"id"`
	SeasonID   string    `json:"season_id"`
	PlayerID   string    `json:"player_id"`
	GameweekID *string   `json:"gameweek_id,omitempty"` // NULL = opening price
	BasePrice  float64   `json:"base_price"`            // Default 10.00 SC
	Rating     float64   `json:"rating"`                // Snapshot of official rating (0-10, baseline 5.0)
	Price      float64   `json:"price"`                 // base_price * (rating / 5.0)
	CreatedAt  time.Time `json:"created_at"`
}

func CalculatePlayerPrice(basePrice, rating float64) float64 {
	if rating <= 0 {
		rating = 5.0
	}
	return basePrice * (rating / 5.0)
}

// ─── Fantasy Team (User Account Squad) ────────────────────────────────────────

type FantasyTeam struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	SeasonID    string    `json:"season_id"`
	Name        string    `json:"name"`
	TotalPoints float64   `json:"total_points"` // Running cumulative season score
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	CurrentLineup *FantasyLineup `json:"current_lineup,omitempty"`
}

// ─── Fantasy Lineup (Gameday Snapshot) ────────────────────────────────────────

type LineupStatus string

const (
	LineupDraft  LineupStatus = "DRAFT"
	LineupLocked LineupStatus = "LOCKED"
)

type FantasyLineup struct {
	ID         string              `json:"id"`
	TeamID     string              `json:"team_id"`
	GameweekID string              `json:"gameweek_id"`
	TotalSpent float64             `json:"total_spent"`
	Points     float64             `json:"points"`
	Status     LineupStatus        `json:"status"`
	LockedAt   *time.Time          `json:"locked_at,omitempty"`
	CreatedAt  time.Time           `json:"created_at"`
	UpdatedAt  time.Time           `json:"updated_at"`
	Picks      []FantasyLineupPick `json:"picks,omitempty"`
}

type FantasyLineupPick struct {
	ID            string      `json:"id"`
	LineupID      string      `json:"lineup_id"`
	PlayerID      string      `json:"player_id"`
	Slot          FantasySlot `json:"slot"`           // QB_M, QB_F, REC_1..5, RUSHER, DEF_1..6
	PurchasePrice float64     `json:"purchase_price"` // Price at time of lock
	Points        float64     `json:"points"`         // Points scored by player in this GW
	CreatedAt     time.Time   `json:"created_at"`

	Player *Player `json:"player,omitempty"`
}

// ─── Fantasy Gameweek Points Log ──────────────────────────────────────────────

type FantasyGWPoints struct {
	ID         string                 `json:"id"`
	TeamID     string                 `json:"team_id"`
	GameweekID string                 `json:"gameweek_id"`
	PlayerID   string                 `json:"player_id"`
	MatchID    string                 `json:"match_id"`
	Points     float64                `json:"points"`
	Breakdown  FantasyPointsBreakdown `json:"breakdown"`
	CreatedAt  time.Time              `json:"created_at"`
}

// ─── Fantasy Leagues ──────────────────────────────────────────────────────────

type FantasyLeagueType string

const (
	LeagueTypeOverall FantasyLeagueType = "OVERALL"
	LeagueTypePublic  FantasyLeagueType = "PUBLIC"
	LeagueTypePrivate FantasyLeagueType = "PRIVATE"
)

type FantasyLeaguePaymentStatus string

const (
	LeaguePaymentFree    FantasyLeaguePaymentStatus = "FREE"
	LeaguePaymentPending FantasyLeaguePaymentStatus = "PENDING"
	LeaguePaymentPaid    FantasyLeaguePaymentStatus = "PAID"
	LeaguePaymentFailed  FantasyLeaguePaymentStatus = "FAILED"
)

type FantasyLeague struct {
	ID              string            `json:"id"`
	SeasonID        string            `json:"season_id"`
	Name            string            `json:"name"`
	Type            FantasyLeagueType `json:"type"`
	InviteCode      *string           `json:"invite_code,omitempty"`
	CreatedByUserID *string           `json:"created_by_user_id,omitempty"` // nil for the system-owned OVERALL league
	MemberCount     int               `json:"member_count"`
	EntryFee        int               `json:"entry_fee"`   // In kobo (₦ × 100); 0 = free
	MaxMembers      int               `json:"max_members"` // 0 = unlimited
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`

	// Settlement bookkeeping, written once when prize money is distributed.
	// SettledAt being non-nil is the guard that stops a league paying out twice.
	GrossEntryKobo  int64      `json:"gross_entry_kobo"`
	PlatformCutKobo int64      `json:"platform_cut_kobo"`
	PrizePoolKobo   int64      `json:"prize_pool_kobo"`
	SettledAt       *time.Time `json:"settled_at,omitempty"`
}

type FantasyLeagueMember struct {
	ID                 string                     `json:"id"`
	LeagueID           string                     `json:"league_id"`
	UserID             string                     `json:"user_id"`
	TeamID             string                     `json:"team_id"`
	PaymentStatus      FantasyLeaguePaymentStatus `json:"payment_status"`
	PaystackReference  *string                    `json:"paystack_reference,omitempty"`
	PaystackAccessCode *string                    `json:"paystack_access_code,omitempty"`
	JoinedAt           time.Time                  `json:"joined_at"`

	User *User        `json:"user,omitempty"`
	Team *FantasyTeam `json:"team,omitempty"`
}
