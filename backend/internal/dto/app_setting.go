package dto

// AppSettingsResponse is the site-wide display configuration served to every
// client, signed-in or not.
type AppSettingsResponse struct {
	AppFontID string `json:"app_font_id"`
}

// UpdateAppFontRequest carries the id of the font the admin picked. Only the id
// travels — the CSS font stack itself lives in the frontend catalogue, so a bad
// value can never reach a stylesheet.
type UpdateAppFontRequest struct {
	AppFontID string `json:"app_font_id" binding:"required"`
}
