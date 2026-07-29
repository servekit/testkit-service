package thirdcall

import (
	"fmt"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	messageconfig "github.com/servekit/message-service/pkg/config"

	"github.com/servekit/testkit-service/internal/adapter"
	"github.com/servekit/testkit-service/internal/thirdcall/message"
	"github.com/servekit/testkit-service/pkg/config"
)

// MessageService is the in-process message-service handler. Exposes the full
// messagev1.MessageServiceServer method set (SendEmail, SendSMS, ...) plus
// Start/Stop.
type MessageService = message.Handler

// NewMessageService resolves message-service by mode. module mode embeds the
// shared PG/Redis pools and the gid adapter (message depends on gid).
func NewMessageService(cfg *config.RemoteServiceConfig[*messageconfig.Config], db *gorm.DB, rdb *redis.Client, gid *adapter.GIDAdapter) (MessageService, error) {
	switch cfg.Mode {
	case "grpc":
		return nil, fmt.Errorf("message-service grpc mode not implemented in P1 (target %q)", cfg.Target)
	case "module", "":
		return message.NewModule(cfg.Config, db, rdb, gid)
	default:
		return nil, fmt.Errorf("unknown message mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}
