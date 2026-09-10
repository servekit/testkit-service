package message_test

import (
	"context"
	"errors"
	messagingv1 "github.com/servekit/api/gen/go/messaging/v1"
	storagev1 "github.com/servekit/api/gen/go/storage/v1"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

	messagev1 "github.com/servekit/api/gen/go/messaging/v1"
	referencev1 "github.com/servekit/api/gen/go/reference/v1"
	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"
	"github.com/servekit/go-common/tenantctx"
	"github.com/servekit/testkit-service/internal/service/message"
)

// stubServer embeds messagev1.UnimplementedMessageServiceServer so it satisfies
// the full messagev1.MessageServiceServer seam (the interface message.Service
// holds) with zero boilerplate. Each RPC under test is overridden: the override
// captures the request for assertion and returns a preset (resp, err). Unset
// methods fall through to Unimplemented (NotImplemented), proving a method was
// reached only when its field is set.
type stubServer struct {
	messagev1.UnimplementedMessageServiceServer
	messagev1.UnimplementedMessageAdminServiceServer

	// Send
	sendEmailCtx  context.Context
	sendEmailReq  *messagev1.SendEmailRequest
	sendEmailResp *messagev1.SendResponse
	sendEmailErr  error
	sendSMSCtx    context.Context
	sendSMSReq    *messagev1.SendSMSRequest
	sendSMSResp   *messagev1.SendResponse
	sendSMSErr    error
	// Get
	getEmailReq  *messagev1.GetEmailRequest
	getEmailResp *messagev1.EmailRecord
	getEmailErr  error
	getSMSReq    *messagev1.GetSMSRequest
	getSMSResp   *messagev1.SMSRecord
	getSMSErr    error
	// List paged
	listEmailsReq  *messagev1.ListEmailsRequest
	listEmailsResp *messagev1.ListEmailsResponse
	listEmailsErr  error
	listSMSReq     *messagev1.ListSMSRequest
	listSMSResp    *messagev1.ListSMSResponse
	listSMSErr     error
	// List cursor
	listEmailsByCursorReq  *messagev1.ListEmailsByCursorRequest
	listEmailsByCursorResp *messagev1.ListEmailsByCursorResponse
	listEmailsByCursorErr  error
	listSMSByCursorReq     *messagev1.ListSMSByCursorRequest
	listSMSByCursorResp    *messagev1.ListSMSByCursorResponse
	listSMSByCursorErr     error
	// Stats
	getEmailStatsReq  *messagev1.GetEmailStatsRequest
	getEmailStatsResp *messagev1.EmailStatsResponse
	getEmailStatsErr  error
	getSMSStatsReq    *messagev1.GetSMSStatsRequest
	getSMSStatsResp   *messagev1.SMSStatsResponse
	getSMSStatsErr    error
	// Lookups
	listEmailSendersErr error
	listSMSSendersErr   error
	listSMSRegionsReq   *messagev1.ListSMSRegionsRequest
	listSMSRegionsResp  *messagev1.ListSMSRegionsResponse
	listSMSRegionsErr   error

	// Admin creates (phase ④ T5 clamp tests)
	createChannelAccountReq  *messagev1.CreateChannelAccountRequest
	createChannelAccountResp *messagev1.CreateChannelAccountResponse
	createSignatureReq       *messagev1.CreateSignatureRequest
	createSignatureResp      *messagev1.CreateSignatureResponse
	createAppReq             *messagev1.CreateAppRequest
	createAppResp            *messagev1.CreateAppResponse
}

func (s *stubServer) CreateChannelAccount(_ context.Context, req *messagev1.CreateChannelAccountRequest) (*messagev1.CreateChannelAccountResponse, error) {
	s.createChannelAccountReq = req
	return s.createChannelAccountResp, nil
}

func (s *stubServer) CreateSignature(_ context.Context, req *messagev1.CreateSignatureRequest) (*messagev1.CreateSignatureResponse, error) {
	s.createSignatureReq = req
	return s.createSignatureResp, nil
}

func (s *stubServer) CreateApp(_ context.Context, req *messagev1.CreateAppRequest) (*messagev1.CreateAppResponse, error) {
	s.createAppReq = req
	return s.createAppResp, nil
}

