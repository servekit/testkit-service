// Package xcodes holds testkit-service's own error codes, grouped by domain.
//
// Most message-RPC errors are downstream xerr passthrough (vendor failures,
// persistence disabled, record not found) — those flow through untouched and
// are not defined here. This file covers testkit-originated conditions only.
//
// P1-P3 used go-common's shared xcodes (go-common/xerr/xcodes) exclusively;
// P4 is the first phase with a testkit-specific code, so this package is
// established here per the CLAUDE.md "pkg/xcodes/<domain>.go" convention.
package xcodes

import "github.com/servekit/go-common/xerr"

// ErrAppNotConfigured is returned when app credentials (cfg.Message or
// cfg.Storage AppKey/AppSecret) are empty at service construction time —
// fail fast on a misconfigured deployment rather than sending
// unauthenticated.
var ErrAppNotConfigured = xerr.New(
	"app_not_configured",
	xerr.CategoryInternal,
	500,
	"message app credentials are not configured",
)
