// P3 storage RPCs: my-files / uploads / STS / admin storage — thin delegates to internal/service/storage.
package handler

import (
	"context"

	storagev1 "github.com/servekit/api/gen/go/storage/v1"
	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"

	"google.golang.org/protobuf/types/known/emptypb"
)

// --- Storage-domain RPCs (P3: my-files / upload / quota / audit / admin) ---
//
// Each is a thin delegate to the storage domain (internal/service/storage). The
// handler holds no storage logic; "my" RPCs read the caller's user_id from ctx
// (via ownerFromCtx inside the domain) and admin/owner-quota RPCs carry their
// flat target owner_type/owner_id on the request. No RBAC enforcement this stage.

// --- Upload (owner injected from ctx inside the domain) ---

// GenerateUploadURL returns a single-use presigned PUT URL for client upload.
func (h *Handler) GenerateUploadURL(ctx context.Context, req *testkitv1.GenerateUploadURLRequest) (*testkitv1.GenerateUploadURLResponse, error) {
	return h.svc.Storage().GenerateUploadURL(ctx, req)
}

// GetSTSCredential returns STS temporary credentials for client-side upload.
func (h *Handler) GetSTSCredential(ctx context.Context, req *testkitv1.GetSTSCredentialRequest) (*testkitv1.GetSTSCredentialResponse, error) {
	return h.svc.Storage().GetSTSCredential(ctx, req)
}

// BatchGetSTSCredential returns one linkd STS credential + per-file tokens.
func (h *Handler) BatchGetSTSCredential(ctx context.Context, req *testkitv1.BatchGetSTSCredentialRequest) (*testkitv1.BatchGetSTSCredentialResponse, error) {
	return h.svc.Storage().BatchGetSTSCredential(ctx, req)
}

// ConfirmUpload finalizes an upload after the client PUT the bytes to OSS.
func (h *Handler) ConfirmUpload(ctx context.Context, req *testkitv1.ConfirmUploadRequest) (*testkitv1.ConfirmUploadResponse, error) {
	return h.svc.Storage().ConfirmUpload(ctx, req)
}

// CancelUpload invalidates an upload_token before the upload completes.
func (h *Handler) CancelUpload(ctx context.Context, req *testkitv1.CancelUploadRequest) (*emptypb.Empty, error) {
	return h.svc.Storage().CancelUpload(ctx, req)
}

// --- Download / Process (owner injected from ctx) ---

// GenerateDownloadURL returns a presigned download URL for the caller's file.
func (h *Handler) GenerateDownloadURL(ctx context.Context, req *testkitv1.GenerateDownloadURLRequest) (*testkitv1.GenerateDownloadURLResponse, error) {
	return h.svc.Storage().GenerateDownloadURL(ctx, req)
}

// CreateFileLink mints or renews an anonymous link token for a file.
func (h *Handler) CreateFileLink(ctx context.Context, req *testkitv1.CreateFileLinkRequest) (*testkitv1.CreateFileLinkResponse, error) {
	return h.svc.Storage().CreateFileLink(ctx, req)
}

// GetFileLinkDownload is the anonymous file-link backend — the token is
// the credential (public method, no login required).
func (h *Handler) GetFileLinkDownload(ctx context.Context, req *testkitv1.GetFileLinkDownloadRequest) (*testkitv1.GetFileLinkDownloadResponse, error) {
	return h.svc.Storage().GetFileLinkDownload(ctx, req)
}

// GenerateProcessURL returns a presigned image-processing URL.
func (h *Handler) GenerateProcessURL(ctx context.Context, req *testkitv1.GenerateProcessURLRequest) (*testkitv1.GenerateProcessURLResponse, error) {
	return h.svc.Storage().GenerateProcessURL(ctx, req)
}

// GenerateCDNURL returns a signed or public CDN URL.
func (h *Handler) GenerateCDNURL(ctx context.Context, req *testkitv1.GenerateCDNURLRequest) (*testkitv1.GenerateCDNURLResponse, error) {
	return h.svc.Storage().GenerateCDNURL(ctx, req)
}

// --- My Files (owner injected from ctx) ---

