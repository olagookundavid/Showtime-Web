package services

import (
	"context"
	"fmt"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/pkg/email"
)

const (
	// A reminder goes out at reminderHour Lagos time, reminderDaysBefore days
	// ahead of the match day.
	reminderDaysBefore = 1
	reminderHour       = 9

	// reminderBatch bounds how many emails one worker tick sends, to stay well
	// inside the mail provider's rate limits.
	reminderBatch = 50
	// reminderMaxAttempts is how many times a reminder is tried before it is given
	// up on and left FAILED for someone to look at.
	reminderMaxAttempts = 5
	// A row left SENDING this long belongs to a worker that died.
	reminderStuckAfter = 15 * time.Minute
)

// reminderSendAt is when the reminder for a match day should go out.
func reminderSendAt(matchDay time.Time) time.Time {
	return time.Date(matchDay.Year(), matchDay.Month(), matchDay.Day()-reminderDaysBefore, reminderHour, 0, 0, 0, lagos())
}

// scheduleReminders queues one reminder per match day on the ticket. A reminder
// whose time has already passed (a purchase made the night before) is skipped:
// the confirmation email already covers it.
func (s *TicketService) scheduleReminders(ctx context.Context, ticket *domain.Ticket) {
	if s.scheduledRepo == nil || ticket.Email == "" {
		return
	}
	now := time.Now()
	for _, d := range ticket.Days {
		if d.ID == "" || d.Date.IsZero() {
			continue
		}
		sendAt := reminderSendAt(d.Date)
		if !sendAt.After(now) {
			continue
		}
		dayID := d.ID
		err := s.scheduledRepo.Schedule(ctx, &domain.ScheduledEmail{
			Kind:        domain.ScheduledEmailDayReminder,
			TicketID:    ticket.ID,
			TicketDayID: &dayID,
			ToEmail:     ticket.Email,
			SendAt:      sendAt,
			DedupeKey:   fmt.Sprintf("%s:%s", domain.ScheduledEmailDayReminder, d.ID),
		})
		if err != nil {
			fmt.Printf("⚠️ WARNING: failed to schedule reminder for ticket %s day %s: %s\n", ticket.ID, d.ID, err.Error())
		}
	}
}

// ProcessDueReminders is the cron entry point. It sends whatever reminders are
// due, re-checking each against the ticket as it is now: a ticket cancelled or
// expired since the reminder was queued, or a day already attended, is dropped
// rather than emailed.
func (s *TicketService) ProcessDueReminders(ctx context.Context) error {
	if s.scheduledRepo == nil || s.email == nil {
		return nil
	}
	if n, err := s.scheduledRepo.RecoverStuck(ctx, reminderStuckAfter); err != nil {
		return fmt.Errorf("failed to recover stuck reminders: %w", err)
	} else if n > 0 {
		fmt.Printf("Returned %d stuck reminder(s) to the queue\n", n)
	}

	due, err := s.scheduledRepo.ClaimDue(ctx, reminderBatch)
	if err != nil {
		return fmt.Errorf("failed to claim due reminders: %w", err)
	}
	for _, e := range due {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		s.sendReminder(ctx, e)
	}
	return nil
}

func (s *TicketService) sendReminder(ctx context.Context, e domain.ScheduledEmail) {
	cancel := func(reason string) {
		if err := s.scheduledRepo.MarkCancelled(ctx, e.ID, reason); err != nil {
			fmt.Printf("⚠️ WARNING: failed to cancel reminder %s: %s\n", e.ID, err.Error())
		}
	}

	ticket, err := s.ticketRepo.GetByID(ctx, e.TicketID)
	if err != nil {
		cancel("ticket not found")
		return
	}
	if ticket.Status != domain.TicketStatusPaid {
		cancel(fmt.Sprintf("ticket is %s", ticket.Status))
		return
	}

	var day *domain.TicketDay
	number := 0
	for i := range ticket.Days {
		if e.TicketDayID != nil && ticket.Days[i].ID == *e.TicketDayID {
			day = &ticket.Days[i]
			number = i + 1
		}
	}
	if day == nil {
		cancel("match day no longer on the ticket")
		return
	}
	if day.CheckedInAt != nil {
		cancel("already checked in")
		return
	}
	if day.Date.IsZero() || dateOnly(day.Date).Before(todayLagos(time.Now())) {
		cancel("match day has passed")
		return
	}

	total := 0
	if ticket.PurchaseType == domain.PurchaseTypeGamePass {
		total = len(ticket.Days)
	}
	subject := fmt.Sprintf("IT'S SHOWTIME 🏈, Reminder: %s on %s", day.Title, day.Date.Format("Mon 2 Jan"))
	body := email.DayReminderEmailHTML(email.ReminderEmailData{
		BuyerName:   ticket.Name,
		ProductName: ticket.ProductName,
		TicketCode:  ticket.TicketCode,
		Quantity:    ticket.Quantity,
		Day:         formatDay(*day),
		TotalDays:   total,
		DayNumber:   number,
	})

	if err := s.email.SendEmail(e.ToEmail, subject, body); err != nil {
		var retryAt *time.Time
		if e.Attempts < reminderMaxAttempts {
			t := time.Now().Add(time.Duration(e.Attempts) * 10 * time.Minute)
			retryAt = &t
		}
		if mErr := s.scheduledRepo.MarkFailed(ctx, e.ID, err.Error(), retryAt); mErr != nil {
			fmt.Printf("⚠️ WARNING: failed to record reminder failure %s: %s\n", e.ID, mErr.Error())
		}
		return
	}
	if err := s.scheduledRepo.MarkSent(ctx, e.ID); err != nil {
		fmt.Printf("⚠️ WARNING: reminder %s was sent but not recorded: %s\n", e.ID, err.Error())
	}
}
