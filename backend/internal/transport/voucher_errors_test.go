package transport

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"showtime-backend/internal/services"
)

// Problems with a price voucher are the admin's to fix, so they come back as 400s
// with the message, not as a generic server error.
func TestPriceVoucherErrorsAreBadRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, err := range []error{services.ErrVoucherValueInvalid, services.ErrVoucherKind} {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/admin/vouchers", nil)
		respondVoucherError(c, fmt.Errorf("wrapped: %w", err))
		if w.Code != http.StatusBadRequest {
			t.Errorf("%v: status %d, want 400", err, w.Code)
		}
	}
}
