// Package xcodes hosts testkit-service's per-domain error codes.
//
// gid domain: the gid debug RPCs (NextID / BatchNextID / Decompose) are 1:1
// forwards over the embedded gid-service handler. They introduce no
// testkit-specific errors — request validation is enforced by protovalidate
// (count ∈ [1,1000], id >= 1) and downstream failures pass through as xerr
// (design spec v2 §9). This file exists so the domain is represented in the
// per-domain xcodes layout; it declares no symbols.
package xcodes
