package xcodes

import "github.com/servekit/go-common/xerr"

// ErrCallerUnresolved is returned when the dashboard cannot derive the caller's
// user_id from ctx. The auth interceptor normally guarantees user_id for
// protected RPCs; this is a defensive guard before injecting the storage Owner
// (GetMyQuota's Owner is built from ctx — design spec v2 §3.2 rule 1).
var ErrCallerUnresolved = xerr.New(
	"caller_unresolved",
	xerr.CategoryUnauthorized,
	401,
	"caller identity could not be resolved from session",
)
