package pkg

import (
	"github.com/servekit/testkit-service/internal/service"
	"github.com/servekit/testkit-service/pkg/config"
	"github.com/servekit/testkit-service/pkg/handler"
	"github.com/servekit/testkit-service/pkg/option"
)

// Handler is the in-process entry point. Aliased to *handler.Handler so
// external code references it as testkitservice.Handler, matching the other
// services' pkg shape.
type Handler = handler.Handler

// NewModule constructs an in-process testkit-service for embedding (e.g. by
// e2e test harnesses). It builds the full aggregation — db, redis, and the
// four downstreams per their third_party config — and returns the Handler,
// which satisfies signalx.Service: manage lifecycle via Start/Stop.
func NewModule(cfg *config.Config, opts ...option.Option) (*Handler, error) {
	svc, err := service.New(cfg)
	if err != nil {
		return nil, err
	}
	return handler.New(svc), nil
}
