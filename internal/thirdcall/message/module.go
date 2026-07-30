package message

import (
	messageservice "github.com/servekit/message-service/pkg"
)

type moduleMessage struct {
	*messageservice.Handler
	owns bool
}

// NewModule wraps a message-service Handler as a MessageService. owns=true when
// the caller built the Handler; false when borrowed. Resources (db/redis/gid)
// are instantiated by the service root and injected into the downstream module
// there — this wrapper only wraps.
func NewModule(h *messageservice.Handler, owns bool) MessageService {
	return &moduleMessage{Handler: h, owns: owns}
}

func (m *moduleMessage) Close() error {
	if !m.owns {
		return nil
	}
	return m.Handler.Stop()
}