func (s *stubServer) SendEmail(ctx context.Context, req *messagev1.SendEmailRequest) (*messagev1.SendResponse, error) {
	s.sendEmailCtx = ctx
	s.sendEmailReq = req
	return s.sendEmailResp, s.sendEmailErr
}

func (s *stubServer) SendSMS(ctx context.Context, req *messagev1.SendSMSRequest) (*messagev1.SendResponse, error) {
	s.sendSMSCtx = ctx
	s.sendSMSReq = req
	return s.sendSMSResp, s.sendSMSErr
}

func (s *stubServer) GetEmail(_ context.Context, req *messagev1.GetEmailRequest) (*messagev1.EmailRecord, error) {
	s.getEmailReq = req
	return s.getEmailResp, s.getEmailErr
}

func (s *stubServer) GetSMS(_ context.Context, req *messagev1.GetSMSRequest) (*messagev1.SMSRecord, error) {
	s.getSMSReq = req
	return s.getSMSResp, s.getSMSErr
}

func (s *stubServer) ListEmails(_ context.Context, req *messagev1.ListEmailsRequest) (*messagev1.ListEmailsResponse, error) {
	s.listEmailsReq = req
	return s.listEmailsResp, s.listEmailsErr
}

func (s *stubServer) ListSMS(_ context.Context, req *messagev1.ListSMSRequest) (*messagev1.ListSMSResponse, error) {
	s.listSMSReq = req
	return s.listSMSResp, s.listSMSErr
}

func (s *stubServer) ListEmailsByCursor(_ context.Context, req *messagev1.ListEmailsByCursorRequest) (*messagev1.ListEmailsByCursorResponse, error) {
	s.listEmailsByCursorReq = req
	return s.listEmailsByCursorResp, s.listEmailsByCursorErr
}

func (s *stubServer) ListSMSByCursor(_ context.Context, req *messagev1.ListSMSByCursorRequest) (*messagev1.ListSMSByCursorResponse, error) {
	s.listSMSByCursorReq = req
	return s.listSMSByCursorResp, s.listSMSByCursorErr
}

func (s *stubServer) GetEmailStats(_ context.Context, req *messagev1.GetEmailStatsRequest) (*messagev1.EmailStatsResponse, error) {
	s.getEmailStatsReq = req
	return s.getEmailStatsResp, s.getEmailStatsErr
}

func (s *stubServer) GetSMSStats(_ context.Context, req *messagev1.GetSMSStatsRequest) (*messagev1.SMSStatsResponse, error) {
	s.getSMSStatsReq = req
	return s.getSMSStatsResp, s.getSMSStatsErr
}

func (s *stubServer) ListSMSRegions(_ context.Context, req *messagev1.ListSMSRegionsRequest) (*messagev1.ListSMSRegionsResponse, error) {
	s.listSMSRegionsReq = req
	return s.listSMSRegionsResp, s.listSMSRegionsErr
}

