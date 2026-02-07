package messagepipe

import "context"

func (es *EmailSender) SignIn(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) VerificationDocumentsReceived(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) AdminAccessApproved(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) ReturnRequestNotApproved(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) VerifyEmail(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) KYCRejected(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) ResetAccountPassword(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) EmailAddressConfirmation(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}

func (es *EmailSender) ManagerInvitation(ctx context.Context, payload *EmailRequest) error {
	emailReq := &EmailRequest{
		TemplateID: payload.TemplateID,
		To:         payload.To,
		Subject:    payload.Subject,
		Variables:  buildVars(payload),
	}
	return es.SendEmail(ctx, emailReq)
}
