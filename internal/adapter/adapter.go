// Package adapter bridges testkit's shared handlers to the thirdcall
// interfaces that user/message/storage-service inject via their option package.
//
// The problem (design spec §6.3): user, storage, and message each declare their
// OWN pkg/thirdcall.GIDService interface — identical shape
// (NextID(ctx)(int64, error)) but distinct Go types — and the gid handler's
// NextID is proto-typed (ctx, *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error),
// so it cannot be injected directly. Likewise user-service's
// pkg/thirdcall.MessageService (SendEmail/SendSMS/Close on messagev1 types)
// must be satisfied by testkit's shared message handler.
//
// GIDAdapter and MessageAdapter rely on Go structural typing to satisfy all
// three downstreams' interfaces from a single concrete type each, so testkit
// builds one gid handler and one message handler and shares them everywhere.
//
// Boundary: this package imports downstream gen (gidv1, messagev1) — the
// sanctioned adapter exception to the "only internal/thirdcall imports gen"
// rule (design spec §3.4), mirroring how user-service's own thirdcall bridges
// the same incompatibility internally.
//
// The package additionally bridges the shared user handler's GetSession to the
// auth interceptor's SessionResolver seam (user.go), so pkg/auth can stay free
// of downstream gen — the same boundary, applied to authentication.
package adapter

import (
	"context"
	"fmt"

	gidv1 "github.com/servekit/gid-service/gen/gid/v1"
	messagev1 "github.com/servekit/message-service/gen/message/v1"
)

// GIDCaller is the minimal shape adapter needs from the shared gid handler.
// The real *gid handler satisfies it; tests use a stub.
type GIDCaller interface {
	NextID(ctx context.Context, req *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error)
}

// GIDAdapter exposes NextID(ctx)(int64, error), satisfying user, storage, and
// message's pkg/thirdcall.GIDService (same shape, different Go types) via
// structural typing — see adapter_test.go for the compile-time assertions.
type GIDAdapter struct {
	caller GIDCaller
}

// NewGIDAdapter wraps a gid caller.
func NewGIDAdapter(c GIDCaller) *GIDAdapter { return &GIDAdapter{caller: c} }

// NextID returns a fresh snowflake id from the shared gid handler.
func (a *GIDAdapter) NextID(ctx context.Context) (int64, error) {
	resp, err := a.caller.NextID(ctx, &gidv1.NextIDRequest{})
	if err != nil {
		return 0, fmt.Errorf("gid next: %w", err)
	}
	return resp.GetId(), nil
}

// MessageCaller is the minimal shape from the shared message handler. The real
// *message handler satisfies it; tests use a stub.
type MessageCaller interface {
	SendEmail(ctx context.Context, req *messagev1.SendEmailRequest) (*messagev1.SendResponse, error)
	SendSMS(ctx context.Context, req *messagev1.SendSMSRequest) (*messagev1.SendResponse, error)
}

// MessageAdapter satisfies user-service's pkg/thirdcall.MessageService
// (SendEmail/SendSMS + Close) by forwarding to the shared message handler.
// Close is a no-op: the message handler's lifecycle is owned by testkit's
// lifecycle.Manager, not by user-service.
type MessageAdapter struct {
	caller MessageCaller
}

// NewMessageAdapter wraps a message caller.
func NewMessageAdapter(c MessageCaller) *MessageAdapter { return &MessageAdapter{caller: c} }

// SendEmail forwards to the shared message handler.
func (a *MessageAdapter) SendEmail(ctx context.Context, req *messagev1.SendEmailRequest) (*messagev1.SendResponse, error) {
	return a.caller.SendEmail(ctx, req)
}

// SendSMS forwards to the shared message handler.
func (a *MessageAdapter) SendSMS(ctx context.Context, req *messagev1.SendSMSRequest) (*messagev1.SendResponse, error) {
	return a.caller.SendSMS(ctx, req)
}

// Close is a no-op; the shared message handler lifecycle is owned by testkit.
func (a *MessageAdapter) Close() error { return nil }
