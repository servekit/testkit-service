// Package thirdcall defines testkit's stable surface over the four embedded
// downstream services (gid / message / storage / user): one handler type alias
// and one dual-mode factory per service.
//
// The handler aliases (thirdcall.UserService, etc.) expose each downstream's
// FULL service method set, typed in the downstream gen (e.g. userv1). Because
// a BFF forwards the whole downstream API, aliasing the concrete in-process
// handler is sharper than re-declaring a minimal interface: zero delegation
// boilerplate, and later phases (P2-P5) just call methods on it. The handler
// also satisfies lifecycle.Service (Start/Stop), so service.go registers each
// embedded module with mgr.Add for full lifecycle.
//
// Default mode is "module" (in-process). grpc mode is reserved — wiring a
// gRPC Client into the server-typed alias needs per-RPC adapter methods, which
// is deferred, so the factories return a not-implemented error for grpc.
//
// Boundary (design spec §3.4): this package imports testkit's
// internal/thirdcall (the only place that imports downstream pkg + gen for
// client wiring) and internal/adapter (the cross-service bridge). service.go
// imports this package + internal/adapter, never downstream gen directly.
package thirdcall

import (
	"fmt"

	gidconfig "github.com/servekit/gid-service/pkg/config"

	"github.com/servekit/testkit-service/internal/thirdcall/gid"
	"github.com/servekit/testkit-service/pkg/config"
)

// GIDService is the in-process gid-service handler. Exposes the full
// gidv1.GidServiceServer method set (NextID, BatchNextID, Decompose) plus
// Start/Stop.
type GIDService = gid.Handler

// NewGIDService resolves gid-service by mode. gid has no caller-injected
// resources, so module mode needs only its config.
func NewGIDService(cfg *config.RemoteServiceConfig[*gidconfig.Config]) (GIDService, error) {
	switch cfg.Mode {
	case "grpc":
		return nil, fmt.Errorf("gid-service grpc mode not implemented in P1 (target %q)", cfg.Target)
	case "module", "":
		return gid.NewModule(cfg.Config)
	default:
		return nil, fmt.Errorf("unknown gid mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}