// ListMyFiles lists the caller's files (cursor pagination).
func (h *Handler) ListMyFiles(ctx context.Context, req *testkitv1.ListMyFilesRequest) (*testkitv1.ListMyFilesResponse, error) {
	return h.svc.Storage().ListMyFiles(ctx, req)
}

// ListMyFilesPaged lists the caller's files (offset pagination + totals).
func (h *Handler) ListMyFilesPaged(ctx context.Context, req *testkitv1.ListMyFilesPagedRequest) (*testkitv1.ListMyFilesPagedResponse, error) {
	return h.svc.Storage().ListMyFilesPaged(ctx, req)
}

// GetMyFile returns the caller's file by id.
func (h *Handler) GetMyFile(ctx context.Context, req *testkitv1.GetMyFileRequest) (*testkitv1.FileInfo, error) {
	return h.svc.Storage().GetMyFile(ctx, req)
}

// UpdateMyFile updates the caller's file.
func (h *Handler) UpdateMyFile(ctx context.Context, req *testkitv1.UpdateMyFileRequest) (*testkitv1.FileInfo, error) {
	return h.svc.Storage().UpdateMyFile(ctx, req)
}

// DeleteMyFile deletes the caller's file.
func (h *Handler) DeleteMyFile(ctx context.Context, req *testkitv1.DeleteMyFileRequest) (*emptypb.Empty, error) {
	return h.svc.Storage().DeleteMyFile(ctx, req)
}

// BatchDeleteMyFiles deletes multiple of the caller's files.
func (h *Handler) BatchDeleteMyFiles(ctx context.Context, req *testkitv1.BatchDeleteMyFilesRequest) (*testkitv1.BatchDeleteMyFilesResponse, error) {
	return h.svc.Storage().BatchDeleteMyFiles(ctx, req)
}

// --- My Quota / Audit (owner injected from ctx) ---

// GetMyQuota returns the caller's quota.
func (h *Handler) GetMyQuota(ctx context.Context, req *emptypb.Empty) (*testkitv1.QuotaInfo, error) {
	return h.svc.Storage().GetMyQuota(ctx, req)
}

// ListMyAuditLogs lists audit logs for the caller.
func (h *Handler) ListMyAuditLogs(ctx context.Context, req *testkitv1.ListMyAuditLogsRequest) (*testkitv1.ListMyAuditLogsResponse, error) {
	return h.svc.Storage().ListMyAuditLogs(ctx, req)
}

// --- Owner quota (target owner on request) ---

// --- Admin (target owner / file_id on request; no RBAC enforcement this stage) ---

// AdminListFiles lists files across owners (admin view).
func (h *Handler) AdminListFiles(ctx context.Context, req *testkitv1.AdminListFilesRequest) (*testkitv1.AdminListFilesResponse, error) {
	return h.svc.Storage().AdminListFiles(ctx, req)
}

// AdminGetFile returns a file by id (admin view, includes storage location).
func (h *Handler) AdminGetFile(ctx context.Context, req *testkitv1.AdminGetFileRequest) (*testkitv1.AdminFileInfo, error) {
	return h.svc.Storage().AdminGetFile(ctx, req)
}

// AdminDeleteFile hard-deletes a file by id.
func (h *Handler) AdminDeleteFile(ctx context.Context, req *testkitv1.AdminDeleteFileRequest) (*emptypb.Empty, error) {
	return h.svc.Storage().AdminDeleteFile(ctx, req)
}

// AdminGetQuota returns a target owner's quota.
func (h *Handler) AdminGetQuota(ctx context.Context, req *testkitv1.AdminGetQuotaRequest) (*testkitv1.QuotaInfo, error) {
	return h.svc.Storage().AdminGetQuota(ctx, req)
}

// AdminSetQuota sets a target owner's total quota.
func (h *Handler) AdminSetQuota(ctx context.Context, req *testkitv1.AdminSetQuotaRequest) (*testkitv1.QuotaInfo, error) {
	return h.svc.Storage().AdminSetQuota(ctx, req)
}

// AdminGetStats returns aggregated storage statistics.
func (h *Handler) AdminGetStats(ctx context.Context, req *testkitv1.AdminGetStatsRequest) (*testkitv1.AdminGetStatsResponse, error) {
	return h.svc.Storage().AdminGetStats(ctx, req)
}

