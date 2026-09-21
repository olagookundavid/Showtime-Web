package domain_test

import (
	"testing"

	"showtime-backend/internal/domain"
)

func TestCalculatePlayerTier(t *testing.T) {
	tests := []struct {
		mvpCount int
		expected string
	}{
		{0, "Prospect"},
		{1, "Starter"},
		{2, "Star"},
		{3, "Star"},
		{4, "Star"},
		{5, "Superstar"},
		{10, "Superstar"},
	}

	for _, tc := range tests {
		tier := domain.CalculatePlayerTier(tc.mvpCount)
		if tier != tc.expected {
			t.Errorf("expected tier %s for %d MVPs, got %s", tc.expected, tc.mvpCount, tier)
		}
	}
}
