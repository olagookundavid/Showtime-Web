package email

import (
	"fmt"
	"html"
	"strings"
)

// GamePassEmailDay is one gameday in a Game Pass confirmation and the ticket
// codes (one per pass holder) that admit to it.
type GamePassEmailDay struct {
	Title string
	Date  string
	Venue string
	Codes []string
}

// GamePassEmailHTML is the confirmation for a paid Game Pass: one email that
// lists every ticket code, grouped by gameday.
func GamePassEmailHTML(buyerName, tierName string, holders, discountPercent, totalPaid int, days []GamePassEmailDay) string {
	holderWord := "pass holder"
	if holders != 1 {
		holderWord = "pass holders"
	}

	var dayRows strings.Builder
	for _, d := range days {
		var codes strings.Builder
		for _, c := range d.Codes {
			codes.WriteString(`<span style="display: inline-block; background-color: ` + sfflNavy + `; color: #ffffff; font-family: 'Courier New', monospace; font-size: 16px; font-weight: 800; letter-spacing: 2px; padding: 6px 10px; border-radius: 6px; margin: 4px 6px 0 0;">` + html.EscapeString(c) + `</span>`)
		}
		venue := ""
		if d.Venue != "" {
			venue = " · " + html.EscapeString(d.Venue)
		}
		dayRows.WriteString(`<tr>
<td style="padding: 0 0 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ` + sfflRed + `; border-radius: 12px;">
<tr>
<td style="padding: 16px 20px;">
<p style="color: #0f172a; font-size: 16px; font-weight: 700; margin: 0 0 2px;">` + html.EscapeString(d.Title) + `</p>
<p style="color: #64748b; font-size: 13px; margin: 0 0 8px;">` + html.EscapeString(d.Date) + venue + `</p>
` + codes.String() + `
</td>
</tr>
</table>
</td>
</tr>`)
	}

	discountLine := ""
	if discountPercent > 0 {
		discountLine = fmt.Sprintf(` with your %d%% bundle discount`, discountPercent)
	}

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IT'S SHOWTIME — Your Game Pass is confirmed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5; padding: 40px 20px;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

` + strings.ReplaceAll(brandHeader(), "%%", "%") + `

<tr>
<td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); padding: 36px 40px 28px; text-align: center;">
` + strings.ReplaceAll(ticketBadge(), "%%", "%") + `
<h1 style="color: #ffffff; font-size: 26px; font-weight: 700; margin: 16px 0 6px;">Game Pass Confirmed!</h1>
<p style="color: ` + sfflRed + `; font-size: 14px; font-weight: 600; margin: 0;">IT'S SHOWTIME</p>
</td>
</tr>

<tr>
<td style="padding: 32px 40px 0;">
<p style="color: #334155; font-size: 16px; font-weight: 700; margin: 0 0 12px;">Hi ` + html.EscapeString(buyerName) + `,</p>
<p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">
Your <strong>` + html.EscapeString(tierName) + `</strong> Game Pass for ` + fmt.Sprintf("%d %s", holders, holderWord) + ` across ` + fmt.Sprintf("%d", len(days)) + ` gamedays is confirmed` + discountLine + `.
Each code below admits one person on that gameday.
</p>
</td>
</tr>

<tr>
<td style="padding: 24px 40px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
` + dayRows.String() + `
</table>
</td>
</tr>

<tr>
<td style="padding: 8px 40px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 2px dashed ` + sfflRed + `;">
<tr>
<td style="padding: 16px 0; color: #64748b; font-size: 14px;">Total Paid</td>
<td style="padding: 16px 0; text-align: right; color: #0f172a; font-size: 20px; font-weight: 700;">₦` + formatNaira(totalPaid) + `</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="padding: 16px 40px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid ` + sfflRed + `; border-radius: 8px;">
<tr>
<td style="padding: 16px;">
<p style="color: #991b1b; font-size: 13px; line-height: 1.5; margin: 0;">
<strong>Important:</strong> Present the code for that gameday at the entrance. Codes are valid only on their own gameday. A Game Pass is non-transferable and non-refundable.
</p>
</td>
</tr>
</table>
</td>
</tr>

` + strings.ReplaceAll(brandFooter(), "%%", "%") + `

</table>
</td>
</tr>
</table>
</body>
</html>`
}
