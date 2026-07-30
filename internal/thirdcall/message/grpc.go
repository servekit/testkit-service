package message

import (
	"context"
	"fmt"

	messagev1 "github.com/servekit/message-service/gen/message/v1"
	messageservice "github.com/servekit/message-service/pkg"
)

type grpcMessage struct {
	client *messageservice.Client
}

// NewGRPC dials message-service at target and returns a MessageService over gRPC.
func NewGRPC(target string) (MessageService, error) {
	c, err := messageservice.NewClient(target)
	if err != nil {
		return nil, fmt.Errorf("dial message-service %q: %w", target, err)
	}
	return &grpcMessage{client: c}, nil
}

func (g *grpcMessage) SendEmail(ctx context.Context, r *messagev1.SendEmailRequest) (*messagev1.SendResponse, error) {
	return g.client.SendEmail(ctx, r)
}
func (g *grpcMessage) SendSMS(ctx context.Context, r *messagev1.SendSMSRequest) (*messagev1.SendResponse, error) {
	return g.client.SendSMS(ctx, r)
}
func (g *grpcMessage) GetEmail(ctx context.Context, r *messagev1.GetEmailRequest) (*messagev1.EmailRecord, error) {
	return g.client.GetEmail(ctx, r)
}
func (g *grpcMessage) ListEmails(ctx context.Context, r *messagev1.ListEmailsRequest) (*messagev1.ListEmailsResponse, error) {
	return g.client.ListEmails(ctx, r)
}
func (g *grpcMessage) ListEmailsByCursor(ctx context.Context, r *messagev1.ListEmailsByCursorRequest) (*messagev1.ListEmailsByCursorResponse, error) {
	return g.client.ListEmailsByCursor(ctx, r)
}
func (g *grpcMessage) GetEmailStats(ctx context.Context, r *messagev1.GetEmailStatsRequest) (*messagev1.EmailStatsResponse, error) {
	return g.client.GetEmailStats(ctx, r)
}
func (g *grpcMessage) GetSMS(ctx context.Context, r *messagev1.GetSMSRequest) (*messagev1.SMSRecord, error) {
	return g.client.GetSMS(ctx, r)
}
func (g *grpcMessage) ListSMS(ctx context.Context, r *messagev1.ListSMSRequest) (*messagev1.ListSMSResponse, error) {
	return g.client.ListSMS(ctx, r)
}
func (g *grpcMessage) ListSMSByCursor(ctx context.Context, r *messagev1.ListSMSByCursorRequest) (*messagev1.ListSMSByCursorResponse, error) {
	return g.client.ListSMSByCursor(ctx, r)
}
func (g *grpcMessage) GetSMSStats(ctx context.Context, r *messagev1.GetSMSStatsRequest) (*messagev1.SMSStatsResponse, error) {
	return g.client.GetSMSStats(ctx, r)
}
func (g *grpcMessage) ListSMSRegions(ctx context.Context, r *messagev1.ListSMSRegionsRequest) (*messagev1.ListSMSRegionsResponse, error) {
	return g.client.ListSMSRegions(ctx, r)
}
func (g *grpcMessage) ListSMSSenders(ctx context.Context, r *messagev1.ListSMSSendersRequest) (*messagev1.ListSMSSendersResponse, error) {
	return g.client.ListSMSSenders(ctx, r)
}
func (g *grpcMessage) ListEmailSenders(ctx context.Context, r *messagev1.ListEmailSendersRequest) (*messagev1.ListEmailSendersResponse, error) {
	return g.client.ListEmailSenders(ctx, r)
}

func (g *grpcMessage) Close() error { return g.client.Close() }