// TestSendEmail_ForwardsTrustedTenantContext verifies the core curation:
// the testkit request carries scene + params only, and the trusted tenant
// context the gateway's gate planted on the request ctx reaches the
// downstream call unchanged (no app credentials exist anymore).
func TestSendEmail_ForwardsTrustedTenantContext(t *testing.T) {
	stub := &stubServer{
		sendEmailResp: &messagev1.SendResponse{
			Id:     7001,
			Status: messagev1.MessageStatus_MESSAGE_STATUS_SENT,
			Vendor: &messagev1.SendResponse_EmailVendor{EmailVendor: messagev1.EmailVendor_EMAIL_VENDOR_ALIYUN},
		},
	}
	svc := message.New(stub)

	resp, err := svc.SendEmail(withTrustedTenant(context.Background(), "ten_alpha"), &testkitv1.SendEmailRequest{
		To:             []*testkitv1.EmailAddress{{Email: "alice@example.com", DisplayName: "Alice"}},
		Scene:          messagingv1.EmailScene_EMAIL_SCENE_NOTIFICATION,
		TemplateParams: map[string]string{"code": "42"},
	})
	require.NoError(t, err)
	// the trusted x-tenant-key rides the downstream context untouched.
	require.Equal(t, "ten_alpha", tenantKeyFromCtx(t, stub.sendEmailCtx))
	require.Equal(t, map[string]string{"code": "42"}, stub.sendEmailReq.GetTemplateParams())
	// nested EmailAddress mapped field-for-field.
	require.Equal(t, "alice@example.com", stub.sendEmailReq.GetTo()[0].GetEmail())
	require.Equal(t, "Alice", stub.sendEmailReq.GetTo()[0].GetDisplayName())
	// scene int-cast.
	require.Equal(t, messagev1.EmailScene_EMAIL_SCENE_NOTIFICATION, stub.sendEmailReq.GetScene())
	// response oneof → split fields (decision 6): email_vendor set, sms_vendor zero.
	require.Equal(t, int64(7001), resp.GetId())
	require.Equal(t, messagingv1.MessageStatus_MESSAGE_STATUS_SENT, resp.GetStatus())
	require.Equal(t, messagingv1.EmailVendor_EMAIL_VENDOR_ALIYUN, resp.GetEmailVendor())
	require.Equal(t, messagingv1.SmsVendor_SMS_VENDOR_UNSPECIFIED, resp.GetSmsVendor())
}

// TestSendEmail_PassesAttachmentsAndIdempotencyKey verifies nested attachments
// + idempotency_key pass-through (attachments url/content XOR is enforced
// downstream, not at the mapping layer).
func TestSendEmail_PassesAttachmentsAndIdempotencyKey(t *testing.T) {
	stub := &stubServer{sendEmailResp: &messagev1.SendResponse{Id: 8}}
	svc := message.New(stub)

	_, err := svc.SendEmail(context.Background(), &testkitv1.SendEmailRequest{
		To:    []*testkitv1.EmailAddress{{Email: "b@x.com"}},
		Scene: messagingv1.EmailScene_EMAIL_SCENE_NOTIFICATION,
		Attachments: []*testkitv1.EmailAttachment{{
			Filename:  "report.pdf",
			Url:       "https://oss.example.com/report.pdf",
			SizeBytes: 1024,
		}},
		IdempotencyKey: "idem-uuid-1",
	})
	require.NoError(t, err)
	require.Len(t, stub.sendEmailReq.GetAttachments(), 1)
	require.Equal(t, "report.pdf", stub.sendEmailReq.GetAttachments()[0].GetFilename())
	require.Equal(t, "https://oss.example.com/report.pdf", stub.sendEmailReq.GetAttachments()[0].GetUrl())
	require.Equal(t, int64(1024), stub.sendEmailReq.GetAttachments()[0].GetSizeBytes())
	require.Equal(t, "idem-uuid-1", stub.sendEmailReq.GetIdempotencyKey())
}

// TestSendSMS_ForwardsTrustedTenantContext verifies SMS send also forwards
// the trusted tenant context and the response picks the SMS branch.
func TestSendSMS_ForwardsTrustedTenantContext(t *testing.T) {
	stub := &stubServer{
		sendSMSResp: &messagev1.SendResponse{
			Id:     9001,
			Status: messagev1.MessageStatus_MESSAGE_STATUS_SENT,
			Vendor: &messagev1.SendResponse_SmsVendor{SmsVendor: messagev1.SmsVendor_SMS_VENDOR_ALIYUN},
		},
	}
	svc := message.New(stub)

	resp, err := svc.SendSMS(withTrustedTenant(context.Background(), "ten_alpha"), &testkitv1.SendSMSRequest{
		DialCode:       "+86",
		Phone:          "13800138000",
		TemplateParams: map[string]string{"code": "888888"},
		Scene:          messagingv1.SmsScene_SMS_SCENE_LOGIN_CODE,
	})
	require.NoError(t, err)
	require.Equal(t, "ten_alpha", tenantKeyFromCtx(t, stub.sendSMSCtx))
	require.Equal(t, "+8613800138000", stub.sendSMSReq.GetTo())
	require.Equal(t, messagev1.SmsScene_SMS_SCENE_LOGIN_CODE, stub.sendSMSReq.GetScene())
	require.Equal(t, map[string]string{"code": "888888"}, stub.sendSMSReq.GetTemplateParams())
	// response: SMS branch set, email branch zero.
	require.Equal(t, int64(9001), resp.GetId())
	require.Equal(t, messagingv1.SmsVendor_SMS_VENDOR_ALIYUN, resp.GetSmsVendor())
	require.Equal(t, messagingv1.EmailVendor_EMAIL_VENDOR_UNSPECIFIED, resp.GetEmailVendor())
}

