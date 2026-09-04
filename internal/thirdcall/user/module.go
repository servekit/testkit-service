// Package user is the in-process + gRPC wiring for user-service.
package user

import (
	userhandler "github.com/servekit/user-service/pkg/handler"
)

// moduleUser wraps an in-process user-service Handler. The wrapper owns none of
// the Handler's lifecycle; see Close.
type moduleUser struct {
	*userhandler.Handler
}

// NewModule wraps a user-service Handler as a UserService. The module owns none
// of the Handler's lifecycle: resolveUser registers the raw Handler with the
// lifecycle Manager (mgr.Add drives its Start/Stop). See Close for why it is a
// no-op.
func NewModule(h *userhandler.Handler) UserService {
	return &moduleUser{Handler: h}
}

// Close is a no-op. The Handler's lifecycle is owned by the lifecycle Manager
// (resolveUser registers it via mgr.Add), not by this module, so the module has
// nothing to release. The method exists only to satisfy the UserService
// interface, whose grpc backend needs a real Close to drop its connection.
func (*moduleUser) Close() error {
	return nil
}
