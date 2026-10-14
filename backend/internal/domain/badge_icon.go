package domain

import "time"

// BadgeIcon is one piece of artwork in the badge library. A badge shows an icon
// by storing its ImageURL; UsedBy lists the badges currently doing so.
type BadgeIcon struct {
	ID        string
	Name      string
	ImageURL  string
	UsedBy    []string // names of the badges using this artwork
	CreatedAt time.Time
	UpdatedAt time.Time
}
