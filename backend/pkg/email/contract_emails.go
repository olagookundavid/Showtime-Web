package email

import (
	"fmt"
	"strings"
)

// ExpiringPlayer is one row of a contract-expiry summary.
type ExpiringPlayer struct {
	Name     string
	Position string
	// Remaining is team matches left on the contract; ignored when Expired.
	Remaining int
	Expired   bool
	// ExpiredOn is the expiry date, already formatted for reading.
	ExpiredOn string
	// HasAccount says the player can accept an offer themselves. Without one, a
	// re-sign by their own team starts straight away.
	HasAccount   bool
	OfferPending bool
}

// TeamExpiryEmailData is the summary a team manager gets for their own squad.
type TeamExpiryEmailData struct {
	ManagerName  string
	TeamName     string
	Players      []ExpiringPlayer
	ContractsURL string
}

// LeagueExpiryTeam is one team's block in the league-wide summary.
type LeagueExpiryTeam struct {
	TeamName string
	Players  []ExpiringPlayer
}

// LeagueExpiryEmailData is the weekly league-wide summary for commissioners.
type LeagueExpiryEmailData struct {
	RecipientName string
	Teams         []LeagueExpiryTeam
	ContractsURL  string
}

func contractBadge() string {
	return `<table role="presentation" cellpadding="0" cellspacing="0" style="display: inline-table; margin: 0 auto;">
<tr>
<td style="background-color: ` + sfflRed + `; width: 72px; height: 72px; border-radius: 50%; text-align: center; vertical-align: middle;">
<table role="presentation" cellpadding="0" cellspacing="0" style="display: inline-table;">
<tr>
<td style="width: 26px; height: 32px; border: 3px solid #ffffff; border-radius: 4px; vertical-align: middle; text-align: center;">
<div style="width: 14px; height: 3px; background: #ffffff; margin: 3px auto;"></div>
<div style="width: 14px; height: 3px; background: #ffffff; margin: 3px auto;"></div>
<div style="width: 14px; height: 3px; background: #ffffff; margin: 3px auto;"></div>
</td>
</tr>
</table>
</td>
</tr>
</table>`
}

// expiryGroups splits players into the sections a reader acts on, most urgent first.
func expiryGroups(players []ExpiringPlayer) []struct {
	Label   string
	Tone    string
	Players []ExpiringPlayer
} {
	groups := []struct {
		Label   string
		Tone    string
		Players []ExpiringPlayer
	}{
		{Label: "Contract expired: now a free agent", Tone: sfflRed},
		{Label: "1 match left", Tone: "#ea580c"},
		{Label: "2 matches left", Tone: "#d97706"},
		{Label: "3 matches left", Tone: "#ca8a04"},
	}
	for _, p := range players {
		i := 3
		switch {
		case p.Expired:
			i = 0
		case p.Remaining <= 1:
			i = 1
		case p.Remaining == 2:
			i = 2
		}
		groups[i].Players = append(groups[i].Players, p)
	}
	out := groups[:0]
	for _, g := range groups {
		if len(g.Players) > 0 {
			out = append(out, g)
		}
	}
	return out
}

func playerNote(p ExpiringPlayer) string {
	switch {
	case p.OfferPending:
		return "New offer sent, waiting for the player to accept"
	case p.Expired && !p.HasAccount:
		return "No player account: re-signing from Contracts starts the contract straight away"
	case p.Expired:
		return "Re-sign from Contracts; the player accepts in their Player Portal"
	case !p.HasAccount:
		return "No player account yet: extend now so they don't drop off the roster"
	default:
		return "Offer an extension from Contracts"
	}
}

// expiryTable renders the grouped player list.
func expiryTable(players []ExpiringPlayer) string {
	var b strings.Builder
	for _, g := range expiryGroups(players) {
		fmt.Fprintf(&b, `<p style="color: %s; font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; margin: 18px 0 8px;">%s (%d)</p>`,
			g.Tone, esc(g.Label), len(g.Players))
		b.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-left: 4px solid ` + g.Tone + `; border-radius: 8px;">`)
		for i, p := range g.Players {
			border := ""
			if i < len(g.Players)-1 {
				border = "border-bottom: 1px solid #e2e8f0;"
			}
			sub := p.Position
			if p.Expired && p.ExpiredOn != "" {
				if sub != "" {
					sub += " · "
				}
				sub += "expired " + p.ExpiredOn
			}
			fmt.Fprintf(&b, `<tr><td style="padding: 10px 14px; %s">
<p style="color: #0f172a; font-size: 15px; font-weight: 700; margin: 0;">%s</p>
<p style="color: #64748b; font-size: 12px; margin: 2px 0 0;">%s</p>
<p style="color: #334155; font-size: 13px; margin: 4px 0 0;">%s</p>
</td></tr>`, border, esc(p.Name), esc(sub), esc(playerNote(p)))
		}
		b.WriteString(`</table>`)
	}
	return b.String()
}

