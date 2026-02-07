package messagepipe

import "context"

func (es *EmailSender) StoreFlaggedForReview(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) StoreTemporarilySuspended(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) StoreSetup(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) StoreApproved(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) PriceDropAlert(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) LimitedProduct(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) StoreLive(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) StoreSuspended(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) LaunchStore(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}
