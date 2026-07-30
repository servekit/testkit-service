// Package gid adapts gid-service to testkit's internal needs.
//
// GIDService is testkit's seam over gid-service: the gid RPCs testkit forwards
// (the gid debug domain) plus Close for lifecycle. The in-process Handler
// (module) and the gRPC client (grpc) both satisfy it. Mirrors user-service's
// internal/thirdcall/gid_service.
package gid

import (
	"context"

	gidv1 "github.com/servekit/gid-service/gen/gid/v1"
)

// GIDService is the subset of gid-service testkit uses. Methods take/return
// gid-service proto verbatim; Close releases the backend (module Handler Stop
// or gRPC conn Close), wired to a lifecycle Stopper by resolveGID.
type GIDService interface {
	NextID(context.Context, *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error)
	BatchNextID(context.Context, *gidv1.BatchNextIDRequest) (*gidv1.BatchNextIDResponse, error)
	Decompose(context.Context, *gidv1.DecomposeRequest) (*gidv1.DecomposeResponse, error)
	Close() error
}

// Compile-time assertions: both backends satisfy GIDService.
var (
	_ GIDService = (*moduleGID)(nil)
	_ GIDService = (*grpcGID)(nil)
)
