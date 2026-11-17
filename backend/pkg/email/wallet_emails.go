package email

import "fmt"

// formatKobo renders integer kobo as naira with thousands separators, keeping the
// kobo only when there are any: 150000 -> "1,500", 150050 -> "1,500.50".
func formatKobo(kobo int64) string {
	naira := kobo / 100
	rem := kobo % 100
	if rem < 0 {
		rem = -rem
	}
	s := formatNaira(int(naira))
	if rem == 0 {
		return s
	}
	return fmt.Sprintf("%s.%02d", s, rem)
}

// TopupReceiptEmailHTML is the receipt for a wallet top-up that has been paid.
func TopupReceiptEmailHTML(name string, amountKobo, balanceKobo int64, reference string) string {
	body := `<tr>
<td style="padding: 32px 40px 0;">
<p style="color: #334155; font-size: 16px; font-weight: 700; margin: 0 0 12px;">Hi ` + esc(name) + `,</p>
<p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">Your payment went through and the money is now in your Showtime wallet.</p>
</td>
</tr>

<tr>
<td style="padding: 24px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ` + sfflRed + `; border-radius: 12px; overflow: hidden;">
<tr>
<td style="padding: 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
` + detailRow("Added", "₦"+formatKobo(amountKobo)) + detailRow("Wallet balance", "₦"+formatKobo(balanceKobo)) + `
</tr>
<tr><td colspan="2" style="padding-top: 14px;">
<p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin: 0 0 4px;">Reference</p>
<p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">` + esc(reference) + `</p>
</td></tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="padding: 0 40px 32px;">
<p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0;">Wallet money can be spent inside Showtime. It cannot be withdrawn.</p>
</td>
</tr>`

	return emailShell("IT'S SHOWTIME — Wallet top-up received", "", "Wallet topped up", body)
}
