// Package jwt issues and verifies HS256 tokens that carry a user-service
// session id.
//
// The token is the ONLY thing the frontend holds; it never contains a user_id
// (design spec §5.1). Authentication is stateful: the interceptor exchanges the
// session id for a user_id via user-service GetSession on every request, so
// logout / password change / revocation take effect immediately.
package jwt

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Manager signs and verifies HS256 tokens using a fixed secret and TTL.
type Manager struct {
	secret []byte
	ttl    time.Duration
}

// NewManager constructs a Manager. An empty secret is rejected here (at startup)
// rather than at first Sign, so a misconfigured deployment fails fast.
func NewManager(secret string, ttl time.Duration) (*Manager, error) {
	if secret == "" {
		return nil, errors.New("jwt: secret must not be empty")
	}
	return &Manager{secret: []byte(secret), ttl: ttl}, nil
}

// claims is the registered claim set plus the custom session id.
type claims struct {
	SessionID string `json:"sid"`
	jwt.RegisteredClaims
}

// Sign issues a token for the given session id. The token expires one TTL from
// now; iat/exp are both set.
func (m *Manager) Sign(sessionID string) (string, error) {
	now := time.Now()
	c := claims{
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(m.ttl)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(m.secret)
}

// Verify validates the token's signature (HS256 only) and lifetime, returning
// the embedded session id. Any failure (bad signature, expired, wrong alg,
// malformed) yields a non-nil error; callers should map all of them to a single
// 401 at the auth boundary.
func (m *Manager) Verify(token string) (string, error) {
	var c claims
	// WithValidMethods pins HS256, defeating algorithm-confusion attacks
	// (e.g. a "none" token or an RSA key replayed as an HMAC secret).
	// WithExpirationRequired rejects tokens that somehow lack an exp claim.
	_, err := jwt.ParseWithClaims(token, &c, func(_ *jwt.Token) (any, error) {
		return m.secret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithExpirationRequired())
	if err != nil {
		return "", fmt.Errorf("jwt: verify: %w", err)
	}
	return c.SessionID, nil
}
