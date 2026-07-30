package gid

import (
	"context"
	"fmt"

	gidv1 "github.com/servekit/gid-service/gen/gid/v1"
	gidservice "github.com/servekit/gid-service/pkg"
)

type grpcGID struct {
	client *gidservice.Client
}

// NewGRPC dials gid-service at target and returns a GIDService over gRPC.
func NewGRPC(target string) (GIDService, error) {
	c, err := gidservice.NewClient(target)
	if err != nil {
		return nil, fmt.Errorf("dial gid-service %q: %w", target, err)
	}
	return &grpcGID{client: c}, nil
}

func (g *grpcGID) NextID(ctx context.Context, r *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error) {
	return g.client.NextID(ctx, r)
}

func (g *grpcGID) BatchNextID(ctx context.Context, r *gidv1.BatchNextIDRequest) (*gidv1.BatchNextIDResponse, error) {
	return g.client.BatchNextID(ctx, r)
}

func (g *grpcGID) Decompose(ctx context.Context, r *gidv1.DecomposeRequest) (*gidv1.DecomposeResponse, error) {
	return g.client.Decompose(ctx, r)
}

// Close closes the underlying gRPC connection.
func (g *grpcGID) Close() error { return g.client.Close() }
