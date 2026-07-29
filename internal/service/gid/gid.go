// Package gid implements testkit's gid debug domain: a near-1:1 forward to the
// embedded gid-service. gid RPCs carry no caller-identity (global unique ID
// generation is caller-agnostic), so the testkit messages mirror gid.proto
// shape-for-shape and mapping is a plain field copy. This is the only testkit
// domain package that imports gid-service's gen (gidv1) — the mapping-layer
// boundary from design spec v2 §3.1.
package gid

import (
	"context"

	gidv1 "github.com/servekit/gid-service/gen/gid/v1"
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
)

// Client is the subset of the embedded gid-service handler this domain uses.
// The real thirdcall.GIDService (= *gidservice.Handler, which embeds
// gidv1.GidServiceServer) satisfies it structurally; tests use a stub.
type Client interface {
	NextID(ctx context.Context, req *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error)
	BatchNextID(ctx context.Context, req *gidv1.BatchNextIDRequest) (*gidv1.BatchNextIDResponse, error)
	Decompose(ctx context.Context, req *gidv1.DecomposeRequest) (*gidv1.DecomposeResponse, error)
}

// Service implements the gid debug domain.
type Service struct {
	client Client
}

// New constructs the gid service.
func New(client Client) *Service { return &Service{client: client} }

// NextID forwards to gid-service and maps the single generated id.
func (s *Service) NextID(ctx context.Context, _ *testkitv1.NextIDRequest) (*testkitv1.NextIDResponse, error) {
	resp, err := s.client.NextID(ctx, &gidv1.NextIDRequest{})
	if err != nil {
		return nil, err
	}
	return fromGIDNextIDResponse(resp), nil
}

// BatchNextID forwards to gid-service and maps the generated id batch.
func (s *Service) BatchNextID(ctx context.Context, req *testkitv1.BatchNextIDRequest) (*testkitv1.BatchNextIDResponse, error) {
	resp, err := s.client.BatchNextID(ctx, toGIDBatchNextIDRequest(req))
	if err != nil {
		return nil, err
	}
	return fromGIDBatchNextIDResponse(resp), nil
}

// Decompose forwards to gid-service and maps the parsed id components.
func (s *Service) Decompose(ctx context.Context, req *testkitv1.DecomposeRequest) (*testkitv1.DecomposeResponse, error) {
	resp, err := s.client.Decompose(ctx, toGIDDecomposeRequest(req))
	if err != nil {
		return nil, err
	}
	return fromGIDDecomposeResponse(resp), nil
}

// --- converters (testkit DTO ↔ gid-service proto); 1:1 shape ---

func fromGIDNextIDResponse(r *gidv1.NextIDResponse) *testkitv1.NextIDResponse {
	if r == nil {
		return nil
	}
	return &testkitv1.NextIDResponse{Id: r.GetId()}
}

func toGIDBatchNextIDRequest(r *testkitv1.BatchNextIDRequest) *gidv1.BatchNextIDRequest {
	return &gidv1.BatchNextIDRequest{Count: r.GetCount()}
}

func fromGIDBatchNextIDResponse(r *gidv1.BatchNextIDResponse) *testkitv1.BatchNextIDResponse {
	if r == nil {
		return nil
	}
	return &testkitv1.BatchNextIDResponse{Ids: r.GetIds()}
}

func toGIDDecomposeRequest(r *testkitv1.DecomposeRequest) *gidv1.DecomposeRequest {
	return &gidv1.DecomposeRequest{Id: r.GetId()}
}

func fromGIDDecomposeResponse(r *gidv1.DecomposeResponse) *testkitv1.DecomposeResponse {
	if r == nil {
		return nil
	}
	return &testkitv1.DecomposeResponse{
		Time:        r.GetTime(),
		Sequence:    r.GetSequence(),
		MachineId:   r.GetMachineId(),
		GeneratedAt: r.GetGeneratedAt(),
	}
}
