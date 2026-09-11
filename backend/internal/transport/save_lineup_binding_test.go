package transport

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"showtime-backend/internal/dto"

	"github.com/gin-gonic/gin"
)

// The service decides completeness, but gin's binding runs first. A len=14 tag
// here would reject every partial autosave with a 400 before the service ever
// saw it — and no service-level test can catch that, because they all bypass
// the binding layer.
func TestSaveLineupRequestBindingAcceptsPartialPicks(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, tc := range []struct {
		name    string
		picks   int
		publish bool
		wantOK  bool
	}{
		{"a single pick", 1, false, true},
		{"a partial sheet", 9, false, true},
		{"a full sheet", 14, false, true},
		{"a full sheet being published", 14, true, true},
		// Benching the last starter leaves an empty sheet; that must save.
		{"an emptied sheet", 0, false, true},
		{"more than fourteen", 15, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			picks := make([]dto.LineupSlotItem, 0, tc.picks)
			for i := 0; i < tc.picks; i++ {
				picks = append(picks, dto.LineupSlotItem{
					PlayerID: "11111111-1111-1111-1111-111111111111",
					Slot:     "REC_1",
				})
			}
			body, _ := json.Marshal(dto.SaveLineupRequest{
				SeasonID:   "22222222-2222-2222-2222-222222222222",
				GameweekID: "33333333-3333-3333-3333-333333333333",
				TeamName:   "Test XI",
				Picks:      picks,
				Publish:    tc.publish,
			})

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodPost, "/fantasy/lineups", bytes.NewReader(body))
			c.Request.Header.Set("Content-Type", "application/json")

			var got dto.SaveLineupRequest
			err := c.ShouldBindJSON(&got)
			if tc.wantOK && err != nil {
				t.Errorf("binding rejected a request it must accept: %v", err)
			}
			if !tc.wantOK && err == nil {
				t.Error("binding accepted a request it must reject")
			}
			if tc.wantOK && err == nil && got.Publish != tc.publish {
				t.Errorf("publish flag lost in binding: got %v, want %v", got.Publish, tc.publish)
			}
		})
	}
}
