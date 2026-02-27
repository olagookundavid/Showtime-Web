package ports

// EmailService defines the interface for sending transactional emails
type EmailService interface {
	SendEmail(to, subject, htmlBody string) error
}
