package messagepipe

import "context"

func (es *EmailSender) OrderConfirmed(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) CompleteYourOrder(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) OrderShipped(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) OrderOutForDelivery(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) OrderDelivered(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) ReturnRequestReceived(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) ReturnItem(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) LeaveReview(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) SupportRequest(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) SupportTicketUpdate(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) ConfirmShippingDetails(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) WishlistFull(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) SellerMessage(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) CartWaiting(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) SearchResultsReminder(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) DisputeRaised(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) ActivePlan(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}
