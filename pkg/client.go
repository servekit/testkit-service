package pkg

import (
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Client is a gRPC client for testkit-service.
//
// Embeds testkitv1.TestkitServiceClient so callers can invoke RPCs directly:
//
//	c, _ := pkg.NewClient("localhost:9000")
//	testkit, _ := c.GetTestkit(ctx, &testkitv1.GetTestkitRequest{Id: 1})
type Client struct {
	conn *grpc.ClientConn
	testkitv1.TestkitServiceClient
}

// NewClient dials testkit-service at addr using insecure credentials by default.
// Pass additional DialOptions (e.g., credentials) to override.
func NewClient(addr string, opts ...grpc.DialOption) (*Client, error) {
	dialOpts := append([]grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	}, opts...)

	conn, err := grpc.NewClient(addr, dialOpts...)
	if err != nil {
		return nil, err
	}

	return &Client{
		conn:                 conn,
		TestkitServiceClient: testkitv1.NewTestkitServiceClient(conn),
	}, nil
}

// Close releases the underlying gRPC connection.
func (c *Client) Close() error { return c.conn.Close() }