// AdminListProviders lists configured storage providers.
func (h *Handler) AdminListProviders(ctx context.Context, req *emptypb.Empty) (*testkitv1.AdminListProvidersResponse, error) {
	return h.svc.Storage().AdminListProviders(ctx, req)
}

// AdminListBuckets lists configured storage buckets.
func (h *Handler) AdminListBuckets(ctx context.Context, req *emptypb.Empty) (*testkitv1.AdminListBucketsResponse, error) {
	return h.svc.Storage().AdminListBuckets(ctx, req)
}

// AdminSoftDeleteOwnerFiles soft-deletes all files belonging to a target owner.
func (h *Handler) AdminSoftDeleteOwnerFiles(ctx context.Context, req *testkitv1.AdminSoftDeleteOwnerFilesRequest) (*testkitv1.AdminSoftDeleteOwnerFilesResponse, error) {
	return h.svc.Storage().AdminSoftDeleteOwnerFiles(ctx, req)
}

// AdminDeleteOwner deletes a target owner and all its files.
func (h *Handler) AdminDeleteOwner(ctx context.Context, req *testkitv1.AdminDeleteOwnerRequest) (*testkitv1.AdminDeleteOwnerResponse, error) {
	return h.svc.Storage().AdminDeleteOwner(ctx, req)
}

// AdminListAuditLogs lists audit logs with rich filters.
func (h *Handler) AdminListAuditLogs(ctx context.Context, req *testkitv1.AdminListAuditLogsRequest) (*testkitv1.AdminListAuditLogsResponse, error) {
	return h.svc.Storage().AdminListAuditLogs(ctx, req)
}

// --- storage platform management (providers / buckets / settings) ---
// 1:1 forwards; the testkit proto imports storage.v1 admin payloads directly.

// AdminCreateProvider adds a provider; the live registry rebuilds downstream.
func (h *Handler) AdminCreateProvider(ctx context.Context, req *storagev1.AdminCreateProviderRequest) (*storagev1.AdminCreateProviderResponse, error) {
	return h.svc.Storage().AdminCreateProvider(ctx, req)
}

// AdminUpdateProvider edits a provider (credentials replace-on-present).
func (h *Handler) AdminUpdateProvider(ctx context.Context, req *storagev1.AdminUpdateProviderRequest) (*storagev1.AdminUpdateProviderResponse, error) {
	return h.svc.Storage().AdminUpdateProvider(ctx, req)
}

// AdminDeleteProvider removes a provider (rejected while buckets are bound).
func (h *Handler) AdminDeleteProvider(ctx context.Context, req *storagev1.AdminDeleteProviderRequest) (*emptypb.Empty, error) {
	return h.svc.Storage().AdminDeleteProvider(ctx, req)
}

// AdminUpsertBucket creates or fully replaces a bucket binding.
func (h *Handler) AdminUpsertBucket(ctx context.Context, req *storagev1.AdminUpsertBucketRequest) (*storagev1.AdminUpsertBucketResponse, error) {
	return h.svc.Storage().AdminUpsertBucket(ctx, req)
}

// AdminDeleteBucket removes a bucket binding (rejected while objects exist).
func (h *Handler) AdminDeleteBucket(ctx context.Context, req *storagev1.AdminDeleteBucketRequest) (*emptypb.Empty, error) {
	return h.svc.Storage().AdminDeleteBucket(ctx, req)
}

// AdminGetSettings returns the runtime settings row (default/public bucket).
func (h *Handler) AdminGetSettings(ctx context.Context, req *storagev1.AdminGetSettingsRequest) (*storagev1.AdminGetSettingsResponse, error) {
	return h.svc.Storage().AdminGetSettings(ctx, req)
}

// AdminUpdateSettings updates the runtime settings row.
func (h *Handler) AdminUpdateSettings(ctx context.Context, req *storagev1.AdminUpdateSettingsRequest) (*storagev1.AdminUpdateSettingsResponse, error) {
	return h.svc.Storage().AdminUpdateSettings(ctx, req)
}
