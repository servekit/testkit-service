package user

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	userconfig "github.com/servekit/user-service/pkg/config"
)

// nil sub-configs are backfilled so user-service's newWithDeps never nil-derefs
// at startup, and the Apple provider gets a parser-valid dev key.
func TestNormalizeConfig_fillsNilSubconfigs(t *testing.T) {
	cfg := NormalizeConfig(nil)

	require.NotNil(t, cfg.Session)
	assert.Equal(t, 168*time.Hour, cfg.Session.TTL)
	assert.Equal(t, "user:session", cfg.Session.KeyPrefix)
	assert.NotZero(t, cfg.Session.SessionCodeTTL)

	require.NotNil(t, cfg.RBAC)
	require.NotNil(t, cfg.RBAC.Cache, "RBAC.Cache is dereffed by cache writes")

	require.NotNil(t, cfg.OAuth)
	require.NotNil(t, cfg.OAuth.GitHub)
	require.NotNil(t, cfg.OAuth.Google)
	require.NotNil(t, cfg.OAuth.WeChat)
	require.NotNil(t, cfg.OAuth.Apple)
	assert.NotEmpty(t, cfg.OAuth.Apple.PrivateKey, "apple.New rejects an empty private key")
	assert.Contains(t, cfg.OAuth.Apple.PrivateKey, "BEGIN PRIVATE KEY")
	// validateOAuthConfig requires a non-empty http(s) redirect_url per provider.
	for _, u := range []string{
		cfg.OAuth.GitHub.RedirectURL, cfg.OAuth.Google.RedirectURL,
		cfg.OAuth.WeChat.RedirectURL, cfg.OAuth.Apple.RedirectURL,
	} {
		assert.NotEmpty(t, u, "each provider needs a placeholder redirect_url to pass validateOAuthConfig")
	}
}

// Operator-provided values win: normalize is a merge, not an overwrite.
func TestNormalizeConfig_preservesOperatorValues(t *testing.T) {
	const realKey = "-----BEGIN PRIVATE KEY-----\nreal\n-----END PRIVATE KEY-----"
	in := &userconfig.Config{
		Session: &userconfig.SessionConfig{TTL: time.Hour, KeyPrefix: "op:session"},
		OAuth: &userconfig.OAuthConfig{
			WeChat: &userconfig.OAuthWeChatConfig{AppID: "wx_op", AppSecret: "secret", RedirectURL: "https://op.example/cb"},
			Apple:  &userconfig.OAuthAppleConfig{PrivateKey: realKey, ClientID: "com.op"},
		},
	}
	out := NormalizeConfig(in)
	assert.Same(t, in, out, "should mutate in place")

	// Operator scalars preserved.
	assert.Equal(t, time.Hour, out.Session.TTL)
	assert.Equal(t, "op:session", out.Session.KeyPrefix)
	assert.Equal(t, "wx_op", out.OAuth.WeChat.AppID)
	assert.Equal(t, "https://op.example/cb", out.OAuth.WeChat.RedirectURL, "operator redirect_url must win")
	assert.Equal(t, realKey, out.OAuth.Apple.PrivateKey, "real Apple key must not be clobbered by the dev placeholder")

	// Nil providers still backfilled.
	require.NotNil(t, out.OAuth.GitHub)
	require.NotNil(t, out.OAuth.Google)
	require.NotNil(t, out.RBAC)
	require.NotNil(t, out.RBAC.Cache)
}
