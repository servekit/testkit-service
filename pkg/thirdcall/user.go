package thirdcall

import (
	"fmt"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	userconfig "github.com/servekit/user-service/pkg/config"

	"github.com/servekit/testkit-service/internal/adapter"
	"github.com/servekit/testkit-service/internal/thirdcall/user"
	"github.com/servekit/testkit-service/pkg/config"
)

// UserService is the in-process user-service handler. Exposes the full
// userv1.UserServiceServer method set (Login, Register, GetSession, ...) plus
// Start/Stop. The P1 auth domain (internal/service/auth) and the auth
// interceptor (pkg/auth) call RPC methods on it directly.
type UserService = user.Handler

// NewUserService resolves user-service by mode. module mode embeds the shared
// PG/Redis pools plus the gid and message adapters (user depends on both).
func NewUserService(cfg *config.RemoteServiceConfig[*userconfig.Config], db *gorm.DB, rdb *redis.Client, gid *adapter.GIDAdapter, msg *adapter.MessageAdapter) (UserService, error) {
	switch cfg.Mode {
	case "grpc":
		return nil, fmt.Errorf("user-service grpc mode not implemented in P1 (target %q)", cfg.Target)
	case "module", "":
		return user.NewModule(cfg.Config, db, rdb, gid, msg)
	default:
		return nil, fmt.Errorf("unknown user mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}
