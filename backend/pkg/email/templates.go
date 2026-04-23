package email

import "fmt"

// Shared brand constants
const (
	logoURL     = "https://images.leaguerepublic.com/data/images/738010788/107.png"
	brandName   = "ShowTime Flag Football League"
	tagline     = "The premier flag football league in Lagos. Building community through sport."
	youtubeURL  = "https://www.youtube.com/@ShowtimeFlagFootball"
	instaURL    = "https://www.instagram.com/showtimeffl/"
	twitterURL  = "https://twitter.com/showtimeffl"
	facebookURL = "https://web.facebook.com/Showtimeffl"
	sfflRed     = "#dc2626"
	sfflNavy    = "#0f172a"
)

// brandHeader returns the shared branded logo + name header bar with red top border
func brandHeader() string {
	return `<!-- Red Top Border -->
<tr>
<td style="background-color: ` + sfflRed + `; height: 4px; font-size: 0; line-height: 0;">&nbsp;</td>
</tr>
<!-- Brand Header -->
<tr>
<td style="background-color: ` + sfflNavy + `; padding: 20px 40px;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
<tr>
<td>
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td style="vertical-align: middle;">
<img src="` + logoURL + `" alt="SFFL Logo" width="40" height="40" style="display: block; border-radius: 50%%; background: #ffffff; padding: 3px;" />
</td>
<td style="vertical-align: middle; padding-left: 12px;">
<span style="font-size: 18px; font-weight: 900; font-style: italic; color: #ffffff; letter-spacing: 0.5px;">SHOWTIME <span style="color: ` + sfflRed + `;">FLAG FOOTBALL</span></span>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>`
}

// ticketBadge returns a crisp, styled HTML ticket icon that scales perfectly in all email clients
func ticketBadge() string {
	return `<table role="presentation" cellpadding="0" cellspacing="0" style="display: inline-table; margin: 0 auto;">
<tr>
<td style="background-color: ` + sfflRed + `; width: 72px; height: 72px; border-radius: 50%%; text-align: center; vertical-align: middle;">
<table role="presentation" cellpadding="0" cellspacing="0" style="display: inline-table;">
<tr>
<td style="width: 36px; height: 28px; border: 3px solid #ffffff; border-radius: 6px; text-align: center; vertical-align: middle;">
<div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid #ffffff; display: inline-block; margin-top: 2px;"></div>
</td>
</tr>
</table>
</td>
</tr>
</table>`
}

// checkinBadge returns a styled HTML checkmark icon for the check-in email
func checkinBadge() string {
	return `<table role="presentation" cellpadding="0" cellspacing="0" style="display: inline-table; margin: 0 auto;">
<tr>
<td style="background-color: #16a34a; width: 72px; height: 72px; border-radius: 50%%; text-align: center; vertical-align: middle;">
<span style="font-size: 36px; color: #ffffff; font-weight: 900; line-height: 72px;">✓</span>
</td>
</tr>
</table>`
}

// brandFooter returns the shared branded footer with tagline, socials, and copyright
func brandFooter() string {
	return fmt.Sprintf(`<!-- Brand Footer -->
<tr>
<td style="background-color: %s; padding: 32px 40px;">
<table role="presentation" width="100%%%%" cellpadding="0" cellspacing="0">

<!-- Logo + Tagline -->
<tr>
<td style="text-align: center; padding-bottom: 20px;">
<img src="%s" alt="SFFL Logo" width="48" height="48" style="display: inline-block; border-radius: 50%%%%; background: #ffffff; padding: 4px; margin-bottom: 8px;" />
<p style="color: #ffffff; font-size: 15px; font-weight: 800; font-style: italic; letter-spacing: 0.5px; margin: 8px 0 4px;">SHOWTIME <span style="color: %s;">FLAG FOOTBALL</span></p>
<p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0; max-width: 320px; display: inline-block;">%s</p>
</td>
</tr>

<!-- Social Icons -->
<tr>
<td style="text-align: center; padding-bottom: 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="display: inline-table;">
<tr>
<!-- YouTube -->
<td style="padding: 0 6px;">
<a href="%s" target="_blank" style="display: inline-block; width: 36px; height: 36px; background-color: #374151; border-radius: 50%%%%; text-align: center; line-height: 36px; text-decoration: none;">
<img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" width="18" height="18" style="vertical-align: middle;" />
</a>
</td>
<!-- Instagram -->
<td style="padding: 0 6px;">
<a href="%s" target="_blank" style="display: inline-block; width: 36px; height: 36px; background-color: #374151; border-radius: 50%%%%; text-align: center; line-height: 36px; text-decoration: none;">
<img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" width="18" height="18" style="vertical-align: middle;" />
</a>
</td>
<!-- X / Twitter -->
<td style="padding: 0 6px;">
<a href="%s" target="_blank" style="display: inline-block; width: 36px; height: 36px; background-color: #374151; border-radius: 50%%%%; text-align: center; line-height: 36px; text-decoration: none;">
<img src="https://cdn-icons-png.flaticon.com/512/5968/5968958.png" alt="X" width="18" height="18" style="vertical-align: middle;" />
</a>
</td>
<!-- Facebook -->
<td style="padding: 0 6px;">
<a href="%s" target="_blank" style="display: inline-block; width: 36px; height: 36px; background-color: #374151; border-radius: 50%%%%; text-align: center; line-height: 36px; text-decoration: none;">
<img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" width="18" height="18" style="vertical-align: middle;" />
</a>
</td>
</tr>
</table>
</td>
</tr>

<!-- Red Divider -->
<tr>
<td style="padding: 0 60px 16px;">
<div style="height: 2px; background-color: %s;"></div>
</td>
</tr>

<!-- Copyright -->
<tr>
<td style="text-align: center;">
<p style="color: #64748b; font-size: 11px; margin: 0 0 4px;">Follow us on social media for live updates</p>
<p style="color: #475569; font-size: 10px; margin: 0;">© 2026 ShowTime Flag Football League. All rights reserved.</p>
<p style="color: #475569; font-size: 10px; margin: 4px 0 0;">This is an automated email. Please do not reply.</p>
</td>
</tr>

</table>
</td>
</tr>`, sfflNavy, logoURL, sfflRed, tagline, youtubeURL, instaURL, twitterURL, facebookURL, sfflRed)
}

