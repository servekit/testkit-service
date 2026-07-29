package user

import (
	"fmt"

	userservice "github.com/servekit/user-service/pkg"
)

// Client is the user-service gRPC client.
type Client = userservice.Client

// NewGRPC dials a remote user-service. Reserved for mode=grpc (P1 runs
// user-service in-process); pkg/thirdcall.NewUserService returns a
// not-implemented error for grpc mode rather than calling this.
func NewGRPC(target string) (*Client, error) {
	c, err := userservice.NewClient(target)
	if err != nil {
		return nil, fmt.Errorf("user grpc dial %q: %w", target, err)
	}
	return c, nil
}
