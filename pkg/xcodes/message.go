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

// ErrSenderNotConfigured is returned when cfg.Message.SenderID is empty at
// service construction time. Defense-in-depth: the SenderID default tag
// ("testkit-service") makes this unreachable in normal operation — it exists
// to fail fast on a misconfigured deployment rather than sending with an empty
// service label.
var ErrSenderNotConfigured = xerr.New(
	"sender_not_configured",
	xerr.CategoryInternal,
	500,
	"message sender_id is not configured",
)
