// Package message implements testkit's message domain: it maps testkit DTOs to
// message-service protos and back. This is the ONLY package in testkit-service
// that imports both testkitv1 and messagev1 (design spec v2 §3.4) — it is the
// testkit-msg ↔ message-msg mapping boundary. pkg/handler and the testkit proto
// see only testkitv1; the downstream message handler is reached exclusively
// through the messageservice.Service seam held here.
//
// Curation (plan §3.2 + P4 decisions):
//   - SendEmail/SendSMS drop sender_id from the testkit request and inject it
//     from cfg.Message.SenderID instead (decision 1). sender_id is a SERVICE
//     LABEL (the calling business service, e.g. "testkit-service"), NOT a user
//     id — the downstream contract says so explicitly, and idempotency is
//     scoped per (sender_id, idempotency_key) in Redis, so a stable service
//     label gives the intended global-dedup semantics.
//   - List/Stats requests neither expose nor forward a sender_id filter
//     (decision 2): testkit deploys a single sender and the ops console must
//     see records across all senders (including other services' verification
//     mails in the shared DB), so filtering by testkit's own sender_id would
//     hide legitimate records.
//   - Get keeps the resource id (operation target — decision 3).
//   - Enums mirror message-service name-for-name and number-for-number, so
//     every enum conversion is a plain int cast — no string table.
//   - SendResponse splits the downstream oneof vendor into two optional fields
//     (decision 6): email_vendor / sms_vendor (only one non-zero at a time).
//   - EmailRecord/SMSRecord keep full fidelity for ops triage (decision 7).
//
// Downstream xerr.Error is passed through untouched (v2 §9) — never swallowed
// or re-wrapped.
package message

import (
	"context"
	"errors"
	messagingv1 "github.com/servekit/api/gen/go/messaging/v1"

	messagev1 "github.com/servekit/api/gen/go/messaging/v1"
	referencev1 "github.com/servekit/api/gen/go/reference/v1"
	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"
	messageservice "github.com/servekit/message-service/pkg"
	referenceservice "github.com/servekit/reference-service/pkg"
	"github.com/servekit/testkit-service/internal/phone"
)

// Service implements testkit's message domain. The message field is typed as
// the messageservice.Service interface — the in-process wrapper and
// gRPC client both satisfy it; test stubs embed
// messagev1.UnimplementedMessageServiceServer, override the methods under test,
// and add a no-op Close (Task 2).
type Service struct {
	message   messageservice.Service
	reference referenceservice.Service // region-code directory source
	senderID  string                   // injected into downstream Send requests (decision 1)
}

// Option configures a Service.
type Option func(*Service)

// WithSenderID sets the sender_id the BFF injects into Send requests. Required
// in production (service.New fail-fasts on empty cfg.Message.SenderID); the
// option form keeps construction uniform with the other domain constructors.
func WithSenderID(id string) Option { return func(s *Service) { s.senderID = id } }

// WithReference sets the reference-service dependency backing the region-code
// directory. Wired in service init; nil leaves ListRegionCodes erroring
// (fail closed) instead of panicking.
func WithReference(ref referenceservice.Service) Option {
	return func(s *Service) { s.reference = ref }
}

// New constructs the message-domain service. client is the embedded
// message-service handler (messageservice.Service). senderID is
// injected into downstream SendEmail/SendSMS requests.
func New(client messageservice.Service, opts ...Option) *Service {
	s := &Service{message: client}
	for _, o := range opts {
		o(s)
	}
	return s
}

// --- Send (sender_id injected from config) ---

// SendEmail forwards to message-service with sender_id injected from config.
func (s *Service) SendEmail(ctx context.Context, req *testkitv1.SendEmailRequest) (*testkitv1.SendResponse, error) {
	resp, err := s.message.SendEmail(ctx, toMessageSendEmailRequest(req, s.senderID))
	if err != nil {
		return nil, err
	}
	return toTestkitSendResponse(resp), nil
}

