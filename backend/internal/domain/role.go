package domain

import "time"

// AccessLevel is how much a role can do on one admin feature. The zero value is
// no access, which is also what a missing role_permissions row means.
type AccessLevel string

const (
	AccessNone AccessLevel = ""
	AccessView AccessLevel = "view" // GET only
	AccessFull AccessLevel = "full"
)

// Rank orders levels so "at least this much" is a comparison.
func (l AccessLevel) Rank() int {
	switch l {
	case AccessFull:
		return 2
	case AccessView:
		return 1
	default:
		return 0
	}
}

func (l AccessLevel) Valid() bool { return l == AccessView || l == AccessFull }

// FeatureDef is one thing in the admin panel a role can be given access to. The
// catalog lives in code because a route has to name the feature it belongs to;
// which roles hold it lives in the database.
type FeatureDef struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Group       string `json:"group"`
	Description string `json:"description"`
	// AdminPanel marks features that open the admin panel. A role holding any of
	// them is "staff" and may reach /admin; seller_tools belongs to the seller
	// portal and doesn't count.
	AdminPanel bool `json:"-"`
}

const (
	FeatureDashboard          = "dashboard"
	FeatureUserManagement     = "user_management"
	FeatureCompetitions       = "competitions"
	FeatureTeamsStandings     = "teams_standings"
	FeatureMatches            = "matches"
	FeaturePlayByPlay         = "play_by_play"
	FeaturePlayByPlayCommit   = "play_by_play_commit"
	FeaturePlayByPlayLock     = "play_by_play_lock"
	FeatureBroadcastStudio    = "broadcast_studio"
	FeatureStatsEdit          = "stats_edit"
	FeaturePlayers            = "players"
	FeatureTOTW               = "totw"
	FeatureBadges             = "badges"
	FeatureFantasy            = "fantasy"
	FeatureClaims             = "claims"
	FeatureContracts          = "contracts"
	FeatureTransfers          = "transfers"
	FeatureTransferWindows    = "transfer_windows"
	FeatureTeamBudgets        = "team_budgets"
	FeatureTeamPortal         = "team_portal"
	FeatureTickets            = "tickets"
	FeatureReferrals          = "referrals"
	FeatureEventDays          = "event_days"
	FeatureStore              = "store"
	FeatureInventory          = "inventory"
	FeatureNews               = "news"
	FeatureHeroSlides         = "hero_slides"
	FeatureLiveStream         = "live_stream"
	FeatureSeasonMVPs         = "season_mvps"
	FeatureAppSettings        = "app_settings"
	FeatureCommentModeration  = "comment_moderation"
	FeatureRoles              = "roles"
	FeatureSellerTools        = "seller_tools"
	FeatureAdministratorTools = "administrator_tools"
)

// FeatureCatalog is every feature a role can be given, in display order.
var FeatureCatalog = []FeatureDef{
	{FeatureDashboard, "Dashboard & analytics", "Overview", "Revenue, traffic and league analytics.", true},

	{FeatureCompetitions, "Competitions", "League", "Create and manage competitions and cups.", true},
	{FeatureTeamsStandings, "Teams & standings", "League", "Teams, their details and the league table.", true},
	{FeatureMatches, "Matches", "League", "Fixtures, scores and match details.", true},
	{FeaturePlayByPlay, "Play-by-play", "League", "Log plays and statistics during a match.", true},
	{FeaturePlayByPlayCommit, "Commit play-by-play", "League", "Commit the final score and stats from the play log.", true},
	{FeaturePlayByPlayLock, "Lock play-by-play", "League", "Lock or unlock a match's play log against further edits.", true},
	{FeatureBroadcastStudio, "Broadcast studio", "League", "Run the on-air scoreboard and graphics.", true},
	{FeatureStatsEdit, "Edit stats", "League", "Correct player and team statistics.", true},
	{FeatureSeasonMVPs, "Season MVPs", "League", "Season awards.", true},
	{FeatureEventDays, "Event days", "League", "Match days and their schedule.", true},

	{FeaturePlayers, "Players", "Players", "Player profiles and records.", true},
	{FeatureTOTW, "Team of the week", "Players", "Pick the team and player of the week.", true},
	{FeatureBadges, "Badges", "Players", "Player badges.", true},
	{FeatureClaims, "Account claims", "Players", "Approve or reject players claiming their profile.", true},
	{FeatureContracts, "Contracts", "Players", "Oversee every team's player contracts.", true},
	{FeatureTransfers, "Transfers", "Players", "Oversee every team's transfers.", true},
	{FeatureTransferWindows, "Transfer windows", "Players", "Open and close transfer windows.", true},
	{FeatureTeamBudgets, "Team budgets", "Players", "Team salary budgets.", true},
	{FeatureTeamPortal, "Act as any team head", "Players", "Use the team-head portal for any team, not just your own.", true},
	{FeatureFantasy, "Fantasy", "Players", "Run the fantasy game.", true},

	{FeatureTickets, "Tickets", "Ticketing", "Sell and manage tickets.", true},
	{FeatureReferrals, "Referrals", "Ticketing", "Referral codes and their payouts.", true},

	{FeatureStore, "Store", "Store", "Products, orders and discount codes.", true},
	{FeatureInventory, "Inventory", "Store", "Stock levels.", true},
	{FeatureSellerTools, "Seller tools", "Store", "The seller portal.", false},

	{FeatureNews, "News", "Content", "Publish and edit news.", true},
	{FeatureHeroSlides, "Hero slides", "Content", "The homepage banner slides.", true},
	{FeatureLiveStream, "Live stream", "Content", "The live stream and replays.", true},
	{FeatureCommentModeration, "Moderate comments", "Content", "Delete other people's comments.", true},

	{FeatureUserManagement, "Users", "System", "View users and change their role.", true},
	{FeatureRoles, "Roles & permissions", "System", "Create roles and decide what each can do.", true},
	{FeatureAppSettings, "App settings", "System", "Site-wide settings.", true},
	{FeatureAdministratorTools, "Administrator tools", "System", "Superuser-only tools. Only App Admin has these.", true},
}

var featureIndex = func() map[string]FeatureDef {
	m := make(map[string]FeatureDef, len(FeatureCatalog))
	for _, f := range FeatureCatalog {
		m[f.Key] = f
	}
	return m
}()

// FeatureByKey reports whether key is a feature in the catalog.
func FeatureByKey(key string) (FeatureDef, bool) {
	f, ok := featureIndex[key]
	return f, ok
}

// Role is a named bundle of feature access that can be given to a user.
type Role struct {
	Key         string                 `json:"key"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	IsSystem    bool                   `json:"is_system"`
	Permissions map[string]AccessLevel `json:"permissions"`
	UserCount   int                    `json:"user_count"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}
