package pkg

import (
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/internal/service"
	"github.com/servekit/testkit-service/pkg/config"
	"github.com/servekit/testkit-service/pkg/handler"
	"github.com/servekit/testkit-service/pkg/option"
)

// Handler is the in-process entry point. Callers invoke proto-typed RPC
// methods directly on it — no serialization, no network. This IS the public
// capability surface of testkit-service when embedded as a module.
//
// Aliased to *handler.Handler so external code references it as
// testkitpkg.Handler without importing internal packages.
type Handler = handler.Handler

// Compile-time assertion: *Handler satisfies the gRPC server interface.
var _ testkitv1.TestkitServiceServer = (*Handler)(nil)

// NewModule constructs an in-process testkit service for embedding.
//
// Returns only the Handler — Handler IS the public capability and ALSO
// satisfies signalx.Service (Start/Stop), so module users manage lifecycle
// via the same object they call RPC methods on:
//
//	hdl, err := testkitpkg.NewModule(cfg, option.WithDB(parentDB))
//	if err != nil { panic(err) }
//	if err := hdl.Start(); err != nil { panic(err) }   // background goroutines (cron, etc.)
//	defer hdl.Stop()                                    // closes owned resources
//	pong, err := hdl.Ping(ctx, &emptypb.Empty{})
//
// Resources injected via option.WithRedis are NOT owned by the service —
// parent process keeps ownership and is responsible for cleanup.
// Only resources the service creates from cfg are tracked by the internal
// lifecycle.Manager and stopped on Stop.
func NewModule(cfg *config.Config, opts ...option.Option) (*Handler, error) {
	svc, err := service.New(cfg, opts...)
	if err != nil {
		return nil, err
	}
	return handler.New(svc), nil
}
