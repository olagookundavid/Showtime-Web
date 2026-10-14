package email

import (
	"fmt"
	"html"
	"strings"
)

// TicketEmailDay is one match day a ticket covers, as it should read in an email.
type TicketEmailDay struct {
	Title string
	Date  string
	Venue string
}

// PurchaseEmailData is everything the confirmation email shows. A Game Pass lists
// every day it covers; a single ticket lists one.
type PurchaseEmailData struct {
	BuyerName   string
	ProductName string
	Phone       string
	TicketCode  string
	Quantity    int
	TotalAmount int
	Days        []TicketEmailDay
}

// ReminderEmailData is the "your match day is tomorrow" email for one day.
type ReminderEmailData struct {
	BuyerName   string
	ProductName string
	TicketCode  string
	Quantity    int
	Day         TicketEmailDay
	// TotalDays and DayNumber say where this day sits in a Game Pass (0 for a
	// single ticket), so the email can say "day 2 of 3".
	TotalDays int
	DayNumber int
}

func esc(s string) string { return html.EscapeString(s) }

// daysBlock renders the date/venue rows for each day of a ticket.
func daysBlock(days []TicketEmailDay) string {
	var b strings.Builder
	for i, d := range days {
		border := ""
		if i < len(days)-1 {
			border = "border-bottom: 1px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 14px;"
		}
		fmt.Fprintf(&b, `<div style="%s">
<p style="color: %s; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">Match Day %d</p>
<p style="color: #0f172a; font-size: 17px; font-weight: 700; margin: 0 0 8px;">%s</p>
<p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0 0 2px;">📅 %s</p>
<p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">📍 %s</p>
</div>`, border, sfflRed, i+1, esc(d.Title), esc(d.Date), esc(d.Venue))
	}
	return b.String()
}

func emailShell(title, badge, heading string, body string) string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>` + esc(title) + `</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5; padding: 40px 20px;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

` + brandHeader() + `

<tr>
<td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); padding: 36px 40px 28px; text-align: center;">
` + badge + `
<h1 style="color: #ffffff; font-size: 26px; font-weight: 700; margin: 16px 0 6px;">` + esc(heading) + `</h1>
<p style="color: ` + sfflRed + `; font-size: 14px; font-weight: 600; margin: 0;">IT'S SHOWTIME 🏈</p>
</td>
</tr>

` + body + `

` + brandFooter() + `

</table>
</td>
</tr>
</table>
</body>
</html>`
}

func codeBlock(code string) string {
	return `<tr>
<td style="padding: 0 40px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; overflow: hidden; border: 2px solid ` + sfflRed + `;">
<tr>
<td style="padding: 28px; text-align: center;">
<p style="color: ` + sfflRed + `; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin: 0 0 10px;">🎫 Your Ticket Code</p>
<p style="color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 4px; margin: 0; font-family: 'Courier New', monospace;">` + esc(code) + `</p>
</td>
</tr>
</table>
</td>
</tr>`
}

func detailRow(label, value string) string {
	return fmt.Sprintf(`<td width="50%%" style="vertical-align: top;">
<p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">%s</p>
<p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">%s</p>
</td>`, label, esc(value))
}

// PurchaseEmailHTML generates the confirmation email. Every purchase is a Game
// Pass, so it lists every match day on it in one message, however many there are.
func PurchaseEmailHTML(d PurchaseEmailData) string {
	noun := "Game Pass"
	if d.Quantity > 1 {
		noun = "Game Passes"
	}
	heading := "Game Pass Confirmed!"
	intro := "Thank you for your purchase! Here are your details:"
	switch {
	case len(d.Days) == 1:
		intro = fmt.Sprintf("Thank you for your purchase! Your %s for %s is confirmed. Here are your details:", strings.ToLower(noun), d.Days[0].Title)
	case len(d.Days) > 1:
		intro = fmt.Sprintf("Thank you for your purchase! Your Game Pass covers %d match days. One code gets you in on every one of them:", len(d.Days))
	}

	phoneRow := ""
	if strings.TrimSpace(d.Phone) != "" && d.Phone != "N/A" {
		phoneRow = `<tr><td colspan="2" style="padding-top: 14px;">
<p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">📞 Phone Number</p>
<p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">` + esc(d.Phone) + `</p>
</td></tr>`
	}

	body := `<tr>
<td style="padding: 32px 40px 0;">
<p style="color: #334155; font-size: 16px; font-weight: 700; margin: 0 0 12px;">Hi ` + esc(d.BuyerName) + `,</p>
<p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">` + esc(intro) + `</p>
</td>
</tr>

<tr>
<td style="padding: 24px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ` + sfflRed + `; border-radius: 12px; overflow: hidden;">
<tr>
<td style="padding: 24px;">
` + daysBlock(d.Days) + `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 14px;">
<tr>
` + detailRow("🎫 Ticket", d.ProductName) + detailRow("👥 Quantity", fmt.Sprintf("%d %s", d.Quantity, strings.ToLower(noun))) + `
</tr>
` + phoneRow + `
</table>
</td>
</tr>
</table>
</td>
</tr>

` + codeBlock(d.TicketCode) + `

<tr>
<td style="padding: 16px 40px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 2px dashed ` + sfflRed + `;">
<tr>
<td style="padding: 16px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="color: #64748b; font-size: 14px;">Total Paid</td>
<td style="text-align: right; color: #0f172a; font-size: 20px; font-weight: 700;">₦` + formatNaira(d.TotalAmount) + `</td>
</tr>
</table>
</td>
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
<strong>⚡ Important:</strong> Please present this ticket code at the entrance on game day. You will also get a reminder before each match day.
</p>
</td>
</tr>
</table>
</td>
</tr>`

	return emailShell("IT'S SHOWTIME — Your Game Pass Confirmed", ticketBadge(), heading, body)
}

// DayReminderEmailHTML is the reminder sent ahead of one match day.
func DayReminderEmailHTML(d ReminderEmailData) string {
	label := "Your match day is almost here"
	if d.TotalDays > 1 && d.DayNumber > 0 {
		label = fmt.Sprintf("Day %d of %d on your Game Pass", d.DayNumber, d.TotalDays)
	}
	noun := "ticket"
	if d.Quantity > 1 {
		noun = "tickets"
	}

	body := `<tr>
<td style="padding: 32px 40px 0;">
<p style="color: #334155; font-size: 16px; font-weight: 700; margin: 0 0 12px;">Hi ` + esc(d.BuyerName) + `,</p>
<p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">` + esc(label) + `. Here is what you need for <strong>` + esc(d.Day.Title) + `</strong>:</p>
</td>
</tr>

<tr>
<td style="padding: 24px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ` + sfflRed + `; border-radius: 12px; overflow: hidden;">
<tr>
<td style="padding: 24px;">
` + daysBlock([]TicketEmailDay{d.Day}) + `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 14px;">
<tr>
` + detailRow("🎫 Ticket", d.ProductName) + detailRow("👥 Admits", fmt.Sprintf("%d %s", d.Quantity, noun)) + `
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

` + codeBlock(d.TicketCode) + `

<tr>
<td style="padding: 16px 40px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid ` + sfflRed + `; border-radius: 8px;">
<tr>
<td style="padding: 16px;">
<p style="color: #991b1b; font-size: 13px; line-height: 1.5; margin: 0;">
<strong>⚡ Reminder:</strong> Show the code above at the entrance. See you there!
</p>
</td>
</tr>
</table>
</td>
</tr>`

	return emailShell("IT'S SHOWTIME — Match Day Reminder", ticketBadge(), "Match Day Reminder", body)
}
