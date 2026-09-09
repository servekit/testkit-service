// Package config defines the testkit-service configuration shape and loads it
// via go-common's configx.
//
// serviceName and envPrefix are the two anchors external tooling (systemd
// units, Docker env, k8s configmaps) must agree on with this binary:
//
//   - serviceName ("testkit-service") drives the config-file env var
//     (TESTKIT_SERVICE_CONFIG) and the /etc/testkit-service search path.
//   - envPrefix ("TESTKIT") scopes per-field env overrides (e.g.
//     TESTKIT_SERVER_GRPC_ADDR overrides server.grpc_addr).
package config

import (
	"github.com/servekit/go-common/configx"
	"github.com/servekit/go-common/dbx"
	"github.com/servekit/go-common/logging"
	"github.com/servekit/go-common/redisx"

	gidconfig "github.com/servekit/gid-service/pkg/config"
	licenseconfig "github.com/servekit/license-service/pkg/config"
	messageconfig "github.com/servekit/message-service/pkg/config"
	referenceconfig "github.com/servekit/reference-service/pkg/config"
	storageconfig "github.com/servekit/storage-service/pkg/config"
	telemetryconfig "github.com/servekit/telemetry-service/pkg/config"
	userconfig "github.com/servekit/user-service/pkg/config"
)

const (
	serviceName = "testkit-service"
	envPrefix   = "TESTKIT"
)

// Config holds all configuration for the testkit service.
//
// testkit is a single-process BFF that embeds the four downstream services
// (gid / message / storage / user) in-process. It has no own DB tables in P1,
// but it shares one PG connection pool and one Redis client across those
// modules — hence Database and Redis live here and are injected into each
// module via option (option.WithDB / WithRedis) rather than letting each
// downstream open its own.
//
// Sub-config fields are pointers per the golang-development skill: keeps
// style consistent with the outer *Config return + functional options, and
// gives cheaper copy semantics. Note: configx (viper) ALWAYS allocates nil
// pointer fields during unmarshal, so cfg.X == nil is never true after Load —
// express "optional dependency" via an inner Enabled bool, not a pointer
// nil-check.
type Config struct {
	Server     *ServerConfig
	Database   *dbx.Config
	Redis      *redisx.Config
	CORS       *CORSConfig
	ThirdParty *ThirdPartyConfig
	Message    *MessageConfig
	Storage    *StorageConfig
	License    *LicenseConfig
	Cron       *CronConfig
	Log        *logging.Config
}

// ServerConfig holds the gRPC and grpc-gateway listener addresses.
//
// testkit exposes two listener ports: gRPC (:19095) and the grpc-gateway HTTP
// port (:18085, the BFF surface the frontend/nginx hits). The HTTP port IS the
// gateway — empty disables it.
type ServerConfig struct {
	// GRPCAddr defaults to ":19095" — the team-wide BFF gRPC port.
	GRPCAddr string `default:":19095"`
	// GatewayAddr defaults to ":18085" — the grpc-gateway HTTP port; empty
	// disables the HTTP surface.
	GatewayAddr string `default:":18085"`
}

// CORSConfig holds the allowed origins for the grpc-gateway HTTP surface.
type CORSConfig struct {
	AllowedOrigins []string
}

// CronConfig configures the internal cronx instance used by jobs.Scheduler.
// Empty by default — jobs.Scheduler is wired but registers no jobs until
// setupJobs adds them.
type CronConfig struct {
	// Timezone for cron expression evaluation. Defaults to Asia/Shanghai.
	Timezone string `default:"Asia/Shanghai"`
}

// ThirdPartyConfig groups the six downstream service settings. Each runs
// in-process (mode=module) by default; mode=grpc is reserved for splitting a
// downstream out to its own deployment later. Each downstream's own Config is
// embedded as the module-mode payload; testkit overrides its DB/Redis by
// injecting the shared connections via option, so each downstream's
// Database/Redis sub-config is left as a placeholder in config.example.yaml.
type ThirdPartyConfig struct {
	GID       *RemoteServiceConfig[*gidconfig.Config]
	Message   *RemoteServiceConfig[*messageconfig.Config]
	Storage   *RemoteServiceConfig[*storageconfig.Config]
	User      *RemoteServiceConfig[*userconfig.Config]
	License   *RemoteServiceConfig[*licenseconfig.Config]
	Telemetry *RemoteServiceConfig[*telemetryconfig.Config]
	Reference *RemoteServiceConfig[*referenceconfig.Config]
}

// RemoteServiceConfig holds connection settings for a service that can run
// in-process (module) or as a remote gRPC deployment. T is the full config
// used in module mode. This mirrors user-service's RemoteServiceConfig shape
// (the reference definition per the design spec §7) — each service in the org
// defines its own identical generic copy so no cross-module type import is
// needed just to spell the wrapper.
//
// RemoteServiceConfig is the shared third_party.<name> section shape,
// aliased from go-common so Mode is the configx.Mode enum.
type RemoteServiceConfig[T any] = configx.RemoteServiceConfig[T]

// StorageConfig holds testkit-side storage-domain settings.
//
// AppKey/AppSecret are the BFF's storage-service app credentials: created by
// `storage-service migrate --seed-from-config` (storage.bootstrap_app) or on
// the storage admin surface, injected into the downstream context of every
// data-plane call. Object keys, STS scope, and the dedup domain all hang off
// the app's key_prefix.
type StorageConfig struct {
	// AppKey identifies the calling app; service.New fail-fasts on empty.
	AppKey string
	// AppSecret authenticates the app (internal-trust, DB-plaintext).
	AppSecret string
}

// MessageConfig holds testkit-side message-domain settings.
//
// AppKey/AppSecret are the BFF's message-service app credentials: created on
// the message admin surface (ListApps → CreateApp), injected into the
// downstream context of every Send. Policy lookup, daily quota, and the
// idempotency namespace all hang off the app identity.
type MessageConfig struct {
	// AppKey identifies the calling app; service.New fail-fasts on empty.
	AppKey string
	// AppSecret authenticates the app (internal-trust, DB-plaintext).
	AppSecret string
}

// LicenseConfig holds testkit-side license-domain settings.
//
// AppKey/AppSecret are the BFF's license-service app credentials: created on
// the license admin surface (应用管理 → 新建), injected into the downstream
// context of every client-surface call (Activate/Deactivate/TrialStart —
// the client surface is fail-closed without them).
type LicenseConfig struct {
	// AppKey identifies the calling app; service.New fail-fasts on empty.
	AppKey string
	// AppSecret authenticates the app (internal-trust, DB-plaintext).
	AppSecret string
}

// Load reads config from the standard configx locations:
//   - -config flag (e.g. -config /etc/testkit-service/config.yaml)
//   - TESTKIT_SERVICE_CONFIG env var
//   - config.<ext> in the working directory and /etc/testkit-service
//
// config.example.yaml is fully placeholder-driven: every value is a ${VAR}
// reference expanded from the process environment (WithExpandEnv), so the file
// holds structure only — all actual values live in .env.example / the runtime
// env. Env vars under TESTKIT_ also override file values via viper's automatic
// binding; struct `default:` tags apply last.
func Load() (*Config, error) {
	var cfg Config
	if err := configx.Load(&cfg,
		configx.WithServiceName(serviceName),
		configx.WithEnvPrefix(envPrefix),
		// Expand ${VAR} placeholders in config values from the process env.
		configx.WithExpandEnv(),
	); err != nil {
		return nil, err
	}
	return &cfg, nil
}
