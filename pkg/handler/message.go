// P4 message RPCs: email/SMS send + record lists — thin delegates to internal/service/message.
package handler

import (
	"context"

	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
)

// --- Message-domain RPCs (P4: send + records + stats + lookups) ---
//
// Thin delegates to the message domain (internal/service/message). The handler
// holds no message logic. sender_id is injected from cfg.Message.SenderID
// inside the domain's Send converters (decision 1); List/Stats forward no
// sender_id filter (decision 2).

// SendEmail sends an email (sender_id injected from config).
func (h *Handler) SendEmail(ctx context.Context, req *testkitv1.SendEmailRequest) (*testkitv1.SendResponse, error) {
	return h.svc.Message().SendEmail(ctx, req)
}

// SendSMS sends an SMS (sender_id injected from config).
func (h *Handler) SendSMS(ctx context.Context, req *testkitv1.SendSMSRequest) (*testkitv1.SendResponse, error) {
	return h.svc.Message().SendSMS(ctx, req)
}

// GetEmail returns a single email record by id.
func (h *Handler) GetEmail(ctx context.Context, req *testkitv1.GetEmailRequest) (*testkitv1.EmailRecord, error) {
	return h.svc.Message().GetEmail(ctx, req)
}

// ListEmails returns an offset-paginated page of email records.
func (h *Handler) ListEmails(ctx context.Context, req *testkitv1.ListEmailsRequest) (*testkitv1.ListEmailsResponse, error) {
	return h.svc.Message().ListEmails(ctx, req)
}

// ListEmailsByCursor returns a cursor-paginated page of email records.
func (h *Handler) ListEmailsByCursor(ctx context.Context, req *testkitv1.ListEmailsByCursorRequest) (*testkitv1.ListEmailsByCursorResponse, error) {
	return h.svc.Message().ListEmailsByCursor(ctx, req)
}

// GetEmailStats returns aggregated email statistics with per-vendor breakdown.
func (h *Handler) GetEmailStats(ctx context.Context, req *testkitv1.GetEmailStatsRequest) (*testkitv1.EmailStatsResponse, error) {
	return h.svc.Message().GetEmailStats(ctx, req)
}

// ListEmailSenders returns distinct sender_id values for email filter dropdowns.
func (h *Handler) ListEmailSenders(ctx context.Context, req *testkitv1.ListEmailSendersRequest) (*testkitv1.ListEmailSendersResponse, error) {
	return h.svc.Message().ListEmailSenders(ctx, req)
}

// GetSMS returns a single SMS record by id.
func (h *Handler) GetSMS(ctx context.Context, req *testkitv1.GetSMSRequest) (*testkitv1.SMSRecord, error) {
	return h.svc.Message().GetSMS(ctx, req)
}

// ListSMS returns an offset-paginated page of SMS records.
func (h *Handler) ListSMS(ctx context.Context, req *testkitv1.ListSMSRequest) (*testkitv1.ListSMSResponse, error) {
	return h.svc.Message().ListSMS(ctx, req)
}

// ListSMSByCursor returns a cursor-paginated page of SMS records.
func (h *Handler) ListSMSByCursor(ctx context.Context, req *testkitv1.ListSMSByCursorRequest) (*testkitv1.ListSMSByCursorResponse, error) {
	return h.svc.Message().ListSMSByCursor(ctx, req)
}

// GetSMSStats returns aggregated SMS statistics with per-vendor breakdown.
func (h *Handler) GetSMSStats(ctx context.Context, req *testkitv1.GetSMSStatsRequest) (*testkitv1.SMSStatsResponse, error) {
	return h.svc.Message().GetSMSStats(ctx, req)
}

// ListSMSRegions returns distinct region_code values for SMS filter dropdowns.
func (h *Handler) ListSMSRegions(ctx context.Context, req *testkitv1.ListSMSRegionsRequest) (*testkitv1.ListSMSRegionsResponse, error) {
	return h.svc.Message().ListSMSRegions(ctx, req)
}

// ListSMSSenders returns distinct sender_id values for SMS filter dropdowns.
func (h *Handler) ListSMSSenders(ctx context.Context, req *testkitv1.ListSMSSendersRequest) (*testkitv1.ListSMSSendersResponse, error) {
	return h.svc.Message().ListSMSSenders(ctx, req)
}
