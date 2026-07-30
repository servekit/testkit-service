package storage

import (
	storagehandler "github.com/servekit/storage-service/pkg/handler"
)

type moduleStorage struct {
	*storagehandler.Handler
	owns bool
}

// NewModule wraps a storage-service Handler as a StorageService. owns=true when
// the caller built it; false when borrowed. Resources injected by service root.
func NewModule(h *storagehandler.Handler, owns bool) StorageService {
	return &moduleStorage{Handler: h, owns: owns}
}

func (m *moduleStorage) Close() error {
	if !m.owns {
		return nil
	}
	return m.Stop()
}