// SendSMS forwards to message-service with sender_id injected from config.
func (s *Service) SendSMS(ctx context.Context, req *testkitv1.SendSMSRequest) (*testkitv1.SendResponse, error) {
	resp, err := s.message.SendSMS(ctx, toMessageSendSMSRequest(req, s.senderID))
	if err != nil {
		return nil, err
	}
	return toTestkitSendResponse(resp), nil
}

// --- Get (resource id forwarded) ---

// GetEmail returns one email record by id.
func (s *Service) GetEmail(ctx context.Context, req *testkitv1.GetEmailRequest) (*testkitv1.EmailRecord, error) {
	resp, err := s.message.GetEmail(ctx, toMessageGetEmailRequest(req))
	if err != nil {
		return nil, err
	}
	return toTestkitEmailRecord(resp), nil
}

// GetSMS returns one SMS record by id.
func (s *Service) GetSMS(ctx context.Context, req *testkitv1.GetSMSRequest) (*testkitv1.SMSRecord, error) {
	resp, err := s.message.GetSMS(ctx, toMessageGetSMSRequest(req))
	if err != nil {
		return nil, err
	}
	return toTestkitSMSRecord(resp), nil
}

// --- List paged (no sender_id filter forwarded — decision 2) ---

// ListEmails returns an offset-paginated page of email records.
func (s *Service) ListEmails(ctx context.Context, req *testkitv1.ListEmailsRequest) (*testkitv1.ListEmailsResponse, error) {
	resp, err := s.message.ListEmails(ctx, toMessageListEmailsRequest(req))
	if err != nil {
		return nil, err
	}
	return toTestkitListEmailsResponse(resp), nil
}

// ListSMS returns an offset-paginated page of SMS records.
func (s *Service) ListSMS(ctx context.Context, req *testkitv1.ListSMSRequest) (*testkitv1.ListSMSResponse, error) {
	resp, err := s.message.ListSMS(ctx, toMessageListSMSRequest(req))
	if err != nil {
		return nil, err
	}
	return toTestkitListSMSResponse(resp), nil
}

// --- List cursor (no sender_id filter forwarded) ---

// ListEmailsByCursor returns a cursor-paginated page of email records.
func (s *Service) ListEmailsByCursor(ctx context.Context, req *testkitv1.ListEmailsByCursorRequest) (*testkitv1.ListEmailsByCursorResponse, error) {
	resp, err := s.message.ListEmailsByCursor(ctx, toMessageListEmailsByCursorRequest(req))
	if err != nil {
		return nil, err
	}
	return toTestkitListEmailsByCursorResponse(resp), nil
}

// ListSMSByCursor returns a cursor-paginated page of SMS records.
func (s *Service) ListSMSByCursor(ctx context.Context, req *testkitv1.ListSMSByCursorRequest) (*testkitv1.ListSMSByCursorResponse, error) {
	resp, err := s.message.ListSMSByCursor(ctx, toMessageListSMSByCursorRequest(req))
	if err != nil {
		return nil, err
	}
	return toTestkitListSMSByCursorResponse(resp), nil
}

// --- Stats (no sender_id filter forwarded) ---

// GetEmailStats returns aggregated email statistics with per-vendor breakdown.
func (s *Service) GetEmailStats(ctx context.Context, req *testkitv1.GetEmailStatsRequest) (*testkitv1.EmailStatsResponse, error) {
	resp, err := s.message.GetEmailStats(ctx, toMessageGetEmailStatsRequest(req))
	if err != nil {
		return nil, err
	}
	return toTestkitEmailStatsResponse(resp), nil
}

// GetSMSStats returns aggregated SMS statistics with per-vendor breakdown.
func (s *Service) GetSMSStats(ctx context.Context, req *testkitv1.GetSMSStatsRequest) (*testkitv1.SMSStatsResponse, error) {
	resp, err := s.message.GetSMSStats(ctx, toMessageGetSMSStatsRequest(req))
	if err != nil {
		return nil, err
	}
	return toTestkitSMSStatsResponse(resp), nil
}

