package services

import (
	"context"
	"fmt"
	"strings"
)

// UserPhoneSaver saves a phone number on a signed-in user's profile when the
// profile has none. It is implemented by the auth repository.
type UserPhoneSaver interface {
	SetPhoneIfEmpty(ctx context.Context, userID, phone string) error
}

// maxPhoneLength is the profile column's width (users.phone is VARCHAR(50)).
const maxPhoneLength = 50

// rememberBuyerPhone keeps the phone number a signed-in buyer typed at checkout,
// so the next checkout (tickets or store) is prefilled from their profile instead
// of asking again.
//
// It only ever fills a blank. A number already on the profile is the buyer's own
// choice, and one typed at checkout (a friend's, a work phone) must not replace
// it. It does nothing for a guest. It is best effort: a failure here is logged and
// never fails or delays the purchase it follows.
func rememberBuyerPhone(ctx context.Context, saver UserPhoneSaver, userID *string, phone string) {
	if saver == nil || userID == nil || strings.TrimSpace(*userID) == "" {
		return
	}
	phone = strings.TrimSpace(phone)
	if phone == "" || len(phone) > maxPhoneLength {
		return
	}
	if err := saver.SetPhoneIfEmpty(ctx, *userID, phone); err != nil {
		fmt.Printf("⚠️ WARNING: could not save the buyer's phone to their profile: %s\n", err.Error())
	}
}
