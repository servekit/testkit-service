package config_test

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

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
// fields are populated (server addrs, JWT TTL) and that pointer sub-configs —
// including the four downstream wrappers — are allocated by viper even when
// absent from the file.
func TestLoad_Defaults(t *testing.T) {
	writeConfig(t, `
log:
  level: info
`)

	cfg, err := config.Load()
	require.NoError(t, err)

	require.Equal(t, ":19095", cfg.Server.GRPCAddr)
	require.Equal(t, ":18085", cfg.Server.GatewayAddr)
	require.Equal(t, 2*time.Hour, cfg.JWT.TTL)
	require.Equal(t, "Asia/Shanghai", cfg.Cron.Timezone)

	// ThirdParty and each downstream wrapper are allocated by viper even with
	// no third_party block in the file (configx walks pointer fields).
	require.NotNil(t, cfg.ThirdParty)
	require.NotNil(t, cfg.ThirdParty.GID)
	require.NotNil(t, cfg.ThirdParty.Message)
	require.NotNil(t, cfg.ThirdParty.Storage)
	require.NotNil(t, cfg.ThirdParty.User)
	// The generic module-mode payload (T = *<svc>config.Config) is allocated too.
	require.NotNil(t, cfg.ThirdParty.GID.Config)
}

// TestLoad_ThirdPartyDownstreamConfigs verifies the four RemoteServiceConfig
// wrappers unmarshal against the REAL downstream config types (gid/message/
// storage/user), proving the generic instantiation and the verified import
// paths are correct. gid gets a deep module-mode check; the others are probed
// via mode/target to exercise the wrapper without dragging in their complex
// nested module configs.
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
`)

	cfg, err := config.Load()
	require.NoError(t, err)

	// gid: deep check — real gidconfig.Config.Snowflake.MachineID round-trips.
	require.Equal(t, "module", cfg.ThirdParty.GID.Mode)
	require.Equal(t, int64(7), cfg.ThirdParty.GID.Config.Snowflake.MachineID)

	// storage / message / user: wrapper mode + target.
	require.Equal(t, "grpc", cfg.ThirdParty.Storage.Mode)
	require.Equal(t, "localhost:19093", cfg.ThirdParty.Storage.Target)
	require.Equal(t, "grpc", cfg.ThirdParty.Message.Mode)
	require.Equal(t, "localhost:19092", cfg.ThirdParty.Message.Target)
	require.Equal(t, "grpc", cfg.ThirdParty.User.Mode)
	require.Equal(t, "localhost:19094", cfg.ThirdParty.User.Target)
}