// --- Lookups (dropdown sources) ---

// ListEmailSenders returns distinct sender_id values for email filter dropdowns.
func (s *Service) ListEmailSenders(ctx context.Context, _ *testkitv1.ListEmailSendersRequest) (*testkitv1.ListEmailSendersResponse, error) {
	resp, err := s.message.ListEmailSenders(ctx, &messagev1.ListEmailSendersRequest{})
	if err != nil {
		return nil, err
	}
	return &testkitv1.ListEmailSendersResponse{SenderIds: resp.GetSenderIds()}, nil
}

// ListSMSSenders returns distinct sender_id values for SMS filter dropdowns.
func (s *Service) ListSMSSenders(ctx context.Context, _ *testkitv1.ListSMSSendersRequest) (*testkitv1.ListSMSSendersResponse, error) {
	resp, err := s.message.ListSMSSenders(ctx, &messagev1.ListSMSSendersRequest{})
	if err != nil {
		return nil, err
	}
	return &testkitv1.ListSMSSendersResponse{SenderIds: resp.GetSenderIds()}, nil
}

// ListSMSRegions returns distinct region_code values for SMS filter dropdowns.
func (s *Service) ListSMSRegions(ctx context.Context, _ *testkitv1.ListSMSRegionsRequest) (*testkitv1.ListSMSRegionsResponse, error) {
	resp, err := s.message.ListSMSRegions(ctx, &messagev1.ListSMSRegionsRequest{})
	if err != nil {
		return nil, err
	}
	return &testkitv1.ListSMSRegionsResponse{RegionCodes: resp.GetRegionCodes()}, nil
}

// ListRegionCodes forwards the international dial-code directory from
// reference-service (its canonical home) for region pickers. The public
// testkit contract still carries both zh-Hans and en names, so the module
// handler is called twice — in-process and static data, microseconds.
func (s *Service) ListRegionCodes(ctx context.Context, _ *testkitv1.ListRegionCodesRequest) (*testkitv1.ListRegionCodesResponse, error) {
	if s.reference == nil {
		return nil, errors.New("message: reference-service not wired")
	}
	zh, err := s.reference.ListCountries(ctx, &referencev1.ListCountriesRequest{Locale: "zh-Hans"})
	if err != nil {
		return nil, err
	}
	en, err := s.reference.ListCountries(ctx, &referencev1.ListCountriesRequest{Locale: "en"})
	if err != nil {
		return nil, err
	}
	enName := make(map[string]string, len(en.GetCountries()))
	for _, c := range en.GetCountries() {
		enName[c.GetRegionCode()] = c.GetName()
	}
	out := make([]*testkitv1.RegionCode, 0, len(zh.GetCountries()))
	for _, c := range zh.GetCountries() {
		out = append(out, &testkitv1.RegionCode{
			Code:     c.GetRegionCode(),
			DialCode: c.GetDialCode(),
			NameZh:   c.GetName(),
			NameEn:   enName[c.GetRegionCode()],
		})
	}
	return &testkitv1.ListRegionCodesResponse{RegionCodes: out}, nil
}

// --- converters (testkit DTO ↔ message-service proto) ---
//
// Send converters take the configured senderID (decision 1); List/Stats
// converters intentionally omit SenderId (decision 2). Enums are int-cast
// (testkit enums mirror message-service name- and number-for-name).

func toMessageSendEmailRequest(r *testkitv1.SendEmailRequest, senderID string) *messagev1.SendEmailRequest {
	return &messagev1.SendEmailRequest{
		To:             toMessageEmailAddresses(r.GetTo()),
		Cc:             toMessageEmailAddresses(r.GetCc()),
		Bcc:            toMessageEmailAddresses(r.GetBcc()),
		Subject:        r.GetSubject(),
		Body:           r.GetBody(),
		HtmlBody:       r.GetHtmlBody(),
		ReplyTo:        toMessageEmailAddress(r.GetReplyTo()),
		Vendor:         messagev1.EmailVendor(r.GetVendor()),
		Account:        r.GetAccount(),
		TemplateId:     r.GetTemplateId(),
		TemplateParams: r.GetTemplateParams(),
		Scene:          messagev1.EmailScene(r.GetScene()),
		SenderId:       senderID, // decision 1: from config, not the testkit request
		IdempotencyKey: r.GetIdempotencyKey(),
		From:           toMessageEmailAddress(r.GetFrom()),
		Attachments:    toMessageEmailAttachments(r.GetAttachments()),
	}
}

