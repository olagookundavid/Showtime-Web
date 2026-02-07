package messagepipe

import "context"

func (es *EmailSender) SubscriptionAboutToExpire(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) SuspiciousActivityDetected(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}
