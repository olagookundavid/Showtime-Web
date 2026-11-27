package email

import (
	"fmt"
	"strings"
)

// VoucherEmailItem is one line of what a voucher covers.
type VoucherEmailItem struct {
	Name string
	Qty  int
}

// VoucherEmailData is everything the voucher email shows. Dates are already
// formatted for reading, e.g. "Sat 21 Nov 2026".
type VoucherEmailData struct {
	// Greeting names whoever the email is going to; it may be the holder or the buyer.
	Greeting   string
	HolderName string
	// GiftedBy is the buyer when the voucher was bought for someone else; empty otherwise.
	GiftedBy    string
	VoucherName string
	Code        string
	Items       []VoucherEmailItem
	// PriceKobo is what the bundle costs, or the amount of a price voucher. It is
	// shown even when the voucher is a free gift, so people can see what it is worth.
	PriceKobo int64
	// IsValue marks a price voucher: a set amount taken off the bill, with no items.
	IsValue bool
	// Description says what a price voucher can be used for.
	Description string
	ValidFrom   string
	ValidTo     string
	// Free is true for a voucher an admin issued, so the email doesn't talk about payment.
	Free bool
}

// VoucherURL is the page that shows a voucher's QR code.
func VoucherURL(code string) string {
	return assetBaseURL + "/vouchers/" + code
}

func voucherCodeBlock(code string) string {
	return `<tr>
<td style="padding: 0 40px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; overflow: hidden; border: 2px solid ` + sfflRed + `;">
<tr>
<td style="padding: 28px; text-align: center;">
<p style="color: ` + sfflRed + `; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin: 0 0 10px;">Voucher code</p>
<p style="color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: 3px; margin: 0; font-family: 'Courier New', monospace;">` + esc(code) + `</p>
</td>
</tr>
</table>
</td>
</tr>`
}

// voucherWhatBlock is the "what this covers" part: a list of items for a bundle,
// or the amount and its description for a price voucher.
func voucherWhatBlock(d VoucherEmailData) string {
	if d.IsValue {
		desc := ""
		if strings.TrimSpace(d.Description) != "" {
			desc = `<p style="color: #334155; font-size: 14px; line-height: 1.5; margin: 6px 0 0;">` + esc(d.Description) + `</p>`
		}
		return `<p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 8px;">` + esc(d.VoucherName) + `</p>
<p style="color: #1e293b; font-size: 30px; font-weight: 800; margin: 0;">&#8358;` + formatKobo(d.PriceKobo) + `</p>` + desc
	}

	var items strings.Builder
	for _, it := range d.Items {
		fmt.Fprintf(&items, `<p style="color: #1e293b; font-size: 15px; font-weight: 600; margin: 0 0 6px;">%d &times; %s</p>`, it.Qty, esc(it.Name))
	}
	return `<p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 8px;">` + esc(d.VoucherName) + ` covers</p>
` + items.String()
}

// VoucherEmailHTML is the voucher and its receipt: what it covers and what it is
// worth, who it is for, the dates it works on, and a link to the page with the QR
// code to show at the bar.
func VoucherEmailHTML(d VoucherEmailData) string {
	dates := d.ValidFrom
	if d.ValidTo != "" && d.ValidTo != d.ValidFrom {
		dates = d.ValidFrom + " to " + d.ValidTo
	}

	intro := "Here is your voucher for <strong>" + esc(d.HolderName) + "</strong>."
	switch {
	case d.Free:
		intro = "You have been given a voucher. It is for <strong>" + esc(d.HolderName) + "</strong>."
	case d.GiftedBy != "":
		intro = "<strong>" + esc(d.GiftedBy) + "</strong> bought you a voucher. It is for <strong>" + esc(d.HolderName) + "</strong>."
	}

	// A bundle shows its price as a row of its own; a price voucher already shows
	// its amount as the headline.
	valueRow := ""
	if !d.IsValue && d.PriceKobo > 0 {
		valueRow = `<tr><td colspan="2" style="padding-top: 12px;">
<p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">Value</p>
<p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">&#8358;` + formatKobo(d.PriceKobo) + `</p>
</td></tr>`
	}

	body := `<tr>
<td style="padding: 32px 40px 0;">
<p style="color: #334155; font-size: 16px; font-weight: 700; margin: 0 0 12px;">Hi ` + esc(d.Greeting) + `,</p>
<p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">` + intro + `</p>
</td>
</tr>

<tr><td style="padding: 24px 40px 16px;">&nbsp;</td></tr>
` + voucherCodeBlock(d.Code) + `

<tr>
<td style="padding: 16px 40px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ` + sfflRed + `; border-radius: 12px; overflow: hidden;">
<tr>
<td style="padding: 24px;">
` + voucherWhatBlock(d) + `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 14px;">
<tr>
` + detailRow("For", d.HolderName) + detailRow("Valid", dates) + `
</tr>
` + valueRow + `
</table>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="padding: 0 40px 24px; text-align: center;">
<a href="` + esc(VoucherURL(d.Code)) + `" style="display: inline-block; background-color: ` + sfflRed + `; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 10px;">Open voucher and QR code</a>
</td>
</tr>

<tr>
<td style="padding: 0 40px 32px;">
<p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0;">Show the QR code or the code above at the bar on a valid date. It can be used once, only by ` + esc(d.HolderName) + `, so the bar may ask who you are.</p>
</td>
</tr>`

	return emailShell("IT'S SHOWTIME — Your voucher", "", "Your voucher", body)
}
