package domain

import "time"

// Lead interests, as the join form offers them.
const (
	LeadInterestWatch   = "watch"
	LeadInterestCoaches = "coaches"
	LeadInterestPlay    = "play"
)

// LeadInterests is every interest a lead can pick, in the order the form shows them.
var LeadInterests = []string{LeadInterestWatch, LeadInterestCoaches, LeadInterestPlay}

// Lead is a prospective fan or player who asked to hear from Showtime.
type Lead struct {
	ID          string
	Name        string
	Email       string
	Phone       string
	Interests   []string
	Source      string
	ConsentedAt time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
	// Converted is true when the lead has paid for a ticket since joining.
	Converted bool
}

// LeadFilter narrows the admin list and the CSV export.
type LeadFilter struct {
	Search    string
	Source    string
	Interest  string
	Converted *bool
}

// LeadSourceStat is one channel's leads and how many of them went on to buy.
type LeadSourceStat struct {
	Source    string
	Leads     int
	Converted int
}
