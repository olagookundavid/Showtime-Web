package dto

// LiveStatusResponse is the public answer to "should the homepage hero be a
// live stream right now?". Served to every visitor, signed-in or not.
type LiveStatusResponse struct {
	IsLive  bool   `json:"is_live"`
	IsVideo bool   `json:"is_video"`
	Mode    string `json:"mode,omitempty"`
	// VideoID and Title are only meaningful when IsLive or IsVideo is true.
	VideoID string `json:"video_id,omitempty"`
	Title   string `json:"title,omitempty"`
	// Source is "auto" (detected from the channel) or "manual" (an admin
	// override decided it).
	Source string `json:"source"`
}

// AdminLiveStatusResponse adds the stored override and what auto-detection
// currently sees, so the admin panel can show both.
type AdminLiveStatusResponse struct {
	LiveStatusResponse
	Mode            string `json:"mode"`
	OverrideVideoID string `json:"override_video_id"`
	OverrideTitle   string `json:"override_title"`
	DetectedLive    bool   `json:"detected_live"`
	DetectedVideoID string `json:"detected_video_id,omitempty"`
	DetectedTitle   string `json:"detected_title,omitempty"`
	ChannelHandle   string `json:"channel_handle"`
}

// UpdateLiveOverrideRequest sets who controls the hero. VideoID accepts any
// YouTube link shape or a bare id and is required when Mode is "on" or "video".
type UpdateLiveOverrideRequest struct {
	Mode    string `json:"mode" binding:"required,oneof=auto on off video"`
	VideoID string `json:"video_id"`
	Title   string `json:"title"`
}
