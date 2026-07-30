package gid

import (
	gidservice "github.com/servekit/gid-service/pkg"
)

// moduleGID wraps an in-process gid-service Handler. owns reports whether this
// wrapper owns the Handler's lifecycle: true when the caller built it (Close
// Stops it), false when borrowed from an owner (Close is a no-op).
type moduleGID struct {
	*gidservice.Handler
	owns bool
}

// NewModule wraps a gid-service Handler as a GIDService. owns=true when the
// caller built the Handler (Close Stops it); false when injected by an owner.
// Resources (none for gid) are instantiated by the service root, not here.
func NewModule(h *gidservice.Handler, owns bool) GIDService {
	return &moduleGID{Handler: h, owns: owns}
}

// Close stops the Handler only if this wrapper owns it.
func (m *moduleGID) Close() error {
	if !m.owns {
		return nil
	}
	return m.Stop()
}
