package dto

// AppSettingsResponse is the site-wide configuration served to every client,
// signed-in or not. Only things every visitor or team head may know belong here.
type AppSettingsResponse struct {
	AppFontID string `json:"app_font_id"`
	// DefaultContractLength pre-fills the contract length when a team head makes an offer.
	DefaultContractLength int `json:"default_contract_length"`
}

// UpdateAppFontRequest carries the id of the font the admin picked. Only the id
// travels — the CSS font stack itself lives in the frontend catalogue, so a bad
// value can never reach a stylesheet.
type UpdateAppFontRequest struct {
	AppFontID string `json:"app_font_id" binding:"required"`
}

// ContractSettingsDTO mirrors domain.ContractSettings for the admin API.
type ContractSettingsDTO struct {
	DefaultLength    int `json:"default_length" binding:"required"`
	OnboardingLength int `json:"onboarding_length" binding:"required"`
	WarningMatches   int `json:"warning_matches" binding:"required"`
}

// SettingsUser is a person who can be picked to receive the league digest.
type SettingsUser struct {
	UserID string `json:"user_id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

type NotificationSettingsDTO struct {
	// TeamSummariesEnabled: managers get a summary when their players near expiry.
	TeamSummariesEnabled bool `json:"team_summaries_enabled"`
	// LeagueDigestEnabled: the weekly league-wide summary goes out.
	LeagueDigestEnabled bool `json:"league_digest_enabled"`
	// LeagueDigestRecipients are the people the weekly league summary goes to.
	LeagueDigestRecipients []SettingsUser `json:"league_digest_recipients"`
}

// UpdateNotificationSettingsRequest names recipients by user id only.
type UpdateNotificationSettingsRequest struct {
	TeamSummariesEnabled   bool     `json:"team_summaries_enabled"`
	LeagueDigestEnabled    bool     `json:"league_digest_enabled"`
	LeagueDigestRecipients []string `json:"league_digest_recipients"`
}

type FantasySettingsDTO struct {
	// PlatformCutPercent is the share of paid-league entry fees the platform keeps,
	// applied when a league settles.
	PlatformCutPercent float64 `json:"platform_cut_percent"`
}

// AdminSettingsResponse is everything the App Settings page edits.
type AdminSettingsResponse struct {
	Contracts     ContractSettingsDTO     `json:"contracts"`
	Notifications NotificationSettingsDTO `json:"notifications"`
	Fantasy       FantasySettingsDTO      `json:"fantasy"`
}