// TestGetEmail_MapsAllFields verifies the EmailRecord converter preserves every
// field (ops console needs full fidelity — decision 7), incl. nested addresses.
func TestGetEmail_MapsAllFields(t *testing.T) {
	stub := &stubServer{getEmailResp: &messagev1.EmailRecord{
		Id:             1,
		Vendor:         messagev1.EmailVendor_EMAIL_VENDOR_TENCENT,
		Account:        "acc",
		Scene:          messagev1.EmailScene_EMAIL_SCENE_REGISTER,
		Status:         messagev1.MessageStatus_MESSAGE_STATUS_FAILED,
		Target:         &messagev1.EmailAddress{Email: "to@x.com", DisplayName: "To"},
		AppKey:         "testkit-service",
		Cc:             []*messagev1.EmailAddress{{Email: "cc@x.com"}},
		Subject:        "subj",
		Content:        "txt",
		HtmlBody:       "<b>html</b>",
		TemplateId:     "T1",
		TemplateParams: map[string]string{"k": "v"},
		ErrorMessage:   "boom",
		Attempts:       3,
		SentAt:         100,
		CreatedAt:      90,
		UpdatedAt:      110,
		Attachments:    []*messagev1.EmailAttachment{{Filename: "a.pdf", Url: "https://o/a.pdf", SizeBytes: 5}},
	}}
	svc := message.New(stub)

	got, err := svc.GetEmail(context.Background(), &testkitv1.GetEmailRequest{Id: 1})
	require.NoError(t, err)
	require.Equal(t, int64(1), got.GetId())
	require.Equal(t, messagingv1.EmailVendor_EMAIL_VENDOR_TENCENT, got.GetVendor())
	require.Equal(t, messagingv1.EmailScene_EMAIL_SCENE_REGISTER, got.GetScene())
	require.Equal(t, messagingv1.MessageStatus_MESSAGE_STATUS_FAILED, got.GetStatus())
	require.Equal(t, "to@x.com", got.GetTarget().GetEmail())
	require.Len(t, got.GetCc(), 1)
	require.Equal(t, "subj", got.GetSubject())
	require.Equal(t, map[string]string{"k": "v"}, got.GetTemplateParams())
	require.Equal(t, "boom", got.GetErrorMessage())
	require.Equal(t, int32(3), got.GetAttempts())
	require.Len(t, got.GetAttachments(), 1)
	require.Equal(t, "a.pdf", got.GetAttachments()[0].GetFilename())
	// request id passthrough.
	require.Equal(t, int64(1), stub.getEmailReq.GetId())
}

// TestGetSMS_MapsAllFields verifies the SMSRecord converter.
func TestGetSMS_MapsAllFields(t *testing.T) {
	stub := &stubServer{getSMSResp: &messagev1.SMSRecord{
		Id:         2,
		Vendor:     messagev1.SmsVendor_SMS_VENDOR_VOLCENGINE,
		Scene:      messagev1.SmsScene_SMS_SCENE_REGISTER,
		Status:     messagev1.MessageStatus_MESSAGE_STATUS_SENT,
		RegionCode: "US",
		Phone:      "5551234567",
		AppKey:     "testkit-service",
		Content:    "hi",
		Attempts:   1,
		SentAt:     200,
		CreatedAt:  190,
	}}
	svc := message.New(stub)

	got, err := svc.GetSMS(context.Background(), &testkitv1.GetSMSRequest{Id: 2})
	require.NoError(t, err)
	require.Equal(t, int64(2), got.GetId())
	require.Equal(t, messagingv1.SmsVendor_SMS_VENDOR_VOLCENGINE, got.GetVendor())
	require.Equal(t, "US", got.GetRegionCode())
	require.Equal(t, "5551234567", got.GetPhone())
	require.Equal(t, int32(1), got.GetAttempts())
	require.Equal(t, int64(2), stub.getSMSReq.GetId())
}

