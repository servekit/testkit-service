package gid

import (
	"fmt"

	gidservice "github.com/servekit/gid-service/pkg"
)

// Client is the gid-service gRPC client.
type Client = gidservice.Client

// NewGRPC dials a remote gid-service. Reserved for mode=grpc; testkit runs
// gid in-process (mode=module) in P1, so pkg/thirdcall.NewGIDService returns a
// not-implemented error for grpc mode rather than calling this.
func NewGRPC(target string) (*Client, error) {
	c, err := gidservice.NewClient(target)
	if err != nil {
		return nil, fmt.Errorf("gid grpc dial %q: %w", target, err)
	}
	return c, nil
}
