package gid

import (
	gidservice "github.com/servekit/gid-service/pkg"
)

// moduleGID wraps an in-process gid-service Handler. The wrapper owns none of
// the Handler's lifecycle; see Close.
type moduleGID struct {
	*gidservice.Handler
}

// NewModule wraps an in-process gid-service Handler as a GIDService. The module
// owns none of the Handler's lifecycle: resolveGID registers the raw Handler
// with the lifecycle Manager (mgr.Add drives its Start/Stop). See Close for why
// it is a no-op.
func NewModule(h *gidservice.Handler) GIDService {
	return &moduleGID{Handler: h}
}

// Close is a no-op. The Handler's lifecycle is owned by the lifecycle Manager
// (resolveGID registers it via mgr.Add), not by this module, so the module has
// nothing to release. The method exists only to satisfy the GIDService
// interface, whose grpc backend needs a real Close to drop its connection.
func (*moduleGID) Close() error {
	return nil
}
