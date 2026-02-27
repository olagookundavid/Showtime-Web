package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// ResendService handles sending emails via the Resend API
type ResendService struct {
	APIKey string
}

// NewResendService creates a new instance of ResendService
func NewResendService() *ResendService {
	// API key will be provided by environment variable
	apiKey := os.Getenv("RESEND_API_KEY")
	return &ResendService{
		APIKey: apiKey,
	}
}

// SendEmailRequest represents the payload for the Resend API
type SendEmailRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	ReplyTo string   `json:"reply_to,omitempty"`
}

// SendEmail sends an email using the Resend API
func (s *ResendService) SendEmail(to, subject, htmlBody string) error {
	if s.APIKey == "" {
		fmt.Println("⚠️ RESEND_API_KEY not set. Skipping email send:")
		fmt.Printf("To: %s\nSubject: %s\n", to, subject)
		return nil // Don't fail the whole request if email isn't configured yet
	}

	reqBody := SendEmailRequest{
		From:    "Showtime <tickets@showtime.example.com>", // TODO: Update domain once verified
		To:      []string{to},
		Subject: subject,
		HTML:    htmlBody,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal email request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.APIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send email request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("resend API returned status code: %d", resp.StatusCode)
	}

	return nil
}
