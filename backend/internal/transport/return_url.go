package transport

import (
	"os"
	"strings"

	"github.com/gin-gonic/gin"

	"pkg-common/helpers"
)

// paystackReturnURL is where Paystack sends a payer back to: path on the site
// they paid from.
//
// The browser's Origin is used only when it is one of the site's own addresses
// (the CORS allow-list, or localhost in development). That keeps the payer on
// the host they signed in on, so www and the bare domain both work, while a
// request carrying any other Origin can't choose where the return link points.
// Otherwise it is FRONTEND_URL. With neither configured (a bare local setup) the
// Origin is trusted as before, then localhost.
func paystackReturnURL(c *gin.Context, path string) string {
	origin := strings.TrimRight(c.GetHeader("Origin"), "/")
	allowed := helpers.GetEnvSlice(nil)
	if origin != "" {
		if helpers.AllowLocalHost(origin) {
			return origin + path
		}
		for _, a := range allowed {
			if strings.EqualFold(strings.TrimRight(a, "/"), origin) {
				return origin + path
			}
		}
	}
	if base := strings.TrimRight(os.Getenv("FRONTEND_URL"), "/"); base != "" {
		return base + path
	}
	if origin != "" && len(allowed) == 0 {
		return origin + path
	}
	return "http://localhost:5173" + path
}
