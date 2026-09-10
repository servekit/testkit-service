package config_test

import (
	"github.com/servekit/go-common/configx"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/servekit/go-common/dbx"
	"github.com/servekit/testkit-service/pkg/config"
)

// writeConfig writes content to a temp file and points the configx
// <SERVICE_NAME>_CONFIG env var (TESTKIT_SERVICE_CONFIG, derived from
// serviceName) at it. Mirrors the established configx test pattern used across
// the downstream services.
func writeConfig(t *testing.T, content string) {
	t.Helper()
	tmpFile, err := os.CreateTemp("", "config-*.yaml")
	require.NoError(t, err)
	t.Cleanup(func() { _ = os.Remove(tmpFile.Name()) })
	_, err = tmpFile.WriteString(content)
	require.NoError(t, err)
	require.NoError(t, tmpFile.Close())
	t.Setenv("TESTKIT_SERVICE_CONFIG", tmpFile.Name())
}

// TestLoad_Defaults loads a minimal config and checks that default-tagged
// fields are populated (server addrs, cron timezone) and that pointer
// sub-configs — including the downstream wrappers — are allocated by viper
// even when absent from the file.
func TestLoad_Defaults(t *testing.T) {
	writeConfig(t, `
log:
  level: info
`)

	cfg, err := config.Load()
	require.NoError(t, err)

	require.Equal(t, ":19095", cfg.Server.GRPCAddr)
	require.Equal(t, ":18085", cfg.Server.GatewayAddr)
	require.Equal(t, "Asia/Shanghai", cfg.Cron.Timezone)

	// ThirdParty and each downstream wrapper are allocated by viper even with
	// no third_party block in the file (configx walks pointer fields).
	require.NotNil(t, cfg.ThirdParty)
	require.NotNil(t, cfg.ThirdParty.GID)
	require.NotNil(t, cfg.ThirdParty.Message)
	require.NotNil(t, cfg.ThirdParty.Storage)
	require.NotNil(t, cfg.ThirdParty.User)
	require.NotNil(t, cfg.ThirdParty.Portal)
	// The generic module-mode payload (T = *<svc>config.Config) is allocated too.
	require.NotNil(t, cfg.ThirdParty.GID.Config)
}

// TestLoad_ThirdPartyDownstreamConfigs verifies the RemoteServiceConfig
// wrappers unmarshal against the REAL downstream config types (gid/message/
// storage/user/portal), proving the generic instantiation and the verified
// import paths are correct. gid gets a deep module-mode check; the others are
// probed via mode/target to exercise the wrapper without dragging in their
// complex nested module configs.
func TestLoad_ThirdPartyDownstreamConfigs(t *testing.T) {
	writeConfig(t, `
third_party:
  gid:
    mode: module
    config:
      snowflake:
        machine_id: 7
  storage:
    mode: grpc
    target: localhost:19093
  message:
    mode: grpc
    target: localhost:19092
  user:
    mode: grpc
    target: localhost:19094
  portal:
    mode: grpc
    target: portal-service:19099
`)

	cfg, err := config.Load()
	require.NoError(t, err)

	// gid: deep check — real gidconfig.Config.Snowflake.MachineID round-trips.
	require.Equal(t, configx.ModeModule, cfg.ThirdParty.GID.Mode)
	require.Equal(t, int64(7), cfg.ThirdParty.GID.Config.Snowflake.MachineID)

	// storage / message / user: wrapper mode + target.
	require.Equal(t, configx.ModeGRPC, cfg.ThirdParty.Storage.Mode)
	require.Equal(t, "localhost:19093", cfg.ThirdParty.Storage.Target)
	require.Equal(t, configx.ModeGRPC, cfg.ThirdParty.Message.Mode)
	require.Equal(t, "localhost:19092", cfg.ThirdParty.Message.Target)
	require.Equal(t, configx.ModeGRPC, cfg.ThirdParty.User.Mode)
	require.Equal(t, "localhost:19094", cfg.ThirdParty.User.Target)

	// portal: the tenant-gate dependency (admin listener, grpc mode).
	require.Equal(t, configx.ModeGRPC, cfg.ThirdParty.Portal.Mode)
	require.Equal(t, "portal-service:19099", cfg.ThirdParty.Portal.Target)
}

// TestLoad_Database verifies the database block binds into dbx.Config after
// go-common's dbx refactor (driver selector + nested dialect sub-configs).
// The YAML below mirrors config.example.yaml's database block key-for-key —
// the test exists to catch a key-shape drift (e.g. host left at the top level
// after a dbx nesting change) that would otherwise silently fall back to
// defaults and connect to the wrong database at runtime.
func TestLoad_Database(t *testing.T) {
	writeConfig(t, `
database:
  driver: postgres
  postgres:
    host: postgres
    port: 5432
    user: postgres
    password: change-me
    dbname: testkit
    sslmode: disable
  max_open_conns: 25
  max_idle_conns: 10
  conn_max_lifetime: 5m
  log_level: warn
  slow_threshold: 200ms
  skip_default_tx: true
  disable_fk: true
  table_prefix: tk_
`)

	cfg, err := config.Load()
	require.NoError(t, err)
	require.NotNil(t, cfg.Database)

	// Driver + nested postgres sub-config round-trip.
	require.Equal(t, dbx.DriverPostgres, cfg.Database.Driver)
	require.NotNil(t, cfg.Database.Postgres)
	require.Equal(t, "postgres", cfg.Database.Postgres.Host)
	require.Equal(t, 5432, cfg.Database.Postgres.Port)
	require.Equal(t, "postgres", cfg.Database.Postgres.User)
	require.Equal(t, "change-me", cfg.Database.Postgres.Password)
	require.Equal(t, "testkit", cfg.Database.Postgres.DBName)
	require.Equal(t, "disable", cfg.Database.Postgres.SSLMode)

	// Shared pool + GORM options round-trip.
	require.Equal(t, 25, cfg.Database.MaxOpenConns)
	require.Equal(t, 10, cfg.Database.MaxIdleConns)
	require.Equal(t, 5*time.Minute, cfg.Database.ConnMaxLifetime)
	require.Equal(t, "warn", cfg.Database.LogLevel)
	require.Equal(t, 200*time.Millisecond, cfg.Database.SlowThreshold)
	require.True(t, cfg.Database.SkipDefaultTx)
	require.True(t, cfg.Database.DisableFK)
	require.Equal(t, "tk_", cfg.Database.TablePrefix)
}
