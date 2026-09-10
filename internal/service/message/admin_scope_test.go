// BFF admin-forward tenant clamp tests (tenant platform phase ④ T5): the
// door-side mirror of the services' server-side closure. A TENANT_ADMIN's
// tenant-naming creates are overwritten with the trusted key the gate
// injected (the body's foreign key — or its empty platform-pool value — is
// never trusted); a PLATFORM caller keeps the body as given; a TENANT_ADMIN
// whose choice never resolved fails closed.
package message_test

import (
	"context"
	"testing"

	commonv1 "github.com/servekit/api/gen/go/common/v1"
	messagev1 "github.com/servekit/api/gen/go/messaging/v1"
	userv1 "github.com/servekit/api/gen/go/user/v1"
	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/tenantctx"
	"github.com/servekit/testkit-service/internal/service/message"

	"github.com/stretchr/testify/require"
)

func adminActorCtx(userType userv1.UserType, tenantKey string) context.Context {
	ctx := grpcx.WithActor(context.Background(), &commonv1.RequestActor{
		UserId:   42,
		UserType: int32(userType),
	})
	if tenantKey != "" {
		ctx = tenantctx.WithTenantKey(ctx, tenantKey)
	}
	return ctx
}

// TestCreateChannelAccount_ClampsTenantKeyForTenantAdmin: the body forges a
// foreign tenant (and, separately, asks for the platform pool) — the
// injected key wins.
func TestCreateChannelAccount_ClampsTenantKeyForTenantAdmin(t *testing.T) {
	stub := &stubServer{
		createChannelAccountResp: &messagev1.CreateChannelAccountResponse{},
	}
	svc := message.New(stub)

	_, err := svc.CreateChannelAccount(
		adminActorCtx(userv1.UserType_USER_TYPE_TENANT_ADMIN, "ten_alpha0000000"),
		&messagev1.CreateChannelAccountRequest{Name: "forged", TenantKey: "ten_beta0000000"},
	)
	require.NoError(t, err)
	require.Equal(t, "ten_alpha0000000", stub.createChannelAccountReq.GetTenantKey(), "injected key replaces the body's foreign key")

	_, err = svc.CreateChannelAccount(
		adminActorCtx(userv1.UserType_USER_TYPE_TENANT_ADMIN, "ten_alpha0000000"),
		&messagev1.CreateChannelAccountRequest{Name: "pool-ask"},
	)
	require.NoError(t, err)
	require.Equal(t, "ten_alpha0000000", stub.createChannelAccountReq.GetTenantKey(), "scoped creates cannot enter the platform pool")
}

// TestCreateChannelAccount_PlatformKeepsBody: a PLATFORM caller (drill-down
// or cross-view) names the tenant freely — including the pool (empty).
func TestCreateChannelAccount_PlatformKeepsBody(t *testing.T) {
	stub := &stubServer{createChannelAccountResp: &messagev1.CreateChannelAccountResponse{}}
	svc := message.New(stub)

	_, err := svc.CreateChannelAccount(
		adminActorCtx(userv1.UserType_USER_TYPE_PLATFORM, "ten_beta0000000"),
		&messagev1.CreateChannelAccountRequest{Name: "drill", TenantKey: "ten_beta0000000"},
	)
	require.NoError(t, err)
	require.Equal(t, "ten_beta0000000", stub.createChannelAccountReq.GetTenantKey())

	_, err = svc.CreateChannelAccount(
		adminActorCtx(userv1.UserType_USER_TYPE_PLATFORM, ""),
		&messagev1.CreateChannelAccountRequest{Name: "pool"},
	)
	require.NoError(t, err)
	require.Empty(t, stub.createChannelAccountReq.GetTenantKey(), "cross-view pool create passes through")
}

// TestCreateChannelAccount_TenantAdminWithoutChoiceFailsClosed: an injected
// key that never resolved must not fall back to trusting the body.
func TestCreateChannelAccount_TenantAdminWithoutChoiceFailsClosed(t *testing.T) {
	stub := &stubServer{createChannelAccountResp: &messagev1.CreateChannelAccountResponse{}}
	svc := message.New(stub)

	_, err := svc.CreateChannelAccount(
		adminActorCtx(userv1.UserType_USER_TYPE_TENANT_ADMIN, ""),
		&messagev1.CreateChannelAccountRequest{Name: "x", TenantKey: "ten_beta0000000"},
	)
	require.Error(t, err)
	require.Nil(t, stub.createChannelAccountReq, "nothing is forwarded on a failed clamp")
}

// TestCreateSignatureAndCreateTenantConfig_Clamp: the same clamp covers the
// other tenant-naming creates.
func TestCreateSignatureAndCreateTenantConfig_Clamp(t *testing.T) {
	stub := &stubServer{
		createSignatureResp: &messagev1.CreateSignatureResponse{},
		createAppResp:       &messagev1.CreateTenantConfigResponse{},
	}
	svc := message.New(stub)
	ctx := adminActorCtx(userv1.UserType_USER_TYPE_TENANT_ADMIN, "ten_alpha0000000")

	_, err := svc.CreateSignature(ctx, &messagev1.CreateSignatureRequest{Name: "s", TenantKey: "ten_beta0000000"})
	require.NoError(t, err)
	require.Equal(t, "ten_alpha0000000", stub.createSignatureReq.GetTenantKey())

	_, err = svc.CreateTenantConfig(ctx, &messagev1.CreateTenantConfigRequest{Name: "a", TenantKey: "ten_beta0000000"})
	require.NoError(t, err)
	require.Equal(t, "ten_alpha0000000", stub.createAppReq.GetTenantKey())
}