func ctaButton(url, label string) string {
	if url == "" {
		return ""
	}
	return `<tr>
<td style="padding: 8px 40px 32px; text-align: center;">
<a href="` + esc(url) + `" style="display: inline-block; background-color: ` + sfflRed + `; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 10px;">` + esc(label) + `</a>
</td>
</tr>`
}

// CountExpiring is how many of the players have expired and how many are still on
// three or fewer matches, for subject lines and notifications.
func CountExpiring(players []ExpiringPlayer) (expired, expiring int) {
	for _, p := range players {
		if p.Expired {
			expired++
		} else {
			expiring++
		}
	}
	return expired, expiring
}

// ExpirySummaryLine reads "2 expired, 5 with 3 or fewer matches left".
func ExpirySummaryLine(expired, expiring int) string {
	var parts []string
	if expired > 0 {
		parts = append(parts, fmt.Sprintf("%d expired", expired))
	}
	if expiring > 0 {
		parts = append(parts, fmt.Sprintf("%d with 3 or fewer matches left", expiring))
	}
	return strings.Join(parts, ", ")
}

// TeamContractExpiryEmailHTML is the team manager's summary of their players whose
// contracts are in the last three matches or have just run out.
func TeamContractExpiryEmailHTML(d TeamExpiryEmailData) string {
	expired, expiring := CountExpiring(d.Players)
	greeting := "Hi,"
	if strings.TrimSpace(d.ManagerName) != "" {
		greeting = "Hi " + esc(d.ManagerName) + ","
	}
	body := `<tr>
<td style="padding: 32px 40px 0;">
<p style="color: #334155; font-size: 16px; font-weight: 700; margin: 0 0 12px;">` + greeting + `</p>
<p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">Here is where <strong>` + esc(d.TeamName) + `</strong>'s contracts stand: ` +
		esc(ExpirySummaryLine(expired, expiring)) + `. When a contract runs out the player leaves your roster and becomes a free agent, so act before their last match.</p>
<p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 12px 0 0;">You can re-sign your own expired players at any time, even while the transfer window is closed.</p>
</td>
</tr>
<tr>
<td style="padding: 8px 40px 24px;">` + expiryTable(d.Players) + `</td>
</tr>
` + ctaButton(d.ContractsURL, "Open Contracts")
	return emailShell("Contracts running out", contractBadge(), "Contracts running out", body)
}

// LeagueContractExpiryEmailHTML is the commissioners' weekly summary across every team.
func LeagueContractExpiryEmailHTML(d LeagueExpiryEmailData) string {
	var all []ExpiringPlayer
	for _, t := range d.Teams {
		all = append(all, t.Players...)
	}
	expired, expiring := CountExpiring(all)
	greeting := "Hi,"
	if strings.TrimSpace(d.RecipientName) != "" {
		greeting = "Hi " + esc(d.RecipientName) + ","
	}

	var teams strings.Builder
	for _, t := range d.Teams {
		te, tx := CountExpiring(t.Players)
		fmt.Fprintf(&teams, `<tr><td style="padding: 20px 40px 0;">
<p style="color: #0f172a; font-size: 18px; font-weight: 800; margin: 0;">%s</p>
<p style="color: #64748b; font-size: 13px; margin: 2px 0 0;">%s</p>
%s
</td></tr>`, esc(t.TeamName), esc(ExpirySummaryLine(te, tx)), expiryTable(t.Players))
	}

	body := `<tr>
<td style="padding: 32px 40px 0;">
<p style="color: #334155; font-size: 16px; font-weight: 700; margin: 0 0 12px;">` + greeting + `</p>
<p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">This week across the league: ` + esc(ExpirySummaryLine(expired, expiring)) +
		fmt.Sprintf(`, at %d team%s. Each team's managers get their own summary as their matches finish.</p>`, len(d.Teams), map[bool]string{true: "", false: "s"}[len(d.Teams) == 1]) + `
</td>
</tr>
` + teams.String() + `
<tr><td style="padding: 24px 0 0;"></td></tr>
` + ctaButton(d.ContractsURL, "Open Contracts")
	return emailShell("Weekly contract summary", contractBadge(), "Weekly contract summary", body)
}
