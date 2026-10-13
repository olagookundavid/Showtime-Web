package services

import "strings"

// parsedUA is the coarse device profile derived from a User-Agent string.
// Deliberately simple string matching: analytics only needs a rough split, and
// it avoids a dependency that would need keeping up with new browser releases.
type parsedUA struct {
	Device  string
	Browser string
	OS      string
	IsBot   bool
}

var botMarkers = []string{
	"bot", "crawl", "spider", "slurp", "headless", "lighthouse", "pingdom",
	"uptime", "monitor", "curl/", "wget/", "python-requests", "go-http-client",
	"httpclient", "java/", "preview", "facebookexternalhit", "scrapy", "axios/",
}

func parseUserAgent(ua string) parsedUA {
	l := strings.ToLower(strings.TrimSpace(ua))
	p := parsedUA{Device: "desktop", Browser: "Other", OS: "Other"}

	if l == "" {
		p.IsBot = true
		return p
	}
	for _, m := range botMarkers {
		if strings.Contains(l, m) {
			p.IsBot = true
			break
		}
	}

	switch {
	case strings.Contains(l, "ipad") || strings.Contains(l, "tablet"):
		p.Device = "tablet"
	case strings.Contains(l, "android") && !strings.Contains(l, "mobile"):
		p.Device = "tablet"
	case strings.Contains(l, "mobi") || strings.Contains(l, "iphone") || strings.Contains(l, "android"):
		p.Device = "mobile"
	}

	// Order matters: most browsers also claim to be Chrome and Safari.
	switch {
	case strings.Contains(l, "edg/") || strings.Contains(l, "edga/") || strings.Contains(l, "edgios/"):
		p.Browser = "Edge"
	case strings.Contains(l, "opr/") || strings.Contains(l, "opera"):
		p.Browser = "Opera"
	case strings.Contains(l, "samsungbrowser"):
		p.Browser = "Samsung Internet"
	case strings.Contains(l, "fban") || strings.Contains(l, "fbav"):
		p.Browser = "Facebook app"
	case strings.Contains(l, "instagram"):
		p.Browser = "Instagram app"
	case strings.Contains(l, "firefox") || strings.Contains(l, "fxios"):
		p.Browser = "Firefox"
	case strings.Contains(l, "chrome") || strings.Contains(l, "crios"):
		p.Browser = "Chrome"
	case strings.Contains(l, "safari"):
		p.Browser = "Safari"
	}

	switch {
	case strings.Contains(l, "windows"):
		p.OS = "Windows"
	case strings.Contains(l, "android"):
		p.OS = "Android"
	case strings.Contains(l, "iphone") || strings.Contains(l, "ipad") || strings.Contains(l, "ipod"):
		p.OS = "iOS"
	case strings.Contains(l, "mac os x") || strings.Contains(l, "macintosh"):
		p.OS = "macOS"
	case strings.Contains(l, "cros"):
		p.OS = "ChromeOS"
	case strings.Contains(l, "linux"):
		p.OS = "Linux"
	}
	return p
}
