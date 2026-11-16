package tests_integration

import (
	"context"
	"fmt"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
)

func TestLeads_DedupeFilterAndConversion(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	repo := ports.NewLeadRepository(f.pool)

	suffix := fmt.Sprint(time.Now().UnixNano() % 1000000)
	mustExec(t, f.pool, `DELETE FROM leads WHERE email LIKE '%@leadfixture.test'`)
	t.Cleanup(func() { mustExec(t, f.pool, `DELETE FROM leads WHERE email LIKE '%@leadfixture.test'`) })

	ada := "ada" + suffix + "@leadfixture.test"
	bola := "bola" + suffix + "@leadfixture.test"

	first := &domain.Lead{Name: "Ada", Email: ada, Phone: "08031234567", Interests: []string{"watch"}, Source: "instagram"}
	if inserted, err := repo.Upsert(ctx, first); err != nil || !inserted {
		t.Fatalf("first submit: inserted=%v err=%v", inserted, err)
	}
	// Same email again from another link: refreshed, not duplicated, first source kept.
	again := &domain.Lead{Name: "Ada Obi", Email: ada, Phone: "08039999999", Interests: []string{"play"}, Source: "whatsapp"}
	if inserted, err := repo.Upsert(ctx, again); err != nil || inserted {
		t.Fatalf("second submit: inserted=%v err=%v", inserted, err)
	}
	if _, err := repo.Upsert(ctx, &domain.Lead{Name: "Bola", Email: bola, Phone: "08035550000", Interests: []string{"coaches"}, Source: "whatsapp"}); err != nil {
		t.Fatal(err)
	}

	got, total, err := repo.List(ctx, domain.LeadFilter{Search: suffix}, 1, 20)
	if err != nil || total != 2 || len(got) != 2 {
		t.Fatalf("list: total=%d len=%d err=%v", total, len(got), err)
	}
	var adaRow domain.Lead
	for _, l := range got {
		if l.Email == ada {
			adaRow = l
		}
	}
	if adaRow.Name != "Ada Obi" || adaRow.Phone != "08039999999" || adaRow.Source != "instagram" || len(adaRow.Interests) != 2 {
		t.Fatalf("ada not merged as expected: %+v", adaRow)
	}

	byInterest, _, _ := repo.List(ctx, domain.LeadFilter{Search: suffix, Interest: "coaches"}, 1, 20)
	if len(byInterest) != 1 || byInterest[0].Email != bola {
		t.Fatalf("interest filter: %+v", byInterest)
	}
	bySource, _, _ := repo.List(ctx, domain.LeadFilter{Search: suffix, Source: "instagram"}, 1, 20)
	if len(bySource) != 1 || bySource[0].Email != ada {
		t.Fatalf("source filter: %+v", bySource)
	}

	// Nobody has bought yet. Then Ada buys a ticket after joining.
	no := false
	if rows, _, _ := repo.List(ctx, domain.LeadFilter{Search: suffix, Converted: &no}, 1, 20); len(rows) != 2 {
		t.Fatalf("both should be unconverted, got %d", len(rows))
	}
	d := f.eventDay(t, "lead-1", "2090-07-01")
	comp := f.competition(t, "lead", "2090-07-01")
	p := f.product(t, "LEAD", 1000, 0, comp)
	pd := f.productDay(t, p, d)
	f.boughtOn(t, time.Now().AddDate(0, 0, 1).Format("2006-01-02"), p, ada, "", domain.TicketStatusPaid, 1000, pd)

	yes := true
	conv, _, _ := repo.List(ctx, domain.LeadFilter{Search: suffix, Converted: &yes}, 1, 20)
	if len(conv) != 1 || conv[0].Email != ada || !conv[0].Converted {
		t.Fatalf("converted filter: %+v", conv)
	}

	stats, err := repo.SourceStats(ctx)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, s := range stats {
		if s.Source == "instagram" && s.Leads >= 1 && s.Converted >= 1 {
			found = true
		}
	}
	if !found {
		t.Fatalf("instagram should show a lead that bought: %+v", stats)
	}
}
