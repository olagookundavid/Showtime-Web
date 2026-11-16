package dto

// JoinRequest is what the public join form sends.
type JoinRequest struct {
	Name      string   `json:"name"`
	Email     string   `json:"email"`
	Phone     string   `json:"phone"`
	Interests []string `json:"interests"`
	// Source is the channel's tag from the link (?src=instagram).
	Source  string `json:"source"`
	Consent bool   `json:"consent"`
	// Website is a hidden field real visitors never see. A bot that fills it is
	// quietly ignored.
	Website string `json:"website"`
}

type LeadResponse struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Email        string   `json:"email"`
	Phone        string   `json:"phone"`
	Interests    []string `json:"interests"`
	Source       string   `json:"source"`
	CreatedAt    string   `json:"created_at"`
	BoughtTicket bool     `json:"bought_ticket"`
}

type LeadSourceStat struct {
	Source    string `json:"source"`
	Leads     int    `json:"leads"`
	Converted int    `json:"converted"`
}

type LeadSummary struct {
	Total     int              `json:"total"`
	Converted int              `json:"converted"`
	Sources   []LeadSourceStat `json:"sources"`
}
