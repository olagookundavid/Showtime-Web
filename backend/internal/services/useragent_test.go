package services

import "testing"

func TestParseUserAgent(t *testing.T) {
	cases := []struct {
		name string
		ua   string
		want parsedUA
	}{
		{
			"iPhone Safari",
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			parsedUA{Device: "mobile", Browser: "Safari", OS: "iOS"},
		},
		{
			"Android Chrome phone",
			"Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
			parsedUA{Device: "mobile", Browser: "Chrome", OS: "Android"},
		},
		{
			"Android tablet has no Mobile token",
			"Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			parsedUA{Device: "tablet", Browser: "Chrome", OS: "Android"},
		},
		{
			"Windows Edge is not Chrome",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
			parsedUA{Device: "desktop", Browser: "Edge", OS: "Windows"},
		},
		{
			"macOS Firefox",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
			parsedUA{Device: "desktop", Browser: "Firefox", OS: "macOS"},
		},
		{
			"Googlebot",
			"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
			parsedUA{Device: "desktop", Browser: "Other", OS: "Other", IsBot: true},
		},
		{
			"empty UA counts as a bot",
			"",
			parsedUA{Device: "desktop", Browser: "Other", OS: "Other", IsBot: true},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := parseUserAgent(tc.ua); got != tc.want {
				t.Errorf("got %+v, want %+v", got, tc.want)
			}
		})
	}
}
