// Package user is the in-process + gRPC wiring for user-service.
package user

import (
	userhandler "github.com/servekit/user-service/pkg/handler"
)

type moduleUser struct {
	*userhandler.Handler
	owns bool
}

// NewModule wraps a user-service Handler as a UserService. owns=true when the
// caller built it; false when borrowed. Resources (db/redis/gid/message) are
// instantiated + injected by the service root — this wrapper only wraps. The
// caller passes cfg as-is; user-service's own construction is nil-safe.
func NewModule(h *userhandler.Handler, owns bool) UserService {
	return &moduleUser{Handler: h, owns: owns}
}

func (m *moduleUser) Close() error {
	if !m.owns {
		return nil
	}
	return m.Stop()
}