func toMessageSendSMSRequest(r *testkitv1.SendSMSRequest, senderID string) *messagev1.SendSMSRequest {
	return &messagev1.SendSMSRequest{
		To:             phone.ComposeE164(r.GetDialCode(), r.GetPhone()),
		Content:        r.GetContent(),
		TemplateId:     r.GetTemplateId(),
		TemplateParams: r.GetTemplateParams(),
		Vendor:         messagev1.SmsVendor(r.GetVendor()),
		Account:        r.GetAccount(),
		Scene:          messagev1.SmsScene(r.GetScene()),
		SenderId:       senderID, // decision 1
		IdempotencyKey: r.GetIdempotencyKey(),
		SignName:       r.GetSignName(),
	}
}

func toMessageGetEmailRequest(r *testkitv1.GetEmailRequest) *messagev1.GetEmailRequest {
	return &messagev1.GetEmailRequest{Id: r.GetId()}
}

func toMessageGetSMSRequest(r *testkitv1.GetSMSRequest) *messagev1.GetSMSRequest {
	return &messagev1.GetSMSRequest{Id: r.GetId()}
}

func toMessageListEmailsRequest(r *testkitv1.ListEmailsRequest) *messagev1.ListEmailsRequest {
	return &messagev1.ListEmailsRequest{
		Vendor:        messagev1.EmailVendor(r.GetVendor()),
		Scene:         messagev1.EmailScene(r.GetScene()),
		Status:        messagev1.MessageStatus(r.GetStatus()),
		Target:        r.GetTarget(),
		StartTime:     r.GetStartTime(),
		EndTime:       r.GetEndTime(),
		Page:          r.GetPage(),
		PageSize:      r.GetPageSize(),
		SortField:     messagev1.SortField(r.GetSortField()),
		SortDirection: messagev1.SortDirection(r.GetSortDirection()),
		SenderId:      r.GetSenderId(),
	}
}

func toMessageListSMSRequest(r *testkitv1.ListSMSRequest) *messagev1.ListSMSRequest {
	return &messagev1.ListSMSRequest{
		Vendor:        messagev1.SmsVendor(r.GetVendor()),
		Scene:         messagev1.SmsScene(r.GetScene()),
		Status:        messagev1.MessageStatus(r.GetStatus()),
		RegionCode:    r.GetRegionCode(),
		Phone:         r.GetPhone(),
		StartTime:     r.GetStartTime(),
		EndTime:       r.GetEndTime(),
		Page:          r.GetPage(),
		PageSize:      r.GetPageSize(),
		SortField:     messagev1.SortField(r.GetSortField()),
		SortDirection: messagev1.SortDirection(r.GetSortDirection()),
		SenderId:      r.GetSenderId(),
	}
}

func toMessageListEmailsByCursorRequest(r *testkitv1.ListEmailsByCursorRequest) *messagev1.ListEmailsByCursorRequest {
	return &messagev1.ListEmailsByCursorRequest{
		Vendor:        messagev1.EmailVendor(r.GetVendor()),
		Scene:         messagev1.EmailScene(r.GetScene()),
		Status:        messagev1.MessageStatus(r.GetStatus()),
		Target:        r.GetTarget(),
		StartTime:     r.GetStartTime(),
		EndTime:       r.GetEndTime(),
		SortField:     messagev1.SortField(r.GetSortField()),
		SortDirection: messagev1.SortDirection(r.GetSortDirection()),
		PageSize:      r.GetPageSize(),
		PageToken:     r.GetPageToken(),
		IncludeTotal:  r.GetIncludeTotal(),
		SenderId:      r.GetSenderId(),
	}
}

