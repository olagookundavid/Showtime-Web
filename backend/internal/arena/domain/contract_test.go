package domain

import (
	"errors"
	"testing"
	"time"
)

func TestContractTransitions(t *testing.T) {
	club := "club-1"

	if InitialStatus(nil) != ContractAwaitingPlayer || InitialStatus(&club) != ContractAwaitingRelease {
		t.Fatal("free agents go to the player, registered players need a release first")
	}

	all := []string{ContractAwaitingRelease, ContractAwaitingPlayer, ContractSigned, ContractRejected, ContractReleaseDeclined, ContractWithdrawn}
	type rule struct {
		name string
		fn   func(string) (string, error)
		from string
		to   string
	}
	rules := []rule{
		{"approve", ApproveRelease, ContractAwaitingRelease, ContractAwaitingPlayer},
		{"decline", DeclineRelease, ContractAwaitingRelease, ContractReleaseDeclined},
		{"reject", RejectOffer, ContractAwaitingPlayer, ContractRejected},
		{"sign", Sign, ContractAwaitingPlayer, ContractSigned},
	}
	for _, r := range rules {
		for _, s := range all {
			got, err := r.fn(s)
			if s == r.from {
				if err != nil || got != r.to {
					t.Errorf("%s from %s = %s, %v; want %s", r.name, s, got, err, r.to)
				}
			} else if !errors.Is(err, ErrBadTransition) || got != s {
				t.Errorf("%s from %s should be refused and leave the status alone, got %s, %v", r.name, s, got, err)
			}
		}
	}

	// A club can withdraw anything still open, and nothing that is final.
	for _, s := range all {
		got, err := Withdraw(s)
		if IsOpen(s) {
			if err != nil || got != ContractWithdrawn {
				t.Errorf("withdraw from %s = %s, %v", s, got, err)
			}
		} else if !errors.Is(err, ErrBadTransition) {
			t.Errorf("withdraw from final status %s should be refused", s)
		}
	}
}

func TestCheckSignature(t *testing.T) {
	if err := CheckSignature("  kaptain ", "Kaptain", true); err != nil {
		t.Errorf("case and spacing shouldn't matter: %v", err)
	}
	if err := CheckSignature("Kaptain", "Kaptain", false); !errors.Is(err, ErrConsentRequired) {
		t.Errorf("consent is required, got %v", err)
	}
	if err := CheckSignature("Someone Else", "Kaptain", true); !errors.Is(err, ErrBadSignature) {
		t.Errorf("wrong name should fail, got %v", err)
	}
}

func TestValidateTerms(t *testing.T) {
	today := time.Date(2026, 10, 20, 15, 0, 0, 0, Lagos)
	end := time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)
	good := ContractTerms{SquadRole: RoleFirstTeam, EndDate: time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC), FeeNGN: 5000, Terms: "Play on match nights."}

	if err := ValidateTerms(good, today, &end); err != nil {
		t.Fatalf("good terms rejected: %v", err)
	}
	if err := ValidateTerms(good, today, nil); err != nil {
		t.Fatalf("a season with no end date should still accept: %v", err)
	}

	bad := map[string]func(*ContractTerms){
		"bad role":     func(c *ContractTerms) { c.SquadRole = "captain" },
		"negative fee": func(c *ContractTerms) { c.FeeNGN = -1 },
		"huge fee":     func(c *ContractTerms) { c.FeeNGN = MaxFeeNGN + 1 },
		"no terms":     func(c *ContractTerms) { c.Terms = "   " },
		"terms too long": func(c *ContractTerms) {
			b := make([]byte, MaxTermsLen+1)
			for i := range b {
				b[i] = 'a'
			}
			c.Terms = string(b)
		},
		"ends yesterday":    func(c *ContractTerms) { c.EndDate = time.Date(2026, 10, 19, 0, 0, 0, 0, time.UTC) },
		"ends after season": func(c *ContractTerms) { c.EndDate = time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC) },
	}
	for name, mutate := range bad {
		c := good
		mutate(&c)
		if err := ValidateTerms(c, today, &end); !errors.Is(err, ErrBadContract) {
			t.Errorf("%s: want ErrBadContract, got %v", name, err)
		}
	}

	// Ending today is allowed.
	c := good
	c.EndDate = time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC)
	if err := ValidateTerms(c, today, &end); err != nil {
		t.Errorf("ending today should be fine: %v", err)
	}
}

func TestPickShirtNumber(t *testing.T) {
	if got := PickShirtNumber(9, map[int]bool{}); got != 9 {
		t.Errorf("free preferred number should be kept, got %d", got)
	}
	if got := PickShirtNumber(9, map[int]bool{9: true, 1: true, 2: true}); got != 3 {
		t.Errorf("taken preferred number falls back to the lowest free, got %d", got)
	}
	if got := PickShirtNumber(0, map[int]bool{}); got != 1 {
		t.Errorf("no preference gets 1, got %d", got)
	}
	full := map[int]bool{}
	for i := 1; i <= 99; i++ {
		full[i] = true
	}
	if got := PickShirtNumber(5, full); got != 0 {
		t.Errorf("a full club has no number, got %d", got)
	}
}
