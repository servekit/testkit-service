package thirdcall_test

import (
	"context"
	"testing"
	"time"

	gidv1 "github.com/servekit/gid-service/gen/gid/v1"
	gidconfig "github.com/servekit/gid-service/pkg/config"
	"github.com/stretchr/testify/require"

	"github.com/servekit/testkit-service/pkg/config"
	"github.com/servekit/testkit-service/pkg/thirdcall"
)

// validGIDConfig builds a minimal gid-service module config. gid owns no DB and
// no Redis, so module mode constructs and serves NextID entirely in-process —
// the one downstream whose full thirdcall → internal/thirdcall → downstream
// chain is exercisable without live infrastructure.
func validGIDConfig(machineID int64) *gidconfig.Config {
	return &gidconfig.Config{
		Snowflake: &gidconfig.SnowflakeConfig{
			MachineID: machineID,
			StartTime: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		},
	}
}

func TestNewGIDService_ModuleMode(t *testing.T) {
	cfg := &config.RemoteServiceConfig[*gidconfig.Config]{
		Mode:   "module",
		Config: validGIDConfig(1),
	}
	hdl, err := thirdcall.NewGIDService(cfg)
	require.NoError(t, err)
	require.NotNil(t, hdl)
	t.Cleanup(func() { _ = hdl.Stop() })

	resp, err := hdl.NextID(context.Background(), &gidv1.NextIDRequest{})
	require.NoError(t, err)
	require.NotZero(t, resp.GetId())

	// Snowflake is monotonic — a second call yields a strictly greater id.
	resp2, err := hdl.NextID(context.Background(), &gidv1.NextIDRequest{})
	require.NoError(t, err)
	require.Greater(t, resp2.GetId(), resp.GetId())
}

// TestNewGIDService_DefaultModeIsModule: an empty Mode is treated as module
// (the documented dev default), not an error.
func TestNewGIDService_DefaultModeIsModule(t *testing.T) {
	cfg := &config.RemoteServiceConfig[*gidconfig.Config]{Config: validGIDConfig(2)}
	hdl, err := thirdcall.NewGIDService(cfg)
	require.NoError(t, err)
	require.NotNil(t, hdl)
	require.NoError(t, hdl.Stop())
}

// TestNewGIDService_GRPCMode_NotImplemented: grpc mode is reserved in P1 (the
// factory returns an explicit error rather than dialing). This documents the
// stub so the deviation is caught by tests if it changes.
func TestNewGIDService_GRPCMode_NotImplemented(t *testing.T) {
	cfg := &config.RemoteServiceConfig[*gidconfig.Config]{Mode: "grpc", Target: "localhost:19091"}
	hdl, err := thirdcall.NewGIDService(cfg)
	require.Error(t, err)
	require.Nil(t, hdl)
}

// TestNewGIDService_UnknownMode: an unrecognized Mode is an error.
func TestNewGIDService_UnknownMode(t *testing.T) {
	cfg := &config.RemoteServiceConfig[*gidconfig.Config]{Mode: "carrier-pigeon", Config: validGIDConfig(3)}
	hdl, err := thirdcall.NewGIDService(cfg)
	require.Error(t, err)
	require.Nil(t, hdl)
}