// PurchaseEmailHTML generates a premium ticket confirmation email
func PurchaseEmailHTML(buyerName, eventTitle, eventDate, eventVenue, tierName, phone string, quantity int, totalAmount int, ticketCode string) string {
	unitDisplay := "ticket"
	isAre := "is"
	if quantity > 1 {
		unitDisplay = "tickets"
		isAre = "are"
	}
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IT'S SHOWTIME — Your Ticket Confirmed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5; padding: 40px 20px;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

`+brandHeader()+`

<!-- Hero Banner -->
<tr>
<td style="background: linear-gradient(135deg, #0f172a 0%%, #1e293b 50%%, #0f172a 100%%); padding: 36px 40px 28px; text-align: center;">
`+ticketBadge()+`
<h1 style="color: #ffffff; font-size: 26px; font-weight: 700; margin: 16px 0 6px;">Ticket Confirmed!</h1>
<p style="color: `+sfflRed+`; font-size: 14px; font-weight: 600; margin: 0;">IT'S SHOWTIME 🏈</p>
</td>
</tr>

<!-- Greeting -->
<tr>
<td style="padding: 32px 40px 0;">
<p style="color: #334155; font-size: 16px; font-weight: 700; margin: 0 0 12px;">Hi %s,</p>
<p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">
Thank you for your purchase! Your %s for <strong>%s</strong> %s confirmed. Here are your details:
</p>
</td>
</tr>

<!-- Event Details Card -->
<tr>
<td style="padding: 24px 40px;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid `+sfflRed+`; border-radius: 12px; overflow: hidden;">
<tr>
<td style="padding: 24px;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
<!-- Event Name -->
<tr>
<td style="padding: 0 0 14px;">
<p style="color: `+sfflRed+`; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">Event</p>
<p style="color: #0f172a; font-size: 17px; font-weight: 700; margin: 0;">%s</p>
</td>
</tr>
<!-- Date & Venue Row -->
<tr>
<td style="padding: 0 0 14px;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
<tr>
<td width="50%%" style="vertical-align: top;">
<p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">📅 Date</p>
<p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">%s</p>
</td>
<td width="50%%" style="vertical-align: top;">
<p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">📍 Venue</p>
<p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">%s</p>
</td>
</tr>
</table>
</td>
</tr>
<!-- Tier & Quantity Row -->
<tr>
<td style="padding: 0 0 14px;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
<tr>
<td width="50%%" style="vertical-align: top;">
<p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">🎫 Tier</p>
<p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">%s</p>
</td>
<td width="50%%" style="vertical-align: top;">
<p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">👥 Quantity</p>
<p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">%d %s</p>
</td>
</tr>
</table>
</td>
</tr>
<!-- Phone Row -->
<tr>
<td style="padding: 0;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
<tr>
<td width="100%%" style="vertical-align: top;">
<p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">📞 Phone Number</p>
<p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">%s</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

<!-- Ticket Code Section -->
<tr>
<td style="padding: 0 40px 8px;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%%, #1e293b 100%%); border-radius: 12px; overflow: hidden; border: 2px solid `+sfflRed+`;">
<tr>
<td style="padding: 28px; text-align: center;">
<p style="color: `+sfflRed+`; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin: 0 0 10px;">🎫 Your Ticket Code</p>
<p style="color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 4px; margin: 0; font-family: 'Courier New', monospace;">%s</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- Total Amount -->
<tr>
<td style="padding: 16px 40px 0;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="border-top: 2px dashed `+sfflRed+`;">
<tr>
<td style="padding: 16px 0;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
<tr>
<td style="color: #64748b; font-size: 14px;">Total Paid</td>
<td style="text-align: right; color: #0f172a; font-size: 20px; font-weight: 700;">₦%s</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

<!-- Instructions -->
<tr>
<td style="padding: 16px 40px 32px;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid `+sfflRed+`; border-radius: 8px;">
<tr>
<td style="padding: 16px;">
<p style="color: #991b1b; font-size: 13px; line-height: 1.5; margin: 0;">
<strong>⚡ Important:</strong> Please present this ticket code at the entrance on game day. You can also find your ticket on your dashboard.
</p>
</td>
</tr>
</table>
</td>
</tr>

`+brandFooter()+`

</table>
</td>
</tr>
</table>
</body>
</html>`, buyerName, unitDisplay, eventTitle, isAre, eventTitle, eventDate, eventVenue, tierName, quantity, unitDisplay, phone, ticketCode, formatNaira(totalAmount))
}

// CheckinEmailHTML generates a premium check-in confirmation email
func CheckinEmailHTML(eventTitle, eventDate, eventVenue, ticketCode string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IT'S SHOWTIME — You're Checked In</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5; padding: 40px 20px;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

`+brandHeader()+`

<!-- Hero Banner -->
<tr>
<td style="background: linear-gradient(135deg, #065f46 0%%, #047857 50%%, #065f46 100%%); padding: 36px 40px 28px; text-align: center;">
`+checkinBadge()+`
<h1 style="color: #ffffff; font-size: 26px; font-weight: 700; margin: 16px 0 6px;">You're Checked In!</h1>
<p style="color: #a7f3d0; font-size: 14px; margin: 0;">Welcome to the event</p>
</td>
</tr>

<!-- Content -->
<tr>
<td style="padding: 32px 40px;">
<p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
You have been successfully checked in for <strong>%s</strong>. Enjoy the games!
</p>

<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid `+sfflRed+`; border-radius: 12px; overflow: hidden;">
<tr>
<td style="padding: 24px;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
<tr>
<td style="padding: 0 0 12px;">
<p style="color: `+sfflRed+`; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">Event</p>
<p style="color: #14532d; font-size: 16px; font-weight: 700; margin: 0;">%s</p>
</td>
</tr>
<tr>
<td>
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
<tr>
<td width="50%%" style="vertical-align: top;">
<p style="color: #166534; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">📅 Date</p>
<p style="color: #14532d; font-size: 14px; font-weight: 600; margin: 0;">%s</p>
</td>
<td width="50%%" style="vertical-align: top;">
<p style="color: #166534; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">📍 Venue</p>
<p style="color: #14532d; font-size: 14px; font-weight: 600; margin: 0;">%s</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

<!-- Ticket Code Reference -->
<tr>
<td style="padding: 0 40px 32px;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
<tr>
<td style="text-align: center; padding: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; border-top: 3px solid `+sfflRed+`;">
<p style="color: `+sfflRed+`; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">Ticket Code</p>
<p style="color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: 3px; font-family: 'Courier New', monospace; margin: 0;">%s</p>
</td>
</tr>
</table>
</td>
</tr>

`+brandFooter()+`

</table>
</td>
</tr>
</table>
</body>
</html>`, eventTitle, eventTitle, eventDate, eventVenue, ticketCode)
}

