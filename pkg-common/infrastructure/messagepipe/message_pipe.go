package messagepipe

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"pkg-common/client"
)

// EmailSender implements the EmailService interface
type EmailSender struct {
	client      *client.Client
	authToken   string
	servicePath string
}

// NewEmailSender creates a new email sender service
func NewEmailSender(baseURL, authToken string) *EmailSender {
	return &EmailSender{
		client:      client.NewClient(baseURL),
		authToken:   authToken,
		servicePath: "/email/send",
	}
}

// WithServicePath allows customizing the service path if needed
func (es *EmailSender) WithServicePath(path string) *EmailSender {
	es.servicePath = path
	return es
}

// SendEmail sends an email using the external service
func (es *EmailSender) SendEmail(ctx context.Context, req *EmailRequest) error {
	// Validate required fields
	if err := es.validateRequest(req); err != nil {
		return fmt.Errorf("invalid email request: %w", err)
	}

	// Prepare headers with x-api-key authentication
	headers := map[string]string{
		"x-api-key": es.authToken,
	}

	var resp EmailResponse
	err := es.client.Do(
		ctx,
		http.MethodPost,
		es.servicePath,
		req,
		&resp,
		headers,
	)

	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil

}

// validateRequest validates the email request
func (es *EmailSender) validateRequest(req *EmailRequest) error {
	if req.TemplateID == "" {
		return fmt.Errorf("templateId is required")
	}
	if req.To == "" {
		return fmt.Errorf("to address is required")
	}
	if req.Subject == "" {
		return fmt.Errorf("subject is required")
	}

	if len(req.To) == 0 {
		return errors.New("email can't be empty")
	}
	if _, err := mail.ParseAddress(req.To); err != nil {
		return fmt.Errorf("invalid email address: %s", req.To)
	}

	return nil
}

// Helper method for sending multiple emails (optional)
func (es *EmailSender) SendBulkEmails(ctx context.Context, requests []*EmailRequest) error {

	for _, req := range requests {
		err := es.SendEmail(ctx, req)
		if err != nil {

			continue
		}

	}
	return nil
}