// TestListEmails_OmitsSenderIDFilter verifies decision 2: the testkit
// ListEmails request has no sender_id field, and the converter does NOT inject
// one downstream (ops console sees all records; sender_id stays zero).
func TestListEmails_OmitsSenderIDFilter(t *testing.T) {
	stub := &stubServer{listEmailsResp: &messagev1.ListEmailsResponse{
		Records:    []*messagev1.EmailRecord{{Id: 1, Subject: "a"}, {Id: 2, Subject: "b"}},
		Total:      2,
		TotalPages: 1,
		HasMore:    false,
	}}
	svc := message.New(stub)

	got, err := svc.ListEmails(context.Background(), &testkitv1.ListEmailsRequest{
		Vendor:        messagingv1.EmailVendor_EMAIL_VENDOR_ALIYUN,
		Scene:         messagingv1.EmailScene_EMAIL_SCENE_NOTIFICATION,
		Status:        messagingv1.MessageStatus_MESSAGE_STATUS_SENT,
		Target:        "alice@x.com",
		Page:          1,
		PageSize:      20,
		SortField:     storagev1.SortField_SORT_FIELD_CREATED_AT,
		SortDirection: messagingv1.SortDirection_SORT_DIRECTION_DESC,
	})
	require.NoError(t, err)
	// decision 2: no sender_id filter forwarded.
	require.Equal(t, "", stub.listEmailsReq.GetAppKey())
	require.Equal(t, messagev1.EmailVendor_EMAIL_VENDOR_ALIYUN, stub.listEmailsReq.GetVendor())
	require.Equal(t, "alice@x.com", stub.listEmailsReq.GetTarget())
	require.Equal(t, int32(1), stub.listEmailsReq.GetPage())
	require.Equal(t, messagev1.SortDirection_SORT_DIRECTION_DESC, stub.listEmailsReq.GetSortDirection())
	// response mapped.
	require.Len(t, got.GetRecords(), 2)
	require.Equal(t, int64(1), got.GetRecords()[0].GetId())
	require.Equal(t, int32(2), got.GetTotal())
	require.False(t, got.GetHasMore())
}

// TestListSMS_OmitsSenderIDFilter mirrors the email test for SMS.
func TestListSMS_OmitsSenderIDFilter(t *testing.T) {
	stub := &stubServer{listSMSResp: &messagev1.ListSMSResponse{
		Records: []*messagev1.SMSRecord{{Id: 9, RegionCode: "CN"}},
		Total:   1,
	}}
	svc := message.New(stub)

	got, err := svc.ListSMS(context.Background(), &testkitv1.ListSMSRequest{
		RegionCode: "CN",
		Phone:      "13800138000",
		Page:       2,
		PageSize:   10,
	})
	require.NoError(t, err)
	require.Equal(t, "", stub.listSMSReq.GetAppKey())
	require.Equal(t, "CN", stub.listSMSReq.GetRegionCode())
	require.Equal(t, int32(2), stub.listSMSReq.GetPage())
	require.Len(t, got.GetRecords(), 1)
}