func toMessageListSMSByCursorRequest(r *testkitv1.ListSMSByCursorRequest) *messagev1.ListSMSByCursorRequest {
	return &messagev1.ListSMSByCursorRequest{
		Vendor:        messagev1.SmsVendor(r.GetVendor()),
		Scene:         messagev1.SmsScene(r.GetScene()),
		Status:        messagev1.MessageStatus(r.GetStatus()),
		RegionCode:    r.GetRegionCode(),
		Phone:         r.GetPhone(),
		StartTime:     r.GetStartTime(),
		EndTime:       r.GetEndTime(),
		SortField:     messagev1.SortField(r.GetSortField()),
		SortDirection: messagev1.SortDirection(r.GetSortDirection()),
		PageSize:      r.GetPageSize(),
		PageToken:     r.GetPageToken(),
		IncludeTotal:  r.GetIncludeTotal(),
		SenderId:      r.GetSenderId(),
	}
}

func toMessageGetEmailStatsRequest(r *testkitv1.GetEmailStatsRequest) *messagev1.GetEmailStatsRequest {
	return &messagev1.GetEmailStatsRequest{
		Vendor:    messagev1.EmailVendor(r.GetVendor()),
		Scene:     messagev1.EmailScene(r.GetScene()),
		StartTime: r.GetStartTime(),
		EndTime:   r.GetEndTime(),
	}
}

func toMessageGetSMSStatsRequest(r *testkitv1.GetSMSStatsRequest) *messagev1.GetSMSStatsRequest {
	return &messagev1.GetSMSStatsRequest{
		Vendor:    messagev1.SmsVendor(r.GetVendor()),
		Scene:     messagev1.SmsScene(r.GetScene()),
		StartTime: r.GetStartTime(),
		EndTime:   r.GetEndTime(),
	}
}

// toTestkitSendResponse splits the downstream oneof vendor into two optional
// fields (decision 6). Only one of email_vendor / sms_vendor is set.
func toTestkitSendResponse(r *messagev1.SendResponse) *testkitv1.SendResponse {
	if r == nil {
		return nil
	}
	resp := &testkitv1.SendResponse{
		Id:     r.GetId(),
		Status: messagingv1.MessageStatus(r.GetStatus()),
	}
	switch v := r.GetVendor().(type) {
	case *messagev1.SendResponse_EmailVendor:
		resp.EmailVendor = messagingv1.EmailVendor(v.EmailVendor)
	case *messagev1.SendResponse_SmsVendor:
		resp.SmsVendor = messagingv1.SmsVendor(v.SmsVendor)
	}
	return resp
}

func toTestkitEmailRecord(r *messagev1.EmailRecord) *testkitv1.EmailRecord {
	if r == nil {
		return nil
	}
	return &testkitv1.EmailRecord{
		Id:             r.GetId(),
		Vendor:         messagingv1.EmailVendor(r.GetVendor()),
		Account:        r.GetAccount(),
		Scene:          messagingv1.EmailScene(r.GetScene()),
		Status:         messagingv1.MessageStatus(r.GetStatus()),
		Target:         toTestkitEmailAddress(r.GetTarget()),
		SenderId:       r.GetSenderId(),
		Cc:             toTestkitEmailAddresses(r.GetCc()),
		Bcc:            toTestkitEmailAddresses(r.GetBcc()),
		Subject:        r.GetSubject(),
		Content:        r.GetContent(),
		HtmlBody:       r.GetHtmlBody(),
		ReplyTo:        toTestkitEmailAddress(r.GetReplyTo()),
		TemplateId:     r.GetTemplateId(),
		TemplateParams: r.GetTemplateParams(),
		ErrorMessage:   r.GetErrorMessage(),
		Attempts:       r.GetAttempts(),
		SentAt:         r.GetSentAt(),
		CreatedAt:      r.GetCreatedAt(),
		UpdatedAt:      r.GetUpdatedAt(),
		Attachments:    toTestkitEmailAttachments(r.GetAttachments()),
	}
}

