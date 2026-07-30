package user

import (
	"time"

	userconfig "github.com/servekit/user-service/pkg/config"
)

// dummyApplePrivateKeyPEM is a throwaway ECDSA P-256 key in PKCS#8 PEM form.
//
// user-service's Apple provider constructor (identity/apple.New) unconditionally
// parses the configured private key and fails startup on an empty or malformed
// one — even when Apple Sign-In is never exercised. testkit embeds user-service
// in dev with OAuth providers disabled, so rather than require a real Apple key
// just to boot, we inject this placeholder whenever the operator hasn't supplied
// one. It is operationally meaningless: Apple Sign-In needs a key registered
// with Apple's developer portal, and a random self-generated P-256 key mints no
// valid Apple client_secret. It only satisfies the parser so the provider is
// constructable in a disabled state. Generated with:
//
//	openssl ecparam -genkey -name prime256v1 -noout | openssl pkcs8 -topk8 -nocrypt
const dummyApplePrivateKeyPEM = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgty3HHciboENXO973
aPaWQXlFujZpCQrZmRq4pEQb1UChRANCAASUUANiq4muQasdqqs4LysHf6R9fz0m
qaS8KFe2kBzdJujTV29GItdXzfsYIBmMf5dvUFh6xJZkqFPTA0rlLqf7
-----END PRIVATE KEY-----`

// defaultOAuthRedirectURL returns the placeholder callback URL testkit injects
// for an OAuth provider the operator hasn't configured. user-service's
// validateRedirectURL rejects an empty value (each non-nil provider must have a
// reachable-looking callback), but the URL is only actually used when a real
// client_id/secret is present — empty credentials mean the provider is
// disabled, so the placeholder is never hit at runtime. It points at testkit's
// own grpc-gateway port so it at least resembles a real BFF callback in logs.
const defaultOAuthRedirectURL = "http://localhost:18085/oauth/callback"

// defaultSessionConfig returns the SessionConfig values user-service documents
// as defaults via struct `default:` tags. configx only applies those tags when
// loading from YAML, so when testkit builds the sub-config in code (because the
// operator left third_party.user.config empty) it must populate them itself.
func defaultSessionConfig() *userconfig.SessionConfig {
	return &userconfig.SessionConfig{
		TTL:                168 * time.Hour, // 7d
		MaxSessions:        5,
		KeyPrefix:          "user:session",
		UserSessionsPrefix: "user:user_sessions",
		SessionCodeTTL:     5 * time.Minute,
	}
}

// NormalizeConfig fills in the sub-configs that user-service's newWithDeps
// dereferences unconditionally at startup — Session (session.NewManager),
// RBAC + RBAC.Cache (cache.NewRBACCache reads Cache on every write), and OAuth
// plus its four providers (social provider constructors; apple.New parses the
// private key) — with safe disabled defaults, merging with whatever the
// operator already provided. Non-nil sub-configs win; within OAuth.Apple the
// operator's PrivateKey wins over the dev placeholder. With everything
// user-service dereferences made non-nil, the embedded module boots without
// real OAuth/captcha credentials (Captcha, Cron, and RateLimit are already
// nil-safe inside user-service; gid/message are injected via options).
//
// cfg may be nil — testkit's config block can be left empty, and configx does
// not allocate the inner *userconfig.Config until the operator populates it.
func NormalizeConfig(cfg *userconfig.Config) *userconfig.Config {
	if cfg == nil {
		cfg = &userconfig.Config{}
	}
	if cfg.Session == nil {
		cfg.Session = defaultSessionConfig()
	}
	if cfg.RBAC == nil {
		cfg.RBAC = &userconfig.RBACConfig{Cache: &userconfig.RBACCacheConfig{}}
	} else if cfg.RBAC.Cache == nil {
		cfg.RBAC.Cache = &userconfig.RBACCacheConfig{}
	}
	if cfg.OAuth == nil {
		cfg.OAuth = &userconfig.OAuthConfig{}
	}
	if cfg.OAuth.GitHub == nil {
		cfg.OAuth.GitHub = &userconfig.OAuthGitHubConfig{}
	}
	if cfg.OAuth.Google == nil {
		cfg.OAuth.Google = &userconfig.OAuthGoogleConfig{}
	}
	if cfg.OAuth.WeChat == nil {
		cfg.OAuth.WeChat = &userconfig.OAuthWeChatConfig{}
	}
	if cfg.OAuth.Apple == nil {
		cfg.OAuth.Apple = &userconfig.OAuthAppleConfig{}
	}
	// apple.New rejects an empty private key; inject the dev placeholder only
	// when the operator hasn't supplied a real one.
	if cfg.OAuth.Apple.PrivateKey == "" {
		cfg.OAuth.Apple.PrivateKey = dummyApplePrivateKeyPEM
	}
	// validateOAuthConfig (socialsvc.New) requires each non-nil provider to
	// carry a non-empty http(s) redirect_url. Since newWithDeps forces all four
	// providers non-nil, backfill a placeholder callback for any the operator
	// left without one. Empty client credentials keep the providers disabled, so
	// the placeholder is never used at runtime.
	if cfg.OAuth.GitHub.RedirectURL == "" {
		cfg.OAuth.GitHub.RedirectURL = defaultOAuthRedirectURL
	}
	if cfg.OAuth.Google.RedirectURL == "" {
		cfg.OAuth.Google.RedirectURL = defaultOAuthRedirectURL
	}
	if cfg.OAuth.WeChat.RedirectURL == "" {
		cfg.OAuth.WeChat.RedirectURL = defaultOAuthRedirectURL
	}
	if cfg.OAuth.Apple.RedirectURL == "" {
		cfg.OAuth.Apple.RedirectURL = defaultOAuthRedirectURL
	}
	return cfg
}