// TestListEmailsByCursor_PassesPageTokenAndIncludeTotal verifies cursor
// pagination passthrough: page_token + include_total + next_page_token echo,
// sender_id omitted.
func TestListEmailsByCursor_PassesPageTokenAndIncludeTotal(t *testing.T) {
	stub := &stubServer{listEmailsByCursorResp: &messagev1.ListEmailsByCursorResponse{
		Records:       []*messagev1.EmailRecord{{Id: 5}},
		Total:         42,
		NextPageToken: "cursor-abc",
	}}
	svc := message.New(stub)

	got, err := svc.ListEmailsByCursor(context.Background(), &testkitv1.ListEmailsByCursorRequest{
		PageSize:     50,
		PageToken:    "cursor-prev",
		IncludeTotal: true,
		SortField:    storagev1.SortField_SORT_FIELD_CREATED_AT,
	})
	require.NoError(t, err)
	require.Equal(t, "cursor-prev", stub.listEmailsByCursorReq.GetPageToken())
	require.True(t, stub.listEmailsByCursorReq.GetIncludeTotal())
	require.Equal(t, int32(50), stub.listEmailsByCursorReq.GetPageSize())
	require.Equal(t, "", stub.listEmailsByCursorReq.GetAppKey())
	require.Equal(t, int32(42), got.GetTotal())
	require.Equal(t, "cursor-abc", got.GetNextPageToken())
	require.Len(t, got.GetRecords(), 1)
}

// TestListSMSByCursor_FirstPageEmptyToken verifies the first-page (empty token)
// path and an empty next_page_token echo.
func TestListSMSByCursor_FirstPageEmptyToken(t *testing.T) {
	stub := &stubServer{listSMSByCursorResp: &messagev1.ListSMSByCursorResponse{
		NextPageToken: "",
	}}
	svc := message.New(stub)

	got, err := svc.ListSMSByCursor(context.Background(), &testkitv1.ListSMSByCursorRequest{PageSize: 10})
	require.NoError(t, err)
	require.Equal(t, "", stub.listSMSByCursorReq.GetPageToken()) // first page
	require.Equal(t, "", stub.listSMSByCursorReq.GetAppKey())
	require.Equal(t, "", got.GetNextPageToken()) // no next page
}

// TestGetEmailStats_MapsVendorBreakdown verifies the stats response maps totals
// + per-vendor breakdown, and the request filter passes through.
func TestGetEmailStats_MapsVendorBreakdown(t *testing.T) {
	stub := &stubServer{getEmailStatsResp: &messagev1.EmailStatsResponse{
		Total:       10,
		Sent:        8,
		Failed:      2,
		SuccessRate: 80.0,
		Vendors: []*messagev1.EmailVendorStats{
			{Vendor: messagev1.EmailVendor_EMAIL_VENDOR_ALIYUN, Total: 6, Sent: 5, Failed: 1},
			{Vendor: messagev1.EmailVendor_EMAIL_VENDOR_TENCENT, Total: 4, Sent: 3, Failed: 1},
		},
	}}
	svc := message.New(stub)

	got, err := svc.GetEmailStats(context.Background(), &testkitv1.GetEmailStatsRequest{
		Vendor:    messagingv1.EmailVendor_EMAIL_VENDOR_ALIYUN,
		Scene:     messagingv1.EmailScene_EMAIL_SCENE_NOTIFICATION,
		StartTime: 1,
		EndTime:   2,
	})
	require.NoError(t, err)
	require.Equal(t, messagev1.EmailVendor_EMAIL_VENDOR_ALIYUN, stub.getEmailStatsReq.GetVendor())
	require.Equal(t, int64(10), got.GetTotal())
	require.InDelta(t, 80.0, got.GetSuccessRate(), 0.001)
	require.Len(t, got.GetVendors(), 2)
	require.Equal(t, messagingv1.EmailVendor_EMAIL_VENDOR_ALIYUN, got.GetVendors()[0].GetVendor())
	require.Equal(t, int64(6), got.GetVendors()[0].GetTotal())
}

// TestGetSMSStats_NoData verifies the "no data" sentinel (success_rate = -1)
// passes through unchanged.
func TestGetSMSStats_NoData(t *testing.T) {
	stub := &stubServer{getSMSStatsResp: &messagev1.SMSStatsResponse{
		Total:       0,
		Sent:        0,
		Failed:      0,
		SuccessRate: -1,
	}}
	svc := message.New(stub)

	got, err := svc.GetSMSStats(context.Background(), &testkitv1.GetSMSStatsRequest{})
	require.NoError(t, err)
	require.Equal(t, int64(0), got.GetTotal())
	require.InDelta(t, -1.0, got.GetSuccessRate(), 0.001)
}

