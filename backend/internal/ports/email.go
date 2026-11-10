package ports

// EmailService defines the interface for sending transactional emails
type EmailService interface {
	SendEmail(to, subject, htmlBody string) error
}

// ContactSyncer puts a person on the marketing list. It never re-subscribes
// someone who is already on it, so an unsubscribe is always honoured.
type ContactSyncer interface {
	AddContact(email, firstName, lastName string) error
}
