package email

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/resend/resend-go/v3"
)

// AddContact puts a person on the marketing list in Resend. Anyone already on
// the list is left exactly as they are: creating a contact that exists could
// switch an unsubscribed person back on, and honouring an unsubscribe matters
// more than refreshing a name.
func (s *ResendService) AddContact(address, firstName, lastName string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		return nil
	}
	address = strings.ToLower(strings.TrimSpace(address))
	if address == "" {
		return nil
	}

	client := resend.NewClient(apiKey)
	return addContactIfNew(
		func() error {
			return sendPaced(func() error {
				_, err := client.Contacts.Get(&resend.GetContactOptions{Id: address})
				return err
			}, time.Now, time.Sleep)
		},
		func() error {
			return sendPaced(func() error {
				_, err := client.Contacts.Create(&resend.CreateContactRequest{
					Email:     address,
					FirstName: strings.TrimSpace(firstName),
					LastName:  strings.TrimSpace(lastName),
				})
				return err
			}, time.Now, time.Sleep)
		},
	)
}

// addContactIfNew creates the contact only when the lookup says it is not there.
// Any other lookup failure is returned untouched and nothing is created, so a
// hiccup can never overwrite someone who is already on the list.
func addContactIfNew(lookup, create func() error) error {
	err := lookup()
	if err == nil {
		return nil
	}
	if !isNotFound(err) {
		return fmt.Errorf("could not check the contact: %w", err)
	}
	if err := create(); err != nil {
		return fmt.Errorf("could not add the contact: %w", err)
	}
	return nil
}

// isNotFound reads Resend's "contact not found" answer. The SDK has no typed
// error for a 404, so the message is all there is to go on.
func isNotFound(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "not found") || strings.Contains(msg, "404")
}
