package message

import (
	"fmt"

	messageservice "github.com/servekit/message-service/pkg"
)

// Client is the message-service gRPC client.
type Client = messageservice.Client

// NewGRPC dials a remote message-service. Reserved for mode=grpc (P1 runs
// message in-process); pkg/thirdcall.NewMessageService returns a
// not-implemented error for grpc mode rather than calling this.
func NewGRPC(target string) (*Client, error) {
	c, err := messageservice.NewClient(target)
	if err != nil {
		return nil, fmt.Errorf("message grpc dial %q: %w", target, err)
	}
	return c, nil
}
