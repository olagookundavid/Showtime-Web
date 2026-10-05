package middlewares

import (
	"fmt"
	"math"
	"net"
	"net/http"
	"pkg-common/helpers"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// LimitKey picks who a WindowLimit counts against.
type LimitKey func(c *gin.Context) string

// ByIP counts requests per client IP.
//
// In production the API sits behind Cloudflare -> Caddy, and Caddy (with no
// trusted_proxies set) hands us Cloudflare's edge address, so ClientIP() would
// put every fan in one bucket. Cloudflare always overwrites CF-Connecting-IP
// with the real visitor, and the origin only accepts Cloudflare's ranges, so the
// header can't be spoofed there; elsewhere it's absent and ClientIP() applies.
func ByIP(c *gin.Context) string {
	if ip := net.ParseIP(c.GetHeader("CF-Connecting-IP")); ip != nil {
		return "ip:" + ip.String()
	}
	return "ip:" + c.ClientIP()
}

// ByUser counts requests per logged-in user, falling back to the IP for guests.
// Use it on routes behind the token middleware.
func ByUser(c *gin.Context) string {
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil && payload.UserId != "" {
		return "user:" + payload.UserId
	}
	return ByIP(c)
}

// WindowLimit allows at most max requests per key in any rolling window, then
// answers 429 with a Retry-After header until the oldest request ages out.
//
// The per-second token bucket in commonAuth suits bursts; this is for actions
// that should only happen a handful of times an hour (sign-ups, verification
// codes, vote changes). Counts live in memory, so they reset on restart and are
// per instance — fine for a single server, but a multi-instance deploy would
// need a shared store such as Redis.
func WindowLimit(name string, max int, window time.Duration, key LimitKey) gin.HandlerFunc {
	var (
		mu        sync.Mutex
		hits      = make(map[string][]time.Time)
		lastSweep = time.Now()
	)

	return func(c *gin.Context) {
		now := time.Now()
		cutoff := now.Add(-window)
		k := key(c)

		mu.Lock()
		// Drop idle keys now and then so the map can't grow without bound.
		if now.Sub(lastSweep) > window {
			for hk, ts := range hits {
				if len(ts) == 0 || ts[len(ts)-1].Before(cutoff) {
					delete(hits, hk)
				}
			}
			lastSweep = now
		}

		recent := hits[k][:0]
		for _, t := range hits[k] {
			if t.After(cutoff) {
				recent = append(recent, t)
			}
		}
		if len(recent) >= max {
			retry := recent[0].Add(window).Sub(now)
			hits[k] = recent
			mu.Unlock()
			c.Header("Retry-After", fmt.Sprintf("%d", int(math.Ceil(retry.Seconds()))))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": fmt.Sprintf("Too many %s attempts. Please try again in %s.", name, humanizeWait(retry)),
			})
			return
		}
		hits[k] = append(recent, now)
		mu.Unlock()

		c.Next()
	}
}

func humanizeWait(d time.Duration) string {
	switch {
	case d < time.Minute:
		return "a minute"
	case d < time.Hour:
		m := int(math.Ceil(d.Minutes()))
		return fmt.Sprintf("%d minute%s", m, plural(m))
	default:
		h := int(math.Ceil(d.Hours()))
		return fmt.Sprintf("%d hour%s", h, plural(h))
	}
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}
