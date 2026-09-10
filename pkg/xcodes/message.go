// Package xcodes holds testkit-service's own error codes, grouped by domain.
//
// Most message-RPC errors are downstream xerr passthrough (vendor failures,
// persistence disabled, record not found) — those flow through untouched and
// are not defined here. This file covers testkit-originated conditions only.
//
// P1-P3 used go-common's shared xcodes (go-common/xerr/xcodes) exclusively;
// P4 is the first phase with a testkit-specific code, so this package is
// established here per the CLAUDE.md "pkg/xcodes/<domain>.go" convention.
//
// The phase ④ tenant switch removed ErrAppNotConfigured along with the five
// legacy credential config groups — there are no static app credentials left
// to be missing. The domain keeps this file so it stays represented in the
// per-domain xcodes layout.
package xcodes
