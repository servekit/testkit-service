// Package message adapts message-service to testkit's internal needs. Mirrors
// user-service's internal/thirdcall/message_service.
package message

import (
	"context"

	messagev1 "github.com/servekit/message-service/gen/message/v1"
)

// MessageService is the subset of message-service testkit forwards (message
// domain + dashboard stats). Methods take/return message-service proto verbatim.
type MessageService interface {
	SendEmail(context.Context, *messagev1.SendEmailRequest) (*messagev1.SendResponse, error)
	SendSMS(context.Context, *messagev1.SendSMSRequest) (*messagev1.SendResponse, error)
	GetEmail(context.Context, *messagev1.GetEmailRequest) (*messagev1.EmailRecord, error)
	ListEmails(context.Context, *messagev1.ListEmailsRequest) (*messagev1.ListEmailsResponse, error)
	ListEmailsByCursor(context.Context, *messagev1.ListEmailsByCursorRequest) (*messagev1.ListEmailsByCursorResponse, error)
	GetEmailStats(context.Context, *messagev1.GetEmailStatsRequest) (*messagev1.EmailStatsResponse, error)
	GetSMS(context.Context, *messagev1.GetSMSRequest) (*messagev1.SMSRecord, error)
	ListSMS(context.Context, *messagev1.ListSMSRequest) (*messagev1.ListSMSResponse, error)
	ListSMSByCursor(context.Context, *messagev1.ListSMSByCursorRequest) (*messagev1.ListSMSByCursorResponse, error)
	GetSMSStats(context.Context, *messagev1.GetSMSStatsRequest) (*messagev1.SMSStatsResponse, error)
	ListSMSRegions(context.Context, *messagev1.ListSMSRegionsRequest) (*messagev1.ListSMSRegionsResponse, error)
	ListSMSSenders(context.Context, *messagev1.ListSMSSendersRequest) (*messagev1.ListSMSSendersResponse, error)
	ListEmailSenders(context.Context, *messagev1.ListEmailSendersRequest) (*messagev1.ListEmailSendersResponse, error)
	Close() error
}

var (
	_ MessageService = (*moduleMessage)(nil)
	_ MessageService = (*grpcMessage)(nil)
)
