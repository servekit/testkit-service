// Package gid is the in-process wiring for gid-service.
//
// It is the only place in testkit that imports gid-service's public pkg +
// gen. Callers (service.go) reach gid via pkg/thirdcall, which delegates here.
package gid

import (
	"fmt"

	gidservice "github.com/servekit/gid-service/pkg"
	"github.com/servekit/gid-service/pkg/config"
)

// Handler is the in-process gid-service handle: a *handler.Handler. Aliased
// to the pointer because that is what gid-service's NewModule returns and what
// testkit holds — it exposes the full gidv1.GidServiceServer method set
// (NextID, BatchNextID, Decompose, ...) plus Start/Stop for lifecycle.
type Handler = *gidservice.Handler

// NewModule constructs an in-process gid-service from config. gid owns no
// caller-injectable resources (no DB, no Redis, no upstream thirdcall), so it
// takes no options — its pkg/option.Options is intentionally empty.
func NewModule(cfg *config.Config) (Handler, error) {
	hdl, err := gidservice.NewModule(cfg)
	if err != nil {
		return nil, fmt.Errorf("gid module: %w", err)
	}
	return hdl, nil
}
