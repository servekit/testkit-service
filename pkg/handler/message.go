// P4 message RPCs: email/SMS send + record lists — thin delegates to internal/service/message.
package handler

import (
	"context"

	messagingv1 "github.com/servekit/api/gen/go/messaging/v1"
	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"

	"google.golang.org/protobuf/types/known/emptypb"
)

// --- Message-domain RPCs (P4: send + records + stats + lookups) ---
//
// Thin delegates to the message domain (internal/service/message). The
// handler holds no message logic. App credentials are injected from
// cfg.Message.AppKey/AppSecret inside the domain's Send methods; List/Stats
// forward the app_key filter as given.

// SendEmail sends a policy-driven email (app credentials from config).
func (h *Handler) SendEmail(ctx context.Context, req *testkitv1.SendEmailRequest) (*testkitv1.SendResponse, error) {
	return h.svc.Message().SendEmail(ctx, req)
}

// SendSMS sends a policy-driven SMS (app credentials from config).
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

func (h *Handler) ListRegionCodes(ctx context.Context, req *testkitv1.ListRegionCodesRequest) (*testkitv1.ListRegionCodesResponse, error) {
	return h.svc.Message().ListRegionCodes(ctx, req)
}

// --- Message admin RPCs (platform resources; 1:1 forwards, messaging.v1
// payloads imported directly by the testkit proto) ---

// MessageCreateApp registers a calling app; plaintext secret returned once.
func (h *Handler) MessageCreateApp(ctx context.Context, req *messagingv1.CreateAppRequest) (*messagingv1.CreateAppResponse, error) {
	return h.svc.Message().CreateApp(ctx, req)
}

// MessageGetApp returns one app by id.
func (h *Handler) MessageGetApp(ctx context.Context, req *messagingv1.GetAppRequest) (*messagingv1.GetAppResponse, error) {
	return h.svc.Message().GetApp(ctx, req)
}

// MessageUpdateApp tweaks app metadata.
func (h *Handler) MessageUpdateApp(ctx context.Context, req *messagingv1.UpdateAppRequest) (*messagingv1.UpdateAppResponse, error) {
	return h.svc.Message().UpdateApp(ctx, req)
}

// MessageRotateAppSecret invalidates the current secret; new plaintext once.
func (h *Handler) MessageRotateAppSecret(ctx context.Context, req *messagingv1.RotateAppSecretRequest) (*messagingv1.RotateAppSecretResponse, error) {
	return h.svc.Message().RotateAppSecret(ctx, req)
}

// MessageListApps returns all apps.
func (h *Handler) MessageListApps(ctx context.Context, req *messagingv1.ListAppsRequest) (*messagingv1.ListAppsResponse, error) {
	return h.svc.Message().ListApps(ctx, req)
}

// MessageDeleteApp soft-deletes an app.
func (h *Handler) MessageDeleteApp(ctx context.Context, req *messagingv1.DeleteAppRequest) (*emptypb.Empty, error) {
	return h.svc.Message().DeleteApp(ctx, req)
}

// MessageCreateChannelAccount adds a vendor account to the pool.
func (h *Handler) MessageCreateChannelAccount(ctx context.Context, req *messagingv1.CreateChannelAccountRequest) (*messagingv1.CreateChannelAccountResponse, error) {
	return h.svc.Message().CreateChannelAccount(ctx, req)
}

// MessageUpdateChannelAccount edits remark/disabled or replaces credentials.
func (h *Handler) MessageUpdateChannelAccount(ctx context.Context, req *messagingv1.UpdateChannelAccountRequest) (*messagingv1.UpdateChannelAccountResponse, error) {
	return h.svc.Message().UpdateChannelAccount(ctx, req)
}

// MessageDeleteChannelAccount soft-deletes an account from the pool.
func (h *Handler) MessageDeleteChannelAccount(ctx context.Context, req *messagingv1.DeleteChannelAccountRequest) (*emptypb.Empty, error) {
	return h.svc.Message().DeleteChannelAccount(ctx, req)
}

