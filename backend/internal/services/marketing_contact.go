package services

import (
	"fmt"
	"strings"

	"showtime-backend/internal/ports"
)

// addMarketingContact adds someone to the marketing list in the background. It
// never blocks or fails the signup or purchase it is attached to: if the queue
// is full or Resend is down, the person is simply not added this time.
func addMarketingContact(syncer ports.ContactSyncer, address, firstName, lastName string) {
	if syncer == nil || strings.TrimSpace(address) == "" {
		return
	}
	job := func() {
		if err := syncer.AddContact(address, firstName, lastName); err != nil {
			fmt.Printf("⚠️ WARNING: could not add %s to the marketing list: %s\n", address, err.Error())
		}
	}
	if err := SubmitJob(job); err != nil {
		fmt.Printf("⚠️ WARNING: marketing list queue is full, skipped %s: %s\n", address, err.Error())
	}
}

// splitFullName turns one name field into a first and last name: the first word
// is the first name and the rest is the last name.
func splitFullName(full string) (first, last string) {
	parts := strings.Fields(full)
	if len(parts) == 0 {
		return "", ""
	}
	return parts[0], strings.Join(parts[1:], " ")
}
