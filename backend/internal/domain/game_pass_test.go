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

func TestPriceGamePass(t *testing.T) {
	cases := []struct {
		name                                 string
		rate, gamedays, holders              int
		wantStd, wantPct, wantOff, wantTotal int
	}{
		{"one gameday, no band", 2000, 1, 1, 2000, 0, 0, 2000},
		{"2 gamedays, 5%", 2000, 2, 1, 4000, 5, 200, 3800},
		{"3 gamedays x2 holders, 5%", 2000, 3, 2, 12000, 5, 600, 11400},
		{"4 gamedays, 10%", 2000, 4, 1, 8000, 10, 800, 7200},
		{"6 gamedays, 15%", 2000, 6, 1, 12000, 15, 1800, 10200},
		{"20 gamedays, open band", 2000, 20, 1, 40000, 15, 6000, 34000},
		// 1,010 x 2 = 2,020; 5% = 101.0 exactly.
		{"exact", 1010, 2, 1, 2020, 5, 101, 1919},
		// 1,005 x 2 = 2,010; 5% = 100.5 -> 101 (half up, like Math.round).
		{"half rounds up", 1005, 2, 1, 2010, 5, 101, 1909},
		// 1,001 x 2 = 2,002; 5% = 100.1 -> 100.
		{"below half rounds down", 1001, 2, 1, 2002, 5, 100, 1902},
		{"free tier", 0, 4, 3, 0, 10, 0, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := PriceGamePass(tc.rate, tc.gamedays, tc.holders, seededBands())
			if p.StandardTotal != tc.wantStd || p.DiscountPercent != tc.wantPct || p.DiscountAmount != tc.wantOff || p.Total != tc.wantTotal {
				t.Fatalf("got std=%d pct=%d off=%d total=%d, want std=%d pct=%d off=%d total=%d",
					p.StandardTotal, p.DiscountPercent, p.DiscountAmount, p.Total,
					tc.wantStd, tc.wantPct, tc.wantOff, tc.wantTotal)
			}
		})
	}
}

func TestPriceGamePassIgnoresInactiveBands(t *testing.T) {
	bands := seededBands()
	bands[1].IsActive = false // 4–5 off
	if p := PriceGamePass(2000, 4, 1, bands); p.DiscountPercent != 0 {
		t.Fatalf("expected no discount from an inactive band, got %d%%", p.DiscountPercent)
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

func TestSplitGamePassTotal(t *testing.T) {
	cases := []struct {
		total, n int
		want     []int
	}{
		{7600, 4, []int{1900, 1900, 1900, 1900}},
		{10, 3, []int{4, 3, 3}},
		{11, 3, []int{4, 4, 3}},
		{0, 2, []int{0, 0}},
	}
	for _, tc := range cases {
		got := SplitGamePassTotal(tc.total, tc.n)
		sum := 0
		for i, v := range got {
			sum += v
			if v != tc.want[i] {
				t.Errorf("SplitGamePassTotal(%d, %d) = %v, want %v", tc.total, tc.n, got, tc.want)
				break
			}
		}
		if sum != tc.total {
			t.Errorf("SplitGamePassTotal(%d, %d) sums to %d", tc.total, tc.n, sum)
		}
	}
}