// MessageListChannelAccounts returns the full pool (secrets masked).
func (h *Handler) MessageListChannelAccounts(ctx context.Context, req *messagingv1.ListChannelAccountsRequest) (*messagingv1.ListChannelAccountsResponse, error) {
	return h.svc.Message().ListChannelAccounts(ctx, req)
}

// MessageCreateSignature registers a signature with its account bindings.
func (h *Handler) MessageCreateSignature(ctx context.Context, req *messagingv1.CreateSignatureRequest) (*messagingv1.CreateSignatureResponse, error) {
	return h.svc.Message().CreateSignature(ctx, req)
}

// MessageUpdateSignature replaces remark/disabled/bindings.
func (h *Handler) MessageUpdateSignature(ctx context.Context, req *messagingv1.UpdateSignatureRequest) (*messagingv1.UpdateSignatureResponse, error) {
	return h.svc.Message().UpdateSignature(ctx, req)
}

// MessageDeleteSignature soft-deletes a signature.
func (h *Handler) MessageDeleteSignature(ctx context.Context, req *messagingv1.DeleteSignatureRequest) (*emptypb.Empty, error) {
	return h.svc.Message().DeleteSignature(ctx, req)
}

// MessageListSignatures returns all signatures with bindings.
func (h *Handler) MessageListSignatures(ctx context.Context, req *messagingv1.ListSignaturesRequest) (*messagingv1.ListSignaturesResponse, error) {
	return h.svc.Message().ListSignatures(ctx, req)
}

// MessageCreateTemplate registers a template definition.
func (h *Handler) MessageCreateTemplate(ctx context.Context, req *messagingv1.CreateTemplateRequest) (*messagingv1.CreateTemplateResponse, error) {
	return h.svc.Message().CreateTemplate(ctx, req)
}

// MessageUpdateTemplate fully replaces a template definition.
func (h *Handler) MessageUpdateTemplate(ctx context.Context, req *messagingv1.UpdateTemplateRequest) (*messagingv1.UpdateTemplateResponse, error) {
	return h.svc.Message().UpdateTemplate(ctx, req)
}

// MessageDeleteTemplate soft-deletes a template.
func (h *Handler) MessageDeleteTemplate(ctx context.Context, req *messagingv1.DeleteTemplateRequest) (*emptypb.Empty, error) {
	return h.svc.Message().DeleteTemplate(ctx, req)
}

// MessageListTemplates filters by app (0 = all) and channel (0 = all).
func (h *Handler) MessageListTemplates(ctx context.Context, req *messagingv1.ListTemplatesRequest) (*messagingv1.ListTemplatesResponse, error) {
	return h.svc.Message().ListTemplates(ctx, req)
}

// MessageCreatePolicy binds (app, channel, scene) to template + routes.
func (h *Handler) MessageCreatePolicy(ctx context.Context, req *messagingv1.CreatePolicyRequest) (*messagingv1.CreatePolicyResponse, error) {
	return h.svc.Message().CreatePolicy(ctx, req)
}

// MessageUpdatePolicy fully replaces template + route chains.
func (h *Handler) MessageUpdatePolicy(ctx context.Context, req *messagingv1.UpdatePolicyRequest) (*messagingv1.UpdatePolicyResponse, error) {
	return h.svc.Message().UpdatePolicy(ctx, req)
}

// MessageDeletePolicy removes the binding; sends fail closed from then on.
func (h *Handler) MessageDeletePolicy(ctx context.Context, req *messagingv1.DeletePolicyRequest) (*emptypb.Empty, error) {
	return h.svc.Message().DeletePolicy(ctx, req)
}

// MessageListPolicies filters by app (0 = all) and channel (0 = all).
func (h *Handler) MessageListPolicies(ctx context.Context, req *messagingv1.ListPoliciesRequest) (*messagingv1.ListPoliciesResponse, error) {
	return h.svc.Message().ListPolicies(ctx, req)
}