// OTPEmailHTML generates a premium OTP email for password resets
func OTPEmailHTML(otpCode string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SFFL — Password Reset Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5; padding: 40px 20px;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

`+brandHeader()+`

<!-- Hero -->
<tr>
<td style="background: linear-gradient(135deg, #0f172a 0%%, #1e293b 100%%); padding: 48px 40px; text-align: center;">
<h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 8px;">Reset Your Password</h1>
<p style="color: `+sfflRed+`; font-size: 14px; font-weight: 600; margin: 0;">PROTECT YOUR ACCOUNT 🛡️</p>
</td>
</tr>

<!-- Content -->
<tr>
<td style="padding: 32px 40px;">
<p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
Hello, we received a request to reset your password. Use the verification code below to proceed. This code will expire in <strong>10 minutes</strong>.
</p>

<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px;">
<tr>
<td style="padding: 32px; text-align: center;">
<p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin: 0 0 12px;">Verification Code</p>
<p style="color: #0f172a; font-size: 42px; font-weight: 800; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">%s</p>
</td>
</tr>
</table>

<p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 24px 0 0;">
If you didn't request this, you can safely ignore this email. Someone may have entered your email address by mistake.
</p>
</td>
</tr>

`+brandFooter()+`

</table>
</td>
</tr>
</table>
</body>
</html>`, otpCode)
}

// formatNaira formats an integer amount to a comma-separated string
func formatNaira(amount int) string {
	s := fmt.Sprintf("%d", amount)
	if len(s) <= 3 {
		return s
	}
	var result []byte
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			result = append(result, ',')
		}
		result = append(result, byte(c))
	}
	return string(result)
}
