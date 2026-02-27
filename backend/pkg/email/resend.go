package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// ResendService handles sending emails via the Resend API
type ResendService struct {
	APIKey string
}

// NewResendService creates a new instance of ResendService
func NewResendService() *ResendService {
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
		fmt.Printf("⚠️ RESEND_API_KEY not set. Skipping email to: %s | Subject: %s\n", to, subject)
		return nil
	}

	fromEmail := os.Getenv("RESEND_FROM_EMAIL")
	if fromEmail == "" {
		fromEmail = "Showtime <showtime@sffl.football>"
	}

	reqBody := SendEmailRequest{
		From:    fromEmail,
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
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend API error (status %d): %s", resp.StatusCode, string(body))
	}

	fmt.Printf("✅ Email sent successfully to %s\n", to)
	return nil
}
