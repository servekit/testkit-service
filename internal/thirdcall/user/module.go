// Package user is the in-process wiring for user-service.
package user

import (
	"fmt"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	userservice "github.com/servekit/user-service/pkg"
	"github.com/servekit/user-service/pkg/config"
	userhandler "github.com/servekit/user-service/pkg/handler"
	usroption "github.com/servekit/user-service/pkg/option"

	"github.com/servekit/testkit-service/internal/adapter"
)

// Handler is the in-process user-service handle: a *pkg/handler.Handler.
// user-service's public pkg package does not re-export the handler type (its
// NewModule returns *pkg/handler.Handler directly), so we alias the pointer
// here. testkit's auth domain + auth interceptor call RPC methods (Login,
// GetSession, ...) on it directly.
type Handler = *userhandler.Handler

// NewModule constructs an in-process user-service, injecting the shared PG and
// Redis pools plus the gid and message adapters. user-service depends on gid
// (id generation) and message (email/SMS sending); testkit shares one of each
// across all downstreams via the adapters in internal/adapter.
//
// Captcha is intentionally not injected: user-service builds its own from its
// config when the option is absent.
//
// The config is normalized first (normalizeConfig): user-service dereferences
// Session/RBAC/OAuth (and each OAuth provider) unconditionally at startup, so
// an operator leaving third_party.user.config empty would otherwise nil-deref.
// normalizeConfig backfills safe disabled defaults, merging with any values the
// operator did provide.
func NewModule(cfg *config.Config, db *gorm.DB, rdb *redis.Client, gid *adapter.GIDAdapter, msg *adapter.MessageAdapter) (Handler, error) {
	hdl, err := userservice.NewModule(normalizeConfig(cfg),
		usroption.WithDB(db),
		usroption.WithRedis(rdb),
		usroption.WithGIDService(gid),
		usroption.WithMessageService(msg),
	)
	if err != nil {
		return nil, fmt.Errorf("user module: %w", err)
	}
	return hdl, nil
}
