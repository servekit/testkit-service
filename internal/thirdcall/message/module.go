// Package message is the in-process wiring for message-service.
package message

import (
	"fmt"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	messageservice "github.com/servekit/message-service/pkg"
	"github.com/servekit/message-service/pkg/config"
	msgoption "github.com/servekit/message-service/pkg/option"

	"github.com/servekit/testkit-service/internal/adapter"
)

// Handler is the in-process message-service handle: a *handler.Handler. It
// exposes the full messagev1.MessageServiceServer method set (SendEmail,
// SendSMS, ...) plus Start/Stop for lifecycle.
type Handler = *messageservice.Handler

// NewModule constructs an in-process message-service, injecting the shared PG
// and Redis pools and the gid adapter. message-service depends on gid for id
// generation; testkit shares one gid handler across all downstreams via the
// adapter (internal/adapter.GIDAdapter) rather than letting message open its
// own gid thirdcall.
func NewModule(cfg *config.Config, db *gorm.DB, rdb *redis.Client, gid *adapter.GIDAdapter) (Handler, error) {
	hdl, err := messageservice.NewModule(cfg,
		msgoption.WithDB(db),
		msgoption.WithRedis(rdb),
		msgoption.WithGIDService(gid),
	)
	if err != nil {
		return nil, fmt.Errorf("message module: %w", err)
	}
	return hdl, nil
}
