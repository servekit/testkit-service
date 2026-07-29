// Package storage is the in-process wiring for storage-service.
package storage

import (
	"fmt"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	storageservice "github.com/servekit/storage-service/pkg"
	"github.com/servekit/storage-service/pkg/config"
	storagehandler "github.com/servekit/storage-service/pkg/handler"
	stoption "github.com/servekit/storage-service/pkg/option"

	"github.com/servekit/testkit-service/internal/adapter"
)

// Handler is the in-process storage-service handle: a *pkg/handler.Handler.
// storage-service's public pkg package does not re-export the handler type
// (its NewModule returns *pkg/handler.Handler directly), so we alias the
// pointer here — the single place outside the downstream that names it.
type Handler = *storagehandler.Handler

// NewModule constructs an in-process storage-service, injecting the shared PG
// and Redis pools and the gid adapter (storage depends on gid for id
// generation).
func NewModule(cfg *config.Config, db *gorm.DB, rdb *redis.Client, gid *adapter.GIDAdapter) (Handler, error) {
	hdl, err := storageservice.NewModule(cfg,
		stoption.WithDB(db),
		stoption.WithRedis(rdb),
		stoption.WithGIDService(gid),
	)
	if err != nil {
		return nil, fmt.Errorf("storage module: %w", err)
	}
	return hdl, nil
}
