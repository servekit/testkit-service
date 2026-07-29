// Package option defines functional options for constructing the testkit
// service with optional dependency injection.
//
// Each "heavy" resource follows the own* rule:
//   - Injected via WithXxx(...)  → own=false → service won't Stop it
//   - Not injected               → own=true  → service creates from config
//     and Stops it on shutdown
//
// This prevents double-Close and lifecycle confusion when the service runs
// embedded in a parent process that owns the resources.
//
// # Available go-common resources (menu)
//
// This scaffold wires resources per the capability flags (--db / --redis /
// --thirdcall / --example). Other go-common resources can be slotted in by
// mirroring the resolveXxx pattern in internal/service/ (see demo-service):
//
//	dbx       → *gorm.DB              (wired when --db; resolveDB)
//	redisx    → *redis.Client         (wired when --redis; resolveRedis)
//	cronx     → *cron.Cron            (Options.Cron below; scaffold uses jobs.Scheduler instead)
//	captcha   → purpose-scoped, create per use case (no global injection)
//	ratelimit → purpose-scoped, create per use case (no global injection)
//	lifecycle → *lifecycle.Manager    (internal to service.Service)
//	signalx   → signal handling       (owned by cmd/server/main.go)
//	grpcx     → gRPC server utilities (owned by cmd/server/main.go)
//
// Stateless utilities (xerr, ptr, jsonx, gorx, logging) are imported directly
// where needed — no injection.
package option

import (
	"github.com/redis/go-redis/v9"
	"github.com/robfig/cron/v3"
	"gorm.io/gorm"

	"github.com/servekit/testkit-service/pkg/thirdcall"
)

// Option mutates Options.
type Option func(*Options)

// Options holds resolved dependencies. Nil means "not injected — service
// creates from cfg and Stops it on shutdown".
type Options struct {
	// Redis is the cache/key-value store. resolveRedis builds it from cfg.Redis.
	Redis *redis.Client
	// DB is the shared PostgreSQL pool. resolveDB builds it from cfg.Database.
	// The same pool is injected into every embedded downstream module so the
	// whole BFF uses one connection set.
	DB *gorm.DB
	// Cron is optional. The scaffold already wires jobs.Scheduler (built on
	// cronx) in service.setupJobs — most periodic-task needs should extend
	// that rather than inject a separate *cron.Cron. This option exists for
	// advanced cases (e.g., a parent process sharing its scheduler).
	Cron *cron.Cron

	// The four embedded downstream handlers. When injected, service.New uses
	// them as-is and does NOT register them on its lifecycle.Manager (caller
	// owns their lifecycle). When nil, service.New builds them from
	// cfg.ThirdParty and registers each via mgr.Add for full Start/Stop.
	GID     thirdcall.GIDService
	Message thirdcall.MessageService
	Storage thirdcall.StorageService
	User    thirdcall.UserService
}

// WithRedis injects an existing *redis.Client. Caller owns its lifecycle.
func WithRedis(c *redis.Client) Option { return func(o *Options) { o.Redis = c } }

// WithDB injects a shared *gorm.DB. Caller owns its lifecycle.
func WithDB(db *gorm.DB) Option { return func(o *Options) { o.DB = db } }

// WithCron injects an existing *cron.Cron. Caller owns its lifecycle. Most
// periodic-task needs should extend the scaffold's jobs.Scheduler instead.
func WithCron(c *cron.Cron) Option { return func(o *Options) { o.Cron = c } }

// WithGID injects a pre-built gid-service handler. Caller owns its lifecycle.
func WithGID(h thirdcall.GIDService) Option { return func(o *Options) { o.GID = h } }

// WithMessage injects a pre-built message-service handler. Caller owns its
// lifecycle.
func WithMessage(h thirdcall.MessageService) Option { return func(o *Options) { o.Message = h } }

// WithStorage injects a pre-built storage-service handler. Caller owns its
// lifecycle.
func WithStorage(h thirdcall.StorageService) Option { return func(o *Options) { o.Storage = h } }

// WithUser injects a pre-built user-service handler. Caller owns its lifecycle.
func WithUser(h thirdcall.UserService) Option { return func(o *Options) { o.User = h } }

// Apply evaluates all options and returns the resolved Options. A nil field
// means "not injected — service owns it and will Stop it on shutdown".
func Apply(opts ...Option) Options {
	var o Options
	for _, opt := range opts {
		opt(&o)
	}
	return o
}
