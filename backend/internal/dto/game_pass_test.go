package dto

import (
	"encoding/json"
	"testing"
)

// The admin toggle sends only is_active and must not wipe max_gamedays; the
// edit form sends max_gamedays: null to make a band open ended.
func TestUpdateDiscountBandMaxGamedaysTriState(t *testing.T) {
	cases := []struct {
		body    string
		wantSet bool
		wantNil bool
		wantVal int
	}{
		{`{"is_active": false}`, false, true, 0},
		{`{"max_gamedays": null}`, true, true, 0},
		{`{"max_gamedays": 5}`, true, false, 5},
	}
	for _, tc := range cases {
		var req UpdateGamePassDiscountBandRequest
		if err := json.Unmarshal([]byte(tc.body), &req); err != nil {
			t.Fatalf("%s: %v", tc.body, err)
		}
		if req.MaxGamedays.Set != tc.wantSet {
			t.Errorf("%s: Set = %v, want %v", tc.body, req.MaxGamedays.Set, tc.wantSet)
		}
		if (req.MaxGamedays.Value == nil) != tc.wantNil {
			t.Errorf("%s: Value nil = %v, want %v", tc.body, req.MaxGamedays.Value == nil, tc.wantNil)
		}
		if !tc.wantNil && *req.MaxGamedays.Value != tc.wantVal {
			t.Errorf("%s: Value = %d, want %d", tc.body, *req.MaxGamedays.Value, tc.wantVal)
		}
	}
}
