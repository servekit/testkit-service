// Package message is the in-process wiring for message-service.
package message

import (
	"fmt"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	gidservice "github.com/servekit/gid-service/pkg"
	messageservice "github.com/servekit/message-service/pkg"
	"github.com/servekit/message-service/pkg/config"
	msgoption "github.com/servekit/message-service/pkg/option"
)

// Handler is the in-process message-service handle: a *handler.Handler. It
// exposes the full messagev1.MessageServiceServer method set (SendEmail,
// SendSMS, ...) plus Start/Stop for lifecycle.
type Handler = *messageservice.Handler

// NewModule constructs an in-process message-service, injecting the shared PG
// and Redis pools and the raw gid handler. message-service depends on gid for
// id generation; testkit shares one gid handler across all downstreams by
// injecting the raw *gidservice.Handler (option.WithGIDHandler) rather than
// letting message open its own gid thirdcall.
func NewModule(cfg *config.Config, db *gorm.DB, rdb *redis.Client, gid *gidservice.Handler) (Handler, error) {
	hdl, err := messageservice.NewModule(cfg,
		msgoption.WithDB(db),
		msgoption.WithRedis(rdb),
		msgoption.WithGIDHandler(gid),
	)
	if err != nil {
		return nil, fmt.Errorf("message module: %w", err)
	}
	return hdl, nil
}
