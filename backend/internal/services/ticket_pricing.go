package services

import (
	"math"
	"sync"
	"time"

	"showtime-backend/internal/domain"
)

// TicketPricing is what a selection costs before any discount code.
type TicketPricing struct {
	// UnitPrice is what one person pays for every day, before discounts.
	UnitPrice int
	Subtotal  int
	// GamePassPercent is the ladder rung that applied (0 when none did).
	GamePassPercent float64
	GamePassAmount  int
	// Total is Subtotal less the Game Pass discount.
	Total int
}

// gamePassPercent returns the discount for a pass covering days days: the active
// rule with the highest min_days the selection reaches. No rule reached means 0.
func gamePassPercent(days int, rules []domain.GamePassRule) float64 {
	best := 0
	percent := 0.0
	for _, r := range rules {
		if !r.IsActive || r.MinDays > days {
			continue
		}
		if r.MinDays > best {
			best = r.MinDays
			percent = r.PercentOff
		}
	}
	return percent
}

// PriceTicket prices a selection from the per-day prices. Every purchase is a Game
// Pass, so the ladder applies to it by the number of days chosen; one day reaches
// no rung and pays full price. The discount is rounded to whole naira (half up)
// because Paystack amounts and the ticket total are integers.
func PriceTicket(dayPrices []int, quantity int, rules []domain.GamePassRule) TicketPricing {
	unit := 0
	for _, p := range dayPrices {
		unit += p
	}
	p := TicketPricing{UnitPrice: unit, Subtotal: unit * quantity}
	p.GamePassPercent = gamePassPercent(len(dayPrices), rules)
	p.GamePassAmount = int(math.Round(float64(p.Subtotal) * p.GamePassPercent / 100))
	p.Total = p.Subtotal - p.GamePassAmount
	if p.Total < 0 {
		p.Total = 0
	}
	return p
}

var (
	lagosOnce sync.Once
	lagosLoc  *time.Location
)

// lagos is the league's time zone. Match days are plain dates, so what "today" or
// "9am the day before" means has to be pinned to where the games are played. West
// Africa Time has no daylight saving, so a fixed zone is a safe fallback when the
// tz database is not installed.
func lagos() *time.Location {
	lagosOnce.Do(func() {
		loc, err := time.LoadLocation("Africa/Lagos")
		if err != nil {
			loc = time.FixedZone("WAT", 3600)
		}
		lagosLoc = loc
	})
	return lagosLoc
}

// dateOnly reduces a stored match-day date to a comparable calendar day.
func dateOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// todayLagos is today's calendar date in Lagos, as a date-only value.
func todayLagos(now time.Time) time.Time {
	n := now.In(lagos())
	return time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, time.UTC)
}
