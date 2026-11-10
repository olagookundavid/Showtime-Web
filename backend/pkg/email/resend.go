package email

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/resend/resend-go/v3"
)

// Resend accepts 10 requests a second per account. Saving a team sheet emails
// every player on it at once, which went over that and lost most of the emails.
// Every send now waits its turn, a little under the limit, and a send that is
// still refused is tried again.
const (
	// sendInterval spaces sends to 8 a second, leaving room for other callers.
	sendInterval = 125 * time.Millisecond
	// rateLimitRetries is how many more times a refused send is tried.
	rateLimitRetries = 4
)

// sendPacer hands out send slots no closer together than sendInterval. It is
// shared by every sender in the process.
type sendPacer struct {
	mu   sync.Mutex
	next time.Time
}

var pacer = &sendPacer{}

// wait blocks until this caller's slot comes round.
func (p *sendPacer) wait(interval time.Duration, now func() time.Time, sleep func(time.Duration)) {
	p.mu.Lock()
	t := now()
	slot := p.next
	if slot.Before(t) {
		slot = t
	}
	p.next = slot.Add(interval)
	p.mu.Unlock()
	if d := slot.Sub(t); d > 0 {
		sleep(d)
	}
}

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

	fromEmail := strings.TrimSpace(os.Getenv("RESEND_FROM_EMAIL"))
	if fromEmail == "" {
		fromEmail = "Showtime Flag Football <showtime@showtimeflag.football>"
	} else if !strings.Contains(fromEmail, "<") {
		fromEmail = fmt.Sprintf("Showtime Flag Football <%s>", fromEmail)
	}

	client := resend.NewClient(apiKey)

	params := &resend.SendEmailRequest{
		From:    fromEmail,
		To:      []string{to},
		Subject: subject,
		Html:    htmlBody,
	}

	err := sendPaced(func() error {
		_, err := client.Emails.Send(params)
		return err
	}, time.Now, time.Sleep)
	if err != nil {
		return fmt.Errorf("failed to send email via sdk: %w", err)
	}
	return nil
}

// sendPaced runs send in its turn, and again after a pause when Resend says it is
// over the rate limit.
func sendPaced(send func() error, now func() time.Time, sleep func(time.Duration)) error {
	var err error
	for attempt := 0; attempt <= rateLimitRetries; attempt++ {
		pacer.wait(sendInterval, now, sleep)
		if err = send(); err == nil || !errors.Is(err, resend.ErrRateLimit) {
			return err
		}
		// Resend's window is one second; wait it out, longer each time.
		sleep(time.Duration(attempt+1) * time.Second)
	}
	return err
}
