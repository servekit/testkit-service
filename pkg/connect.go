package pkg

import (
	"fmt"

	"github.com/servekit/go-common/configx"
	"github.com/servekit/go-common/lifecycle"

	"github.com/servekit/testkit-service/pkg/config"
	"github.com/servekit/testkit-service/pkg/option"
)

// moduleClaim enforces one live module instance per process for Connect.
var moduleClaim lifecycle.ModuleClaim

// ConnectConfig describes how to connect to testkit-service. Mode selects the
// backend: "grpc" dials Target with the server-shaped *Client, "module" (the
// default when empty) builds an in-process Handler from Config.
type ConnectConfig struct {
	Mode   configx.Mode   // "grpc" | "module" ("" = module)
	Target string         // grpc dial target; required when Mode=grpc
	Config *config.Config // module-mode config; required when Mode=module
	Opts   []option.Option
}

// Connect resolves a testkit-service dependency end to end and registers its
// lifecycle with mgr: grpc mode registers a Stopper (closes the connection);
// module mode builds from Config and registers the raw Handler via mgr.Add so
// the consumer drives its Start/Stop. It does NOT handle a parent-injected
// Handler — adoption is the consumer's call (return the injected value and
// skip Connect), because it reads the consumer's own options and the parent
// owns that lifecycle.
//
// The module branch claims the process's single module slot
// (lifecycle.ModuleClaim): a second live instance errors with the sharing
// remedy instead of silently duplicating the whole aggregation.
func Connect(cfg ConnectConfig, mgr *lifecycle.Manager) (Service, *Handler, error) {
	switch cfg.Mode {
	case configx.ModeGRPC:
		if cfg.Target == "" {
			return nil, nil, fmt.Errorf("testkit-service: target required when mode=grpc")
		}
		c, err := NewClient(cfg.Target)
		if err != nil {
			return nil, nil, fmt.Errorf("testkit-service: %w", err)
		}
		mgr.AddStopper("testkit-service", lifecycle.StopFunc(func() { _ = c.Close() }))
		return c, nil, nil
	case configx.ModeModule, configx.ModeUnspecified:
		if cfg.Config == nil {
			return nil, nil, fmt.Errorf("testkit-service: module config required")
		}
		if err := moduleClaim.Claim("testkit-service"); err != nil {
			return nil, nil, err
		}
		hdl, err := NewModule(cfg.Config, cfg.Opts...)
		if err != nil {
			moduleClaim.Release() // construction failed; free the slot
			return nil, nil, fmt.Errorf("testkit-service: %w", err)
		}
		mgr.Add("testkit-service", moduleClaim.Wrap(hdl))
		return hdl, hdl, nil
	default:
		return nil, nil, fmt.Errorf("testkit-service: unknown mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}