func toTestkitSMSRecord(r *messagev1.SMSRecord) *testkitv1.SMSRecord {
	if r == nil {
		return nil
	}
	return &testkitv1.SMSRecord{
		Id:             r.GetId(),
		Vendor:         messagingv1.SmsVendor(r.GetVendor()),
		Account:        r.GetAccount(),
		Scene:          messagingv1.SmsScene(r.GetScene()),
		Status:         messagingv1.MessageStatus(r.GetStatus()),
		RegionCode:     r.GetRegionCode(),
		Phone:          r.GetPhone(),
		SenderId:       r.GetSenderId(),
		Content:        r.GetContent(),
		TemplateId:     r.GetTemplateId(),
		TemplateParams: r.GetTemplateParams(),
		ErrorMessage:   r.GetErrorMessage(),
		Attempts:       r.GetAttempts(),
		SentAt:         r.GetSentAt(),
		CreatedAt:      r.GetCreatedAt(),
		UpdatedAt:      r.GetUpdatedAt(),
	}
}

func toTestkitListEmailsResponse(r *messagev1.ListEmailsResponse) *testkitv1.ListEmailsResponse {
	if r == nil {
		return nil
	}
	return &testkitv1.ListEmailsResponse{
		Records:    toTestkitEmailRecords(r.GetRecords()),
		Total:      r.GetTotal(),
		TotalPages: r.GetTotalPages(),
		HasMore:    r.GetHasMore(),
	}
}

func toTestkitListSMSResponse(r *messagev1.ListSMSResponse) *testkitv1.ListSMSResponse {
	if r == nil {
		return nil
	}
	return &testkitv1.ListSMSResponse{
		Records:    toTestkitSMSRecords(r.GetRecords()),
		Total:      r.GetTotal(),
		TotalPages: r.GetTotalPages(),
		HasMore:    r.GetHasMore(),
	}
}

func toTestkitListEmailsByCursorResponse(r *messagev1.ListEmailsByCursorResponse) *testkitv1.ListEmailsByCursorResponse {
	if r == nil {
		return nil
	}
	return &testkitv1.ListEmailsByCursorResponse{
		Records:       toTestkitEmailRecords(r.GetRecords()),
		Total:         r.GetTotal(),
		NextPageToken: r.GetNextPageToken(),
	}
}

func toTestkitListSMSByCursorResponse(r *messagev1.ListSMSByCursorResponse) *testkitv1.ListSMSByCursorResponse {
	if r == nil {
		return nil
	}
	return &testkitv1.ListSMSByCursorResponse{
		Records:       toTestkitSMSRecords(r.GetRecords()),
		Total:         r.GetTotal(),
		NextPageToken: r.GetNextPageToken(),
	}
}

func toTestkitEmailStatsResponse(r *messagev1.EmailStatsResponse) *testkitv1.EmailStatsResponse {
	if r == nil {
		return nil
	}
	return &testkitv1.EmailStatsResponse{
		Total:       r.GetTotal(),
		Sent:        r.GetSent(),
		Failed:      r.GetFailed(),
		SuccessRate: r.GetSuccessRate(),
		Vendors:     toTestkitEmailVendorStats(r.GetVendors()),
	}
}

func toTestkitSMSStatsResponse(r *messagev1.SMSStatsResponse) *testkitv1.SMSStatsResponse {
	if r == nil {
		return nil
	}
	return &testkitv1.SMSStatsResponse{
		Total:       r.GetTotal(),
		Sent:        r.GetSent(),
		Failed:      r.GetFailed(),
		SuccessRate: r.GetSuccessRate(),
		Vendors:     toTestkitSmsVendorStats(r.GetVendors()),
	}
}

// --- nested-entity converters ---

func toMessageEmailAddress(a *testkitv1.EmailAddress) *messagev1.EmailAddress {
	if a == nil {
		return nil
	}
	return &messagev1.EmailAddress{Email: a.GetEmail(), DisplayName: a.GetDisplayName()}
}

