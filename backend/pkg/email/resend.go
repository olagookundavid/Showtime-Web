package email

import (
	"fmt"
	"os"

	"github.com/resend/resend-go/v3"
)

// ResendService handles sending emails via the Resend API using official SDK
type ResendService struct {
	client *resend.Client
}

// NewResendService creates a new instance of ResendService
func NewResendService() *ResendService {
	apiKey := os.Getenv("RESEND_API_KEY")
	client := resend.NewClient(apiKey)
	return &ResendService{
		client: client,
	}
}

// SendEmail sends an email using the Resend API via official SDK
func (s *ResendService) SendEmail(to, subject, htmlBody string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		fmt.Println("⚠️ RESEND_API_KEY not set — skipping outbound email")
		return nil
	}

	fromEmail := os.Getenv("RESEND_FROM_EMAIL")
	if fromEmail == "" {
		fromEmail = "Showtime <showtime@showtimeflag.football>"
	}

	client := resend.NewClient(apiKey)

	params := &resend.SendEmailRequest{
		From:    fromEmail,
		To:      []string{to},
		Subject: subject,
		Html:    htmlBody,
	}

	_, err := client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("failed to send email via sdk: %w", err)
	}

	return nil
}