func TestListSMSRegions(t *testing.T) {
	stub := &stubServer{listSMSRegionsResp: &messagev1.ListSMSRegionsResponse{
		RegionCodes: []string{"CN", "US", "HK"},
	}}
	svc := message.New(stub)

	got, err := svc.ListSMSRegions(context.Background(), &testkitv1.ListSMSRegionsRequest{})
	require.NoError(t, err)
	require.Equal(t, []string{"CN", "US", "HK"}, got.GetRegionCodes())
}

// TestSendEmail_DownstreamErrorPassthrough verifies a downstream xerr.Error is
// returned untouched (v2 §9) — the mapping layer never swallows or re-wraps.
func TestSendEmail_DownstreamErrorPassthrough(t *testing.T) {
	downstream := errors.New("vendor rejected: invalid from address")
	stub := &stubServer{sendEmailErr: downstream}
	svc := message.New(stub)

	_, err := svc.SendEmail(context.Background(), &testkitv1.SendEmailRequest{
		To:    []*testkitv1.EmailAddress{{Email: "x@y.com"}},
		Scene: messagingv1.EmailScene_EMAIL_SCENE_NOTIFICATION,
	})
	require.ErrorIs(t, err, downstream)
}

// fakeReference embeds referencev1.UnimplementedReferenceServiceServer and
// backs ListCountries with a tiny locale-aware table — enough to prove the
// region-code directory now sources from reference-service with both locales
// filled (public contract unchanged).
type fakeReference struct {
	referencev1.UnimplementedReferenceServiceServer
}

func (f *fakeReference) ListCountries(_ context.Context, req *referencev1.ListCountriesRequest) (*referencev1.ListCountriesResponse, error) {
	if req.GetLocale() == "en" {
		return &referencev1.ListCountriesResponse{Countries: []*referencev1.Country{
			{RegionCode: "CN", DialCode: "+86", Name: "China"},
			{RegionCode: "US", DialCode: "+1", Name: "United States"},
		}}, nil
	}
	return &referencev1.ListCountriesResponse{Countries: []*referencev1.Country{
		{RegionCode: "CN", DialCode: "+86", Name: "中国"},
		{RegionCode: "US", DialCode: "+1", Name: "美国"},
	}}, nil
}

func TestListRegionCodesFromReference(t *testing.T) {
	stub := &stubServer{}
	svc := message.New(stub, message.WithReference(&fakeReference{}))

	resp, err := svc.ListRegionCodes(context.Background(), &testkitv1.ListRegionCodesRequest{})
	require.NoError(t, err)
	require.Len(t, resp.GetRegionCodes(), 2)

	cn := resp.GetRegionCodes()[0]
	require.Equal(t, "CN", cn.GetCode())
	require.Equal(t, "+86", cn.GetDialCode())
	require.Equal(t, "中国", cn.GetNameZh())
	require.Equal(t, "China", cn.GetNameEn())

	us := resp.GetRegionCodes()[1]
	require.Equal(t, "US", us.GetCode())
	require.Equal(t, "美国", us.GetNameZh())
	require.Equal(t, "United States", us.GetNameEn())
}

func TestListRegionCodesWithoutReferenceFails(t *testing.T) {
	svc := message.New(&stubServer{})
	_, err := svc.ListRegionCodes(context.Background(), &testkitv1.ListRegionCodesRequest{})
	require.Error(t, err)
}

// withTrustedTenant plants the trusted tenant key on a caller ctx the way
// the gateway's tenant gate does (incoming metadata + ctx value).
func withTrustedTenant(ctx context.Context, key string) context.Context {
	ctx = tenantctx.WithTenantKey(ctx, key)
	return metadata.NewIncomingContext(ctx, metadata.Pairs(tenantctx.HeaderTenantKey, key))
}

// tenantKeyFromCtx extracts the trusted x-tenant-key from incoming metadata.
func tenantKeyFromCtx(t *testing.T, ctx context.Context) string {
	t.Helper()
	md, ok := metadata.FromIncomingContext(ctx)
	require.True(t, ok, "incoming metadata expected")
	keys := md.Get(tenantctx.HeaderTenantKey)
	require.NotEmpty(t, keys)
	return keys[0]
}
