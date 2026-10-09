package domain

import (
	"strings"
	"testing"
)

func intPtr(n int) *int { return &n }

// seededBands mirrors the migration seed: 2–3 → 5%, 4–5 → 10%, 6+ → 15%.
func seededBands() []GamePassDiscountBand {
	return []GamePassDiscountBand{
		{ID: "a", MinGamedays: 2, MaxGamedays: intPtr(3), DiscountPercent: 5, IsActive: true},
		{ID: "b", MinGamedays: 4, MaxGamedays: intPtr(5), DiscountPercent: 10, IsActive: true},
		{ID: "c", MinGamedays: 6, MaxGamedays: nil, DiscountPercent: 15, IsActive: true},
	}
}

func TestDiscountBandCovers(t *testing.T) {
	bands := seededBands()
	cases := []struct {
		n    int
		want string // ID of the covering band, "" for none
	}{
		{1, ""}, {2, "a"}, {3, "a"}, {4, "b"}, {5, "b"}, {6, "c"}, {20, "c"},
	}
	for _, tc := range cases {
		got := ""
		for _, b := range bands {
			if b.Covers(tc.n) {
				got = b.ID
			}
		}
		if got != tc.want {
			t.Errorf("Covers(%d): got band %q, want %q", tc.n, got, tc.want)
		}
	}
}

func TestValidateDiscountBand(t *testing.T) {
	cases := []struct {
		name    string
		band    GamePassDiscountBand
		wantErr string // substring; "" means valid
	}{
		{
			name:    "min below two",
			band:    GamePassDiscountBand{ID: "n", MinGamedays: 1, MaxGamedays: intPtr(1), DiscountPercent: 5, IsActive: true},
			wantErr: "at least 2",
		},
		{
			name:    "max below min",
			band:    GamePassDiscountBand{ID: "n", MinGamedays: 8, MaxGamedays: intPtr(7), DiscountPercent: 5, IsActive: true},
			wantErr: "cannot be less than",
		},
		{
			name:    "percent above 100",
			band:    GamePassDiscountBand{ID: "n", MinGamedays: 8, MaxGamedays: intPtr(9), DiscountPercent: 101, IsActive: true},
			wantErr: "between 0 and 100",
		},
		{
			name:    "overlaps a bounded band and names it",
			band:    GamePassDiscountBand{ID: "n", MinGamedays: 3, MaxGamedays: intPtr(4), DiscountPercent: 7, IsActive: true},
			wantErr: "overlaps the active band 2–3 gamedays (5%)",
		},
		{
			name:    "overlaps the open-ended band",
			band:    GamePassDiscountBand{ID: "n", MinGamedays: 10, MaxGamedays: intPtr(12), DiscountPercent: 20, IsActive: true},
			wantErr: "6+ gamedays (15%)",
		},
		{
			name:    "second open-ended band",
			band:    GamePassDiscountBand{ID: "n", MinGamedays: 10, DiscountPercent: 20, IsActive: true},
			wantErr: "only one active band can be open ended",
		},
		{
			name: "inactive band may overlap",
			band: GamePassDiscountBand{ID: "n", MinGamedays: 3, MaxGamedays: intPtr(4), DiscountPercent: 7, IsActive: false},
		},
		{
			name: "edit is not compared with itself",
			band: GamePassDiscountBand{ID: "b", MinGamedays: 4, MaxGamedays: intPtr(5), DiscountPercent: 12, IsActive: true},
		},
		{
			name:    "edit widening into a neighbour",
			band:    GamePassDiscountBand{ID: "b", MinGamedays: 4, MaxGamedays: intPtr(6), DiscountPercent: 10, IsActive: true},
			wantErr: "6+ gamedays",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateDiscountBand(tc.band, seededBands())
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("expected valid, got %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("expected error containing %q, got %v", tc.wantErr, err)
			}
		})
	}
}

func TestValidateDiscountBandIgnoresInactiveOthers(t *testing.T) {
	others := seededBands()
	others[0].IsActive = false // 2–3 deactivated
	band := GamePassDiscountBand{ID: "n", MinGamedays: 2, MaxGamedays: intPtr(3), DiscountPercent: 8, IsActive: true}
	if err := ValidateDiscountBand(band, others); err != nil {
		t.Fatalf("expected an inactive band not to block, got %v", err)
	}
}
