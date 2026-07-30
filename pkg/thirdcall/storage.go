package thirdcall

import (
	"fmt"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	gidservice "github.com/servekit/gid-service/pkg"
	storageconfig "github.com/servekit/storage-service/pkg/config"

	"github.com/servekit/testkit-service/internal/thirdcall/storage"
	"github.com/servekit/testkit-service/pkg/config"
)

// StorageService is the in-process storage-service handler. Exposes the full
// storagev1.StorageServiceServer method set plus Start/Stop.
type StorageService = storage.Handler

// NewStorageService resolves storage-service by mode. module mode embeds the
// shared PG/Redis pools and the raw gid handler (storage depends on gid).
func NewStorageService(cfg *config.RemoteServiceConfig[*storageconfig.Config], db *gorm.DB, rdb *redis.Client, gid *gidservice.Handler) (StorageService, error) {
	switch cfg.Mode {
	case "grpc":
		return nil, fmt.Errorf("storage-service grpc mode not implemented in P1 (target %q)", cfg.Target)
	case "module", "":
		return storage.NewModule(cfg.Config, db, rdb, gid)
	default:
		return nil, fmt.Errorf("unknown storage mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}
