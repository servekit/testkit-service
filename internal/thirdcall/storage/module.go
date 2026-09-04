package storage

import (
	storagehandler "github.com/servekit/storage-service/pkg/handler"
)

// moduleStorage wraps an in-process storage-service Handler. The wrapper owns
// none of the Handler's lifecycle; see Close.
type moduleStorage struct {
	*storagehandler.Handler
}

// NewModule wraps a storage-service Handler as a StorageService. The module owns
// none of the Handler's lifecycle: resolveStorage registers the raw Handler with
// the lifecycle Manager (mgr.Add drives its Start/Stop). See Close for why it is
// a no-op.
func NewModule(h *storagehandler.Handler) StorageService {
	return &moduleStorage{Handler: h}
}

// Close is a no-op. The Handler's lifecycle is owned by the lifecycle Manager
// (resolveStorage registers it via mgr.Add), not by this module, so the module
// has nothing to release. The method exists only to satisfy the StorageService
// interface, whose grpc backend needs a real Close to drop its connection.
func (*moduleStorage) Close() error {
	return nil
}
