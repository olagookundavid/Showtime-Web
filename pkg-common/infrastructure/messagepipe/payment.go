package messagepipe

import "context"

func (es *EmailSender) PaymentIssueDetected(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) IncomingPayout(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) PayoutRequestIssue(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) PaymentUnsuccessful(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) WalletTemporarilyFrozen(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) RefundProcessed(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}