func toMessageEmailAddresses(as []*testkitv1.EmailAddress) []*messagev1.EmailAddress {
	out := make([]*messagev1.EmailAddress, 0, len(as))
	for _, a := range as {
		out = append(out, toMessageEmailAddress(a))
	}
	return out
}

func toMessageEmailAttachment(a *testkitv1.EmailAttachment) *messagev1.EmailAttachment {
	if a == nil {
		return nil
	}
	return &messagev1.EmailAttachment{
		Filename:  a.GetFilename(),
		Url:       a.GetUrl(),
		Content:   a.GetContent(),
		Inline:    a.GetInline(),
		MimeType:  a.GetMimeType(),
		SizeBytes: a.GetSizeBytes(),
	}
}

func toMessageEmailAttachments(as []*testkitv1.EmailAttachment) []*messagev1.EmailAttachment {
	out := make([]*messagev1.EmailAttachment, 0, len(as))
	for _, a := range as {
		out = append(out, toMessageEmailAttachment(a))
	}
	return out
}

func toTestkitEmailAddress(a *messagev1.EmailAddress) *testkitv1.EmailAddress {
	if a == nil {
		return nil
	}
	return &testkitv1.EmailAddress{Email: a.GetEmail(), DisplayName: a.GetDisplayName()}
}

func toTestkitEmailAddresses(as []*messagev1.EmailAddress) []*testkitv1.EmailAddress {
	out := make([]*testkitv1.EmailAddress, 0, len(as))
	for _, a := range as {
		out = append(out, toTestkitEmailAddress(a))
	}
	return out
}

func toTestkitEmailAttachment(a *messagev1.EmailAttachment) *testkitv1.EmailAttachment {
	if a == nil {
		return nil
	}
	return &testkitv1.EmailAttachment{
		Filename:  a.GetFilename(),
		Url:       a.GetUrl(),
		Content:   a.GetContent(),
		Inline:    a.GetInline(),
		MimeType:  a.GetMimeType(),
		SizeBytes: a.GetSizeBytes(),
	}
}

func toTestkitEmailAttachments(as []*messagev1.EmailAttachment) []*testkitv1.EmailAttachment {
	out := make([]*testkitv1.EmailAttachment, 0, len(as))
	for _, a := range as {
		out = append(out, toTestkitEmailAttachment(a))
	}
	return out
}

func toTestkitEmailRecords(in []*messagev1.EmailRecord) []*testkitv1.EmailRecord {
	out := make([]*testkitv1.EmailRecord, 0, len(in))
	for _, r := range in {
		out = append(out, toTestkitEmailRecord(r))
	}
	return out
}

func toTestkitSMSRecords(in []*messagev1.SMSRecord) []*testkitv1.SMSRecord {
	out := make([]*testkitv1.SMSRecord, 0, len(in))
	for _, r := range in {
		out = append(out, toTestkitSMSRecord(r))
	}
	return out
}

func toTestkitEmailVendorStats(in []*messagev1.EmailVendorStats) []*testkitv1.EmailVendorStats {
	out := make([]*testkitv1.EmailVendorStats, 0, len(in))
	for _, v := range in {
		out = append(out, &testkitv1.EmailVendorStats{
			Vendor: messagingv1.EmailVendor(v.GetVendor()),
			Total:  v.GetTotal(),
			Sent:   v.GetSent(),
			Failed: v.GetFailed(),
		})
	}
	return out
}

func toTestkitSmsVendorStats(in []*messagev1.SmsVendorStats) []*testkitv1.SmsVendorStats {
	out := make([]*testkitv1.SmsVendorStats, 0, len(in))
	for _, v := range in {
		out = append(out, &testkitv1.SmsVendorStats{
			Vendor: messagingv1.SmsVendor(v.GetVendor()),
			Total:  v.GetTotal(),
			Sent:   v.GetSent(),
			Failed: v.GetFailed(),
		})
	}
	return out
}
