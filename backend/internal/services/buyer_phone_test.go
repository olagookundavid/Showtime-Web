package services

import (
	"context"
	"errors"
	"showtime-backend/internal/domain"
	"strings"
	"testing"
)

type fakePhoneSaver struct {
	calls []string // "userID|phone"
	err   error
}

func (f *fakePhoneSaver) SetPhoneIfEmpty(_ context.Context, userID, phone string) error {
	f.calls = append(f.calls, userID+"|"+phone)
	return f.err
}

func strp(s string) *string { return &s }

func TestRememberBuyerPhoneSavesForASignedInBuyer(t *testing.T) {
	saver := &fakePhoneSaver{}
	rememberBuyerPhone(context.Background(), saver, strp("user-1"), "  +234 801 234 5678 ")
	if len(saver.calls) != 1 || saver.calls[0] != "user-1|+234 801 234 5678" {
		t.Fatalf("expected the trimmed number saved for the user, got %v", saver.calls)
	}
}

func TestRememberBuyerPhoneDoesNothingForAGuestOrABlankOrOversizedNumber(t *testing.T) {
	saver := &fakePhoneSaver{}
	ctx := context.Background()

	rememberBuyerPhone(ctx, saver, nil, "0801")           // guest
	rememberBuyerPhone(ctx, saver, strp(""), "0801")      // empty id
	rememberBuyerPhone(ctx, saver, strp("  "), "0801")    // blank id
	rememberBuyerPhone(ctx, saver, strp("user-1"), "   ") // blank phone
	rememberBuyerPhone(ctx, saver, strp("user-1"), "")    // no phone
	rememberBuyerPhone(ctx, saver, strp("user-1"), strings.Repeat("1", maxPhoneLength+1))
	rememberBuyerPhone(ctx, nil, strp("user-1"), "0801") // not wired in

	if len(saver.calls) != 0 {
		t.Fatalf("none of these should save anything, got %v", saver.calls)
	}
}

func TestRememberBuyerPhoneNeverFailsThePurchase(t *testing.T) {
	// A database error must not escape: the buyer has already paid.
	saver := &fakePhoneSaver{err: errors.New("db down")}
	rememberBuyerPhone(context.Background(), saver, strp("user-1"), "0801")
	if len(saver.calls) != 1 {
		t.Fatal("it should still have tried")
	}
}

func TestOnTicketPaidRemembersTheBuyersPhone(t *testing.T) {
	saver := &fakePhoneSaver{}
	svc := &TicketService{userPhones: saver}
	svc.OnTicketPaid(context.Background(), ticketFor("user-9", "0802 000 0000"))
	if len(saver.calls) != 1 || saver.calls[0] != "user-9|0802 000 0000" {
		t.Fatalf("a paid ticket should keep its buyer's phone, got %v", saver.calls)
	}

	// A team-issued or gifted ticket has no account behind it.
	saver.calls = nil
	svc.OnTicketPaid(context.Background(), ticketFor("", "0802"))
	if len(saver.calls) != 0 {
		t.Fatalf("a ticket without a user must not save a phone, got %v", saver.calls)
	}
}

func ticketFor(userID, phone string) *domain.Ticket {
	t := &domain.Ticket{Phone: phone}
	if userID != "" {
		t.UserID = &userID
	}
	return t
}
