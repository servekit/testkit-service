package jwt_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/servekit/testkit-service/internal/jwt"
)

func TestNewManager_EmptySecret(t *testing.T) {
	_, err := jwt.NewManager("", time.Hour)
	require.Error(t, err)
}

func TestManager_RoundTrip(t *testing.T) {
	m, err := jwt.NewManager("super-secret", time.Hour)
	require.NoError(t, err)

	tok, err := m.Sign("sess-123")
	require.NoError(t, err)
	require.NotEmpty(t, tok)

	sid, err := m.Verify(tok)
	require.NoError(t, err)
	require.Equal(t, "sess-123", sid)
}

// TestManager_RoundTrip also implicitly proves exp is set and in the future:
// WithExpirationRequired would reject a token lacking exp, and Verify rejects
// any token whose exp has passed.
func TestManager_Verify_Expired(t *testing.T) {
	// Negative TTL issues a token that is already past its exp.
	m, err := jwt.NewManager("k", -time.Hour)
	require.NoError(t, err)

	tok, err := m.Sign("sess-x")
	require.NoError(t, err)

	_, err = m.Verify(tok)
	require.Error(t, err)
}

func TestManager_Verify_WrongSecret(t *testing.T) {
	signer, err := jwt.NewManager("key1", time.Hour)
	require.NoError(t, err)
	verifier, err := jwt.NewManager("key2", time.Hour)
	require.NoError(t, err)

	tok, err := signer.Sign("sess-y")
	require.NoError(t, err)

	_, err = verifier.Verify(tok)
	require.Error(t, err)
}

func TestManager_Verify_Malformed(t *testing.T) {
	m, err := jwt.NewManager("k", time.Hour)
	require.NoError(t, err)

	for _, tok := range []string{"", "not-a-token", "a.b.c"} {
		_, err := m.Verify(tok)
		require.Error(t, err, "expected error for token %q", tok)
	}
}
