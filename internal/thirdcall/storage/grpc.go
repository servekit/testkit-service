package storage

import (
	"fmt"

	storageservice "github.com/servekit/storage-service/pkg"
)

// Client is the storage-service gRPC client.
type Client = storageservice.Client

// NewGRPC dials a remote storage-service. Reserved for mode=grpc (P1 runs
// storage in-process); pkg/thirdcall.NewStorageService returns a
// not-implemented error for grpc mode rather than calling this.
func NewGRPC(target string) (*Client, error) {
	c, err := storageservice.NewClient(target)
	if err != nil {
		return nil, fmt.Errorf("storage grpc dial %q: %w", target, err)
	}
	return c, nil
}
