package domain

import "time"

// Player of the Week fan poll statuses, derived from the clock — never stored.
const (
	POTWPollScheduled = "scheduled" // opens_at is still in the future
	POTWPollOpen      = "open"      // fans can vote
	POTWPollClosed    = "closed"    // deadline passed; results are public
)

// Who decided a poll's winner.
const (
	POTWWinnerByVote  = "VOTE"
	POTWWinnerByAdmin = "ADMIN"
)

// POTWMinNominees and POTWMaxNominees bound how many players an admin can put up
// for a vote.
const (
	POTWMinNominees = 2
	POTWMaxNominees = 5
)

// POTWPoll is the fan vote for one Team of the Week edition's Player of the Week.
type POTWPoll struct {
	ID             string
	TOTWID         string
	OpensAt        time.Time
	ClosesAt       time.Time
	FinalizedAt    *time.Time
	WinnerPlayerID *string
	WinnerSource   *string
	CreatedBy      *string
	CreatedAt      time.Time
	UpdatedAt      time.Time

	// Joined from the edition, for display.
	TOTWPublished   bool
	WeekTitle       string
	Headline        string
	CompetitionID   string
	CompetitionName string
	TOTWPOTWID      *string // the edition's current Player of the Week

	Nominees   []POTWNominee
	TotalVotes int
	VotesByDay []POTWDayCount
}

// Status reports where the poll is in its lifecycle at time now.
func (p *POTWPoll) Status(now time.Time) string {
	switch {
	case now.Before(p.OpensAt):
		return POTWPollScheduled
	case now.Before(p.ClosesAt):
		return POTWPollOpen
	default:
		return POTWPollClosed
	}
}

// POTWNominee is a nominated player with their Team of the Week line and vote count.
type POTWNominee struct {
	PlayerID     string
	DisplayOrder int
	Votes        int

	Name         string
	Image        string
	JerseyNumber int
	Position     string
	TeamName     string
	TeamLogo     string

	// From the edition's lineup; empty if the player has since been removed from it.
	TOTWPosition string
	Rating       float64
	Stat1Value   string
	Stat1Label   string
	Stat2Value   string
	Stat2Label   string
	Stat3Value   string
	Stat3Label   string
}

// POTWDayCount is how many votes were cast on one day, for the results breakdown.
type POTWDayCount struct {
	Day   time.Time
	Votes int
}

// PickPOTWWinner returns the nominee with the most votes. A tie goes to the higher
// Team of the Week rating, then to the earlier nominee in the admin's order. It
// returns "" when nobody voted, so an empty poll never crowns anyone.
func PickPOTWWinner(nominees []POTWNominee) string {
	best := -1
	for i, n := range nominees {
		if n.Votes == 0 {
			continue
		}
		if best < 0 {
			best = i
			continue
		}
		b := nominees[best]
		switch {
		case n.Votes > b.Votes,
			n.Votes == b.Votes && n.Rating > b.Rating,
			n.Votes == b.Votes && n.Rating == b.Rating && n.DisplayOrder < b.DisplayOrder:
			best = i
		}
	}
	if best < 0 {
		return ""
	}
	return nominees[best].PlayerID
}
