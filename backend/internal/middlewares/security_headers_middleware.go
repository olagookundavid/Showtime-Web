package middlewares

import "github.com/gin-gonic/gin"

// SecurityHeaders sets a baseline set of hardening response headers on the API.
// Scoped to the JSON API group (not the Swagger HTML), so a restrictive CSP is
// safe here. HSTS is only meaningful over HTTPS (Koyeb terminates TLS), and is
// harmless on plain HTTP since browsers ignore it on non-secure origins.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.Writer.Header()
		// Force HTTPS for a year (incl. subdomains) once seen over TLS.
		h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		// Block MIME sniffing.
		h.Set("X-Content-Type-Options", "nosniff")
		// This is a JSON API — it should never be framed.
		h.Set("X-Frame-Options", "DENY")
		// Don't leak full URLs (which can carry references) to other origins.
		h.Set("Referrer-Policy", "no-referrer")
		// API responses are not documents; lock the CSP down hard.
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		c.Next()
	}
}
