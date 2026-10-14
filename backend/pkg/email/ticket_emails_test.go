package email

import (
	"strings"
	"testing"
)

func TestPurchaseEmailListsEveryDayOfAGamePass(t *testing.T) {
	html := PurchaseEmailHTML(PurchaseEmailData{
		BuyerName:   "Ada",
		ProductName: "VIP",
		TicketCode:  "SFFL-ABCD1234",
		Quantity:    1,
		TotalAmount: 16200,
		IsGamePass:  true,
		Days: []TicketEmailDay{
			{Title: "Game Day 1", Date: "Sat, Nov 07 2026", Venue: "Showtime Arena"},
			{Title: "Game Day 2", Date: "Sat, Nov 14 2026", Venue: "Showtime Arena"},
			{Title: "Game Day 3", Date: "Sat, Nov 21 2026", Venue: "Showtime Arena"},
		},
	})
	for _, want := range []string{
		"Game Pass Confirmed!", "Game Day 1", "Game Day 2", "Game Day 3",
		"Match Day 1", "Match Day 3", "SFFL-ABCD1234", "₦16,200", "covers 3 match days",
	} {
		if !strings.Contains(html, want) {
			t.Errorf("game pass email is missing %q", want)
		}
	}
	// One code covers the whole pass, so it must appear once.
	if n := strings.Count(html, "SFFL-ABCD1234"); n != 1 {
		t.Errorf("the ticket code should appear once, got %d", n)
	}
}

func TestPurchaseEmailForASingleTicket(t *testing.T) {
	html := PurchaseEmailHTML(PurchaseEmailData{
		BuyerName: "Bayo", ProductName: "Regular", TicketCode: "SFFL-ZZZZ9999", Quantity: 2, TotalAmount: 6000,
		Days: []TicketEmailDay{{Title: "Game Day 1", Date: "Sat, Nov 07 2026", Venue: "Arena"}},
	})
	if !strings.Contains(html, "Ticket Confirmed!") || strings.Contains(html, "Game Pass Confirmed!") {
		t.Error("a single ticket should read as a ticket, not a Game Pass")
	}
	if !strings.Contains(html, "2 tickets") {
		t.Error("the quantity should be shown")
	}
}

func TestPurchaseEmailEscapesBuyerAndEventText(t *testing.T) {
	html := PurchaseEmailHTML(PurchaseEmailData{
		BuyerName: `<script>alert(1)</script>`, ProductName: "VIP", TicketCode: "X", Quantity: 1,
		Days: []TicketEmailDay{{Title: `<b>Day</b>`, Date: "d", Venue: "v"}},
	})
	if strings.Contains(html, "<script>alert(1)</script>") || strings.Contains(html, "<b>Day</b>") {
		t.Error("user-supplied text must be HTML-escaped")
	}
}

func TestPurchaseEmailOmitsPhoneWhenNotGiven(t *testing.T) {
	with := PurchaseEmailHTML(PurchaseEmailData{BuyerName: "A", Phone: "0801", TicketCode: "X", Quantity: 1, Days: []TicketEmailDay{{Title: "D"}}})
	without := PurchaseEmailHTML(PurchaseEmailData{BuyerName: "A", Phone: "N/A", TicketCode: "X", Quantity: 1, Days: []TicketEmailDay{{Title: "D"}}})
	if !strings.Contains(with, "0801") {
		t.Error("a phone number should be shown")
	}
	if strings.Contains(without, "Phone Number") {
		t.Error("a missing phone should not leave an empty row")
	}
}

func TestReminderEmailSaysWhereTheDaySitsInAPass(t *testing.T) {
	html := DayReminderEmailHTML(ReminderEmailData{
		BuyerName: "Ada", ProductName: "VIP", TicketCode: "SFFL-ABCD1234", Quantity: 2,
		Day:       TicketEmailDay{Title: "Game Day 2", Date: "Sat, Nov 14 2026", Venue: "Showtime Arena"},
		TotalDays: 3, DayNumber: 2,
	})
	for _, want := range []string{"Day 2 of 3 on your Game Pass", "Game Day 2", "SFFL-ABCD1234", "Admits", "2 tickets"} {
		if !strings.Contains(html, want) {
			t.Errorf("reminder is missing %q", want)
		}
	}

	single := DayReminderEmailHTML(ReminderEmailData{BuyerName: "B", Day: TicketEmailDay{Title: "D"}, TicketCode: "X", Quantity: 1})
	if strings.Contains(single, "of 0") || strings.Contains(single, "Game Pass") {
		t.Error("a single-ticket reminder should not mention a Game Pass")
	}
}
