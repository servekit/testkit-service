package message

import (
	messageservice "github.com/servekit/message-service/pkg"
)

// moduleMessage wraps an in-process message-service Handler. The wrapper owns
// none of the Handler's lifecycle; see Close.
type moduleMessage struct {
	*messageservice.Handler
}

// NewModule wraps a message-service Handler as a MessageService. The module owns
// none of the Handler's lifecycle: resolveMessage registers the raw Handler with
// the lifecycle Manager (mgr.Add drives its Start/Stop). See Close for why it is
// a no-op.
func NewModule(h *messageservice.Handler) MessageService {
	return &moduleMessage{Handler: h}
}

// Close is a no-op. The Handler's lifecycle is owned by the lifecycle Manager
// (resolveMessage registers it via mgr.Add), not by this module, so the module
// has nothing to release. The method exists only to satisfy the MessageService
// interface, whose grpc backend needs a real Close to drop its connection.
func (m *moduleMessage) Close() error {
	return nil
}
