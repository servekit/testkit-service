// Package storage implements testkit's storage domain: it maps testkit DTOs to
// storage-service protos and back. This is the ONLY package in testkit-service
// that imports both testkitv1 and storagev1 (design spec v2 §3.4) — it is the
// testkit-msg ↔ storage-msg mapping boundary. pkg/handler and the testkit proto
// see only testkitv1; the downstream storage handler is reached exclusively
// through the storageservice.Service seam held here.
//
// Curation rules (v2 §3.2):
//   - "My" RPCs (GenerateUploadURL / GetSTSCredential / BatchGetSTSCredential /
//     ConfirmUpload / CancelUpload / GenerateDownloadURL / GenerateProcessURL /
//     GenerateCDNURL / ListMyFiles / ListMyFilesPaged / GetMyFile / UpdateMyFile /
//     DeleteMyFile / BatchDeleteMyFiles / GetMyQuota / ListMyAuditLogs) drop the
//     caller's owner from the request — it is read from the authenticated context
//     (grpcx.GetUserIDFromCtx, injected by the P1 auth interceptor) and injected
//     into the downstream request as Owner{OWNER_TYPE_USER, user_id} via the
//     shared ownerFromCtx helper. The testkit request carries no owner field.
//   - Admin and owner-quota RPCs (AdminListFiles / AdminGetFile / AdminDeleteFile /
//     AdminGetQuota / AdminSetQuota / AdminGetStats / AdminListProviders /
//     AdminListBuckets / AdminSoftDeleteOwnerFiles / AdminDeleteOwner /
//     AdminListAuditLogs / SetOwnerQuota / AddOwnerQuota) keep the flat
//     owner_type + owner_id pair on the request. That pair is the OPERATION
//     TARGET (the owner being acted on / filtered by), not the caller's identity,
//     so it is forwarded unchanged (built into the downstream request's flat
//     owner_type/owner_id fields, NOT injected from ctx).
//
// The admin RPCs do NO RBAC enforcement this stage (decision: user-service RBAC
// is CRUD-only for now; enforcement is deferred to a future OPA integration).
// They are pure forwards — login state + identity injection are handled by the
// interceptor, and downstream storage-service applies its own business checks.
//
// The enums in testkit.proto mirror storage-service name-for-name and
// number-for-number, so every enum conversion below is a plain int cast
// (storagev1.SortField(req.GetOrderBy())) — no string table. Field names line up
// 1:1 with storage-service; the only transformation is the curation (testkit
// omits caller-identity owner + the request_id trace fields) and the int-cast on
// enums. Downstream xerr.Error is passed through untouched (v2 §9) — never
// swallowed or re-wrapped.
package storage

import (
	"context"

	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/xerr/xcodes"

	storagev1 "github.com/servekit/storage-service/gen/storage/v1"
	storageservice "github.com/servekit/storage-service/pkg"
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
)

// Service implements testkit's storage domain. The storage field is typed as
// the storageservice.Service interface — the in-process wrapper and
// gRPC client both satisfy it; test stubs embed
// storagev1.UnimplementedStorageServiceServer, override the methods under test,
// and add a no-op Close (Task 2).
type Service struct {
	storage storageservice.Service
}

// Option configures a Service (for test injection).
type Option func(*Service)

// WithStorageClient overrides the embedded storage client (tests).
func WithStorageClient(c storageservice.Service) Option {
	return func(s *Service) { s.storage = c }
}

// New constructs the storage-domain service. client is the embedded
// storage-service handler (storageservice.Service).
func New(client storageservice.Service, opts ...Option) *Service {
	s := &Service{storage: client}
	for _, o := range opts {
		o(s)
	}
	return s
}

// ownerFromCtx is the trust-boundary injection for all "my-*" RPCs: it reads the
// caller's user_id from ctx (injected by the P1 auth interceptor) and builds
// Owner{OWNER_TYPE_USER, user_id}. A missing user_id maps to a 401 — this should
// never happen behind the interceptor (every storage RPC requires login), but is
// surfaced as Unauthorized rather than panicking. Mirrors user.userIDFromCtx.
func ownerFromCtx(ctx context.Context) (*storagev1.Owner, error) {
	uid, err := grpcx.GetUserIDFromCtx(ctx)
	if err != nil {
		return nil, xcodes.ErrUnauthorized.Wrap(err)
	}
	return &storagev1.Owner{
		OwnerType: storagev1.OwnerType_OWNER_TYPE_USER,
		OwnerId:   uid,
	}, nil
}

// --- Upload (owner injected from ctx) ---

// GenerateUploadURL returns a single-use presigned PUT URL (or an instant
// file_id on MD5 dedup). Owner is injected from ctx.
func (s *Service) GenerateUploadURL(ctx context.Context, req *testkitv1.GenerateUploadURLRequest) (*testkitv1.GenerateUploadURLResponse, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.storage.GenerateUploadURL(ctx, &storagev1.GenerateUploadURLRequest{
		Filename:    req.GetFilename(),
		Size:        req.GetSize(),
		Md5:         req.GetMd5(),
		ContentType: req.GetContentType(),
		Bucket:      req.GetBucket(),
		FilePath:    req.GetFilePath(),
		Description: req.GetDescription(),
		Metadata:    req.GetMetadata(),
		Vendor:      storagev1.Vendor(req.GetVendor()),
		Owner:       owner,
		RequestId:   req.GetRequestId(),
	})
	if err != nil {
		return nil, err
	}
	return &testkitv1.GenerateUploadURLResponse{
		Instant:     resp.GetInstant(),
		FileId:      resp.GetFileId(),
		FileInfo:    toTestkitFileInfo(resp.GetFileInfo()),
		UploadToken: resp.GetUploadToken(),
		UploadUrl:   resp.GetUploadUrl(),
		ObjectKey:   resp.GetObjectKey(),
		Headers:     resp.GetHeaders(),
	}, nil
}

// GetSTSCredential returns STS temporary credentials + an upload token for
// client-side upload. Owner is injected from ctx.
func (s *Service) GetSTSCredential(ctx context.Context, req *testkitv1.GetSTSCredentialRequest) (*testkitv1.GetSTSCredentialResponse, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.storage.GetSTSCredential(ctx, &storagev1.GetSTSCredentialRequest{
		Bucket:            req.GetBucket(),
		MaxSize:           req.GetMaxSize(),
		Filename:          req.GetFilename(),
		Md5:               req.GetMd5(),
		ContentType:       req.GetContentType(),
		FilePath:          req.GetFilePath(),
		Description:       req.GetDescription(),
		Metadata:          req.GetMetadata(),
		Vendor:            storagev1.Vendor(req.GetVendor()),
		Ttl:               req.GetTtl(),
		AllowedExtensions: req.GetAllowedExtensions(),
		Owner:             owner,
		RequestId:         req.GetRequestId(),
	})
	if err != nil {
		return nil, err
	}
	return &testkitv1.GetSTSCredentialResponse{
		Instant:       resp.GetInstant(),
		FileId:        resp.GetFileId(),
		FileInfo:      toTestkitFileInfo(resp.GetFileInfo()),
		UploadToken:   resp.GetUploadToken(),
		AccessKey:     resp.GetAccessKey(),
		SecretKey:     resp.GetSecretKey(),
		SecurityToken: resp.GetSecurityToken(),
		Endpoint:      resp.GetEndpoint(),
		Bucket:        resp.GetBucket(),
		ObjectKey:     resp.GetObjectKey(),
		ExpiresAt:     resp.GetExpiresAt(),
	}, nil
}

// BatchGetSTSCredential returns one shared STS credential + per-file upload
// tokens (or per-file errors) via a oneof. Owner is injected from ctx.
func (s *Service) BatchGetSTSCredential(ctx context.Context, req *testkitv1.BatchGetSTSCredentialRequest) (*testkitv1.BatchGetSTSCredentialResponse, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	files := make([]*storagev1.UploadFileMeta, 0, len(req.GetFiles()))
	for _, f := range req.GetFiles() {
		files = append(files, &storagev1.UploadFileMeta{
			Md5:         f.GetMd5(),
			Size:        f.GetSize(),
			Filename:    f.GetFilename(),
			ContentType: f.GetContentType(),
			FilePath:    f.GetFilePath(),
			Description: f.GetDescription(),
			Metadata:    f.GetMetadata(),
		})
	}
	resp, err := s.storage.BatchGetSTSCredential(ctx, &storagev1.BatchGetSTSCredentialRequest{
		Files:             files,
		Bucket:            req.GetBucket(),
		Ttl:               req.GetTtl(),
		AllowedExtensions: req.GetAllowedExtensions(),
		Owner:             owner,
		RequestId:         req.GetRequestId(),
	})
	if err != nil {
		return nil, err
	}
	items := make([]*testkitv1.UploadCredentialItem, 0, len(resp.GetItems()))
	for _, it := range resp.GetItems() {
		items = append(items, toTestkitUploadCredentialItem(it))
	}
	return &testkitv1.BatchGetSTSCredentialResponse{
		AccessKey:     resp.GetAccessKey(),
		SecretKey:     resp.GetSecretKey(),
		SecurityToken: resp.GetSecurityToken(),
		Endpoint:      resp.GetEndpoint(),
		Bucket:        resp.GetBucket(),
		ExpiresAt:     resp.GetExpiresAt(),
		Items:         items,
	}, nil
}

// ConfirmUpload finalizes an upload: storage verifies the upload_token's HMAC +
// owner and lands the file record. Owner is injected from ctx.
func (s *Service) ConfirmUpload(ctx context.Context, req *testkitv1.ConfirmUploadRequest) (*testkitv1.ConfirmUploadResponse, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.storage.ConfirmUpload(ctx, &storagev1.ConfirmUploadRequest{
		UploadToken: req.GetUploadToken(),
		Owner:       owner,
		RequestId:   req.GetRequestId(),
	})
	if err != nil {
		return nil, err
	}
	return &testkitv1.ConfirmUploadResponse{
		FileId:   resp.GetFileId(),
		FileInfo: toTestkitFileInfo(resp.GetFileInfo()),
	}, nil
}

// CancelUpload invalidates an upload_token. Owner is injected from ctx.
func (s *Service) CancelUpload(ctx context.Context, req *testkitv1.CancelUploadRequest) (*emptypb.Empty, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	return s.storage.CancelUpload(ctx, &storagev1.CancelUploadRequest{
		UploadToken: req.GetUploadToken(),
		Owner:       owner,
		RequestId:   req.GetRequestId(),
	})
}

// --- Download / Process (owner injected from ctx) ---

// GenerateDownloadURL returns a presigned download URL for the caller's file.
// Owner is injected from ctx.
func (s *Service) GenerateDownloadURL(ctx context.Context, req *testkitv1.GenerateDownloadURLRequest) (*testkitv1.GenerateDownloadURLResponse, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.storage.GenerateDownloadURL(ctx, &storagev1.GenerateDownloadURLRequest{
		FileId:     req.GetFileId(),
		TtlSeconds: req.GetTtlSeconds(),
		Filename:   req.Filename, // optional string → *string forwarded verbatim
		Owner:      owner,
	})
	if err != nil {
		return nil, err
	}
	return &testkitv1.GenerateDownloadURLResponse{
		DownloadUrl: resp.GetDownloadUrl(),
		ExpiresAt:   resp.GetExpiresAt(),
	}, nil
}

// GenerateProcessURL returns a presigned image-processing URL. Owner is injected
// from ctx; image ops are int-cast (the nested Type enum is mirrored at the
// testkit top level as ImageProcessType, same number).
func (s *Service) GenerateProcessURL(ctx context.Context, req *testkitv1.GenerateProcessURLRequest) (*testkitv1.GenerateProcessURLResponse, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.storage.GenerateProcessURL(ctx, &storagev1.GenerateProcessURLRequest{
		FileId:     req.GetFileId(),
		Ops:        toStorageImageProcessOps(req.GetOps()),
		TtlSeconds: req.GetTtlSeconds(),
		Owner:      owner,
	})
	if err != nil {
		return nil, err
	}
	return &testkitv1.GenerateProcessURLResponse{
		Url:       resp.GetUrl(),
		ExpiresAt: resp.GetExpiresAt(),
	}, nil
}

// GenerateCDNURL returns a (signed or public) CDN URL. Owner is injected from ctx.
func (s *Service) GenerateCDNURL(ctx context.Context, req *testkitv1.GenerateCDNURLRequest) (*testkitv1.GenerateCDNURLResponse, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.storage.GenerateCDNURL(ctx, &storagev1.GenerateCDNURLRequest{
		FileId:    req.GetFileId(),
		Ops:       toStorageImageProcessOps(req.GetOps()),
		Ttl:       req.GetTtl(),
		Public:    req.GetPublic(),
		Filename:  req.Filename, // optional string → *string forwarded verbatim
		Owner:     owner,
		RequestId: req.GetRequestId(),
	})
	if err != nil {
		return nil, err
	}
	return &testkitv1.GenerateCDNURLResponse{
		Url:       resp.GetUrl(),
		ExpiresAt: resp.GetExpiresAt(),
	}, nil
}

// --- My Files (owner injected from ctx) ---

// ListMyFiles lists the caller's files with cursor pagination. Owner is injected
// from ctx.
func (s *Service) ListMyFiles(ctx context.Context, req *testkitv1.ListMyFilesRequest) (*testkitv1.ListMyFilesResponse, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.storage.ListMyFiles(ctx, &storagev1.ListMyFilesRequest{
		PathPrefix:        req.GetPathPrefix(),
		Extension:         req.GetExtension(),
		ContentTypePrefix: req.GetContentTypePrefix(),
		OrderBy:           storagev1.SortField(req.GetOrderBy()),
		Descending:        req.GetDescending(),
		PageSize:          req.GetPageSize(),
		PageToken:         req.GetPageToken(),
		Owner:             owner,
	})
	if err != nil {
		return nil, err
	}
	files := make([]*testkitv1.FileInfo, 0, len(resp.GetFiles()))
	for _, f := range resp.GetFiles() {
		files = append(files, toTestkitFileInfo(f))
	}
	return &testkitv1.ListMyFilesResponse{
		Files:         files,
		NextPageToken: resp.GetNextPageToken(),
	}, nil
}

// ListMyFilesPaged lists the caller's files with offset pagination. Owner is
// injected from ctx; SortField is int-cast.
func (s *Service) ListMyFilesPaged(ctx context.Context, req *testkitv1.ListMyFilesPagedRequest) (*testkitv1.ListMyFilesPagedResponse, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.storage.ListMyFilesPaged(ctx, &storagev1.ListMyFilesPagedRequest{
		Page:              req.GetPage(),
		PageSize:          req.GetPageSize(),
		PathPrefix:        req.GetPathPrefix(),
		Extension:         req.GetExtension(),
		ContentTypePrefix: req.GetContentTypePrefix(),
		OrderBy:           storagev1.SortField(req.GetOrderBy()),
		Descending:        req.GetDescending(),
		Owner:             owner,
	})
	if err != nil {
		return nil, err
	}
	files := make([]*testkitv1.FileInfo, 0, len(resp.GetFiles()))
	for _, f := range resp.GetFiles() {
		files = append(files, toTestkitFileInfo(f))
	}
	return &testkitv1.ListMyFilesPagedResponse{
		Files:      files,
		TotalCount: resp.GetTotalCount(),
		Page:       resp.GetPage(),
		TotalPages: resp.GetTotalPages(),
		HasMore:    resp.GetHasMore(),
	}, nil
}

// GetMyFile returns the caller's file by id. Owner is injected from ctx.
func (s *Service) GetMyFile(ctx context.Context, req *testkitv1.GetMyFileRequest) (*testkitv1.FileInfo, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	f, err := s.storage.GetMyFile(ctx, &storagev1.GetMyFileRequest{
		FileId: req.GetFileId(),
		Owner:  owner,
	})
	if err != nil {
		return nil, err
	}
	return toTestkitFileInfo(f), nil
}

// UpdateMyFile updates the caller's file. Optional fields are forwarded as
// pointers (nil = leave unchanged). Owner is injected from ctx.
func (s *Service) UpdateMyFile(ctx context.Context, req *testkitv1.UpdateMyFileRequest) (*testkitv1.FileInfo, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	f, err := s.storage.UpdateMyFile(ctx, &storagev1.UpdateMyFileRequest{
		FileId:        req.GetFileId(),
		Filename:      req.Filename,
		FilePath:      req.FilePath,
		Description:   req.Description,
		Metadata:      req.GetMetadata(),
		ClearMetadata: req.ClearMetadata,
		Owner:         owner,
		RequestId:     req.GetRequestId(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitFileInfo(f), nil
}

// DeleteMyFile deletes the caller's file. Owner is injected from ctx.
func (s *Service) DeleteMyFile(ctx context.Context, req *testkitv1.DeleteMyFileRequest) (*emptypb.Empty, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	return s.storage.DeleteMyFile(ctx, &storagev1.DeleteMyFileRequest{
		FileId:    req.GetFileId(),
		Owner:     owner,
		RequestId: req.GetRequestId(),
	})
}

// BatchDeleteMyFiles deletes multiple of the caller's files. Owner is injected
// from ctx.
func (s *Service) BatchDeleteMyFiles(ctx context.Context, req *testkitv1.BatchDeleteMyFilesRequest) (*testkitv1.BatchDeleteMyFilesResponse, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.storage.BatchDeleteMyFiles(ctx, &storagev1.BatchDeleteMyFilesRequest{
		FileIds:   req.GetFileIds(),
		Owner:     owner,
		RequestId: req.GetRequestId(),
	})
	if err != nil {
		return nil, err
	}
	return &testkitv1.BatchDeleteMyFilesResponse{
		DeletedCount: resp.GetDeletedCount(),
		FailedIds:    resp.GetFailedIds(),
	}, nil
}

// --- My Quota / Audit (owner injected from ctx) ---

// GetMyQuota returns the caller's quota. Owner is injected from ctx.
func (s *Service) GetMyQuota(ctx context.Context, _ *emptypb.Empty) (*testkitv1.QuotaInfo, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	q, err := s.storage.GetMyQuota(ctx, &storagev1.GetMyQuotaRequest{Owner: owner})
	if err != nil {
		return nil, err
	}
	return toTestkitQuotaInfo(q), nil
}

// ListMyAuditLogs lists audit logs for the caller. Owner is injected from ctx;
// AuditAction / AuditLogTargetType are int-cast.
func (s *Service) ListMyAuditLogs(ctx context.Context, req *testkitv1.ListMyAuditLogsRequest) (*testkitv1.ListMyAuditLogsResponse, error) {
	owner, err := ownerFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.storage.ListMyAuditLogs(ctx, &storagev1.ListMyAuditLogsRequest{
		Action:     storagev1.AuditAction(req.GetAction()),
		TargetType: storagev1.AuditLogTargetType(req.GetTargetType()),
		StartTime:  req.GetStartTime(),
		EndTime:    req.GetEndTime(),
		PageSize:   req.GetPageSize(),
		PageToken:  req.GetPageToken(),
		Owner:      owner,
	})
	if err != nil {
		return nil, err
	}
	logs := make([]*testkitv1.AuditLogEntry, 0, len(resp.GetLogs()))
	for _, e := range resp.GetLogs() {
		logs = append(logs, toTestkitAuditLogEntry(e))
	}
	return &testkitv1.ListMyAuditLogsResponse{
		Logs:          logs,
		TotalCount:    resp.GetTotalCount(),
		NextPageToken: resp.GetNextPageToken(),
	}, nil
}

// --- Owner quota (BFF-internal orchestration; target owner kept on request) ---
//
// SetOwnerQuota / AddOwnerQuota carry the target owner_type + owner_id on the
// request (the business being billed), NOT the caller. Forwarded unchanged.

// SetOwnerQuota sets an owner's total quota. The target owner is forwarded from
// the request — no ctx injection.
func (s *Service) SetOwnerQuota(ctx context.Context, req *testkitv1.SetOwnerQuotaRequest) (*testkitv1.QuotaInfo, error) {
	q, err := s.storage.SetOwnerQuota(ctx, &storagev1.SetOwnerQuotaRequest{
		OwnerType:  storagev1.OwnerType(req.GetOwnerType()),
		OwnerId:    req.GetOwnerId(),
		TotalBytes: req.GetTotalBytes(),
		RequestId:  req.GetRequestId(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitQuotaInfo(q), nil
}

// AddOwnerQuota adjusts an owner's quota by a (possibly negative) delta. The
// target owner is forwarded from the request — no ctx injection.
func (s *Service) AddOwnerQuota(ctx context.Context, req *testkitv1.AddOwnerQuotaRequest) (*testkitv1.QuotaInfo, error) {
	q, err := s.storage.AddOwnerQuota(ctx, &storagev1.AddOwnerQuotaRequest{
		OwnerType:  storagev1.OwnerType(req.GetOwnerType()),
		OwnerId:    req.GetOwnerId(),
		DeltaBytes: req.GetDeltaBytes(),
		RequestId:  req.GetRequestId(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitQuotaInfo(q), nil
}

// --- Admin (target owner kept on request) ---
//
// Admin RPCs forward the target owner_type + owner_id (or file_id) straight from
// the request — no ctx injection. The caller is an operator acting on a target
// owner/file, not the owner themselves (design §3.2). No RBAC enforcement this
// stage; downstream storage-service applies its own business checks.

// AdminListFiles lists files across owners. owner_type/owner_id are filters
// forwarded from the request.
func (s *Service) AdminListFiles(ctx context.Context, req *testkitv1.AdminListFilesRequest) (*testkitv1.AdminListFilesResponse, error) {
	resp, err := s.storage.AdminListFiles(ctx, &storagev1.AdminListFilesRequest{
		OwnerType:         storagev1.OwnerType(req.GetOwnerType()),
		OwnerId:           req.GetOwnerId(),
		PathPrefix:        req.GetPathPrefix(),
		Extension:         req.GetExtension(),
		ContentTypePrefix: req.GetContentTypePrefix(),
		OrderBy:           storagev1.SortField(req.GetOrderBy()),
		Descending:        req.GetDescending(),
		PageSize:          req.GetPageSize(),
		PageToken:         req.GetPageToken(),
		Provider:          req.GetProvider(),
		Bucket:            req.GetBucket(),
	})
	if err != nil {
		return nil, err
	}
	files := make([]*testkitv1.AdminFileInfo, 0, len(resp.GetFiles()))
	for _, f := range resp.GetFiles() {
		files = append(files, toTestkitAdminFileInfo(f))
	}
	return &testkitv1.AdminListFilesResponse{
		Files:         files,
		TotalCount:    resp.GetTotalCount(),
		NextPageToken: resp.GetNextPageToken(),
	}, nil
}

// AdminGetFile returns a file by id (admin view, includes provider/bucket
// location). No ctx injection.
func (s *Service) AdminGetFile(ctx context.Context, req *testkitv1.AdminGetFileRequest) (*testkitv1.AdminFileInfo, error) {
	f, err := s.storage.AdminGetFile(ctx, &storagev1.AdminGetFileRequest{FileId: req.GetFileId()})
	if err != nil {
		return nil, err
	}
	return toTestkitAdminFileInfo(f), nil
}

// AdminDeleteFile hard-deletes a file by id. No ctx injection.
func (s *Service) AdminDeleteFile(ctx context.Context, req *testkitv1.AdminDeleteFileRequest) (*emptypb.Empty, error) {
	return s.storage.AdminDeleteFile(ctx, &storagev1.AdminDeleteFileRequest{
		FileId:    req.GetFileId(),
		RequestId: req.GetRequestId(),
	})
}

// AdminGetQuota returns an owner's quota. The target owner is forwarded from the
// request.
func (s *Service) AdminGetQuota(ctx context.Context, req *testkitv1.AdminGetQuotaRequest) (*testkitv1.QuotaInfo, error) {
	q, err := s.storage.AdminGetQuota(ctx, &storagev1.AdminGetQuotaRequest{
		OwnerType: storagev1.OwnerType(req.GetOwnerType()),
		OwnerId:   req.GetOwnerId(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitQuotaInfo(q), nil
}

// AdminSetQuota sets an owner's total quota. The target owner is forwarded from
// the request.
func (s *Service) AdminSetQuota(ctx context.Context, req *testkitv1.AdminSetQuotaRequest) (*testkitv1.QuotaInfo, error) {
	q, err := s.storage.AdminSetQuota(ctx, &storagev1.AdminSetQuotaRequest{
		OwnerType:  storagev1.OwnerType(req.GetOwnerType()),
		OwnerId:    req.GetOwnerId(),
		TotalBytes: req.GetTotalBytes(),
		RequestId:  req.GetRequestId(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitQuotaInfo(q), nil
}

// AdminGetStats returns aggregated storage statistics, optionally filtered by a
// target owner (0 = all). The target owner is forwarded from the request.
func (s *Service) AdminGetStats(ctx context.Context, req *testkitv1.AdminGetStatsRequest) (*testkitv1.AdminGetStatsResponse, error) {
	resp, err := s.storage.AdminGetStats(ctx, &storagev1.AdminGetStatsRequest{
		OwnerType: storagev1.OwnerType(req.GetOwnerType()),
		OwnerId:   req.GetOwnerId(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitAdminGetStatsResponse(resp), nil
}

// AdminListProviders lists configured storage providers. No request body.
func (s *Service) AdminListProviders(ctx context.Context, _ *emptypb.Empty) (*testkitv1.AdminListProvidersResponse, error) {
	resp, err := s.storage.AdminListProviders(ctx, &emptypb.Empty{})
	if err != nil {
		return nil, err
	}
	providers := make([]*testkitv1.ProviderInfo, 0, len(resp.GetProviders()))
	for _, p := range resp.GetProviders() {
		providers = append(providers, &testkitv1.ProviderInfo{
			Name:     p.GetName(),
			Vendor:   testkitv1.Vendor(p.GetVendor()),
			Endpoint: p.GetEndpoint(),
			Region:   p.GetRegion(),
		})
	}
	return &testkitv1.AdminListProvidersResponse{Providers: providers}, nil
}

// AdminListBuckets lists configured storage buckets. No request body.
func (s *Service) AdminListBuckets(ctx context.Context, _ *emptypb.Empty) (*testkitv1.AdminListBucketsResponse, error) {
	resp, err := s.storage.AdminListBuckets(ctx, &emptypb.Empty{})
	if err != nil {
		return nil, err
	}
	buckets := make([]*testkitv1.BucketInfo, 0, len(resp.GetBuckets()))
	for _, b := range resp.GetBuckets() {
		buckets = append(buckets, &testkitv1.BucketInfo{
			Name:      b.GetName(),
			Provider:  b.GetProvider(),
			KeyPrefix: b.GetKeyPrefix(),
			Acl:       testkitv1.BucketACL(b.GetAcl()),
			Vendor:    testkitv1.Vendor(b.GetVendor()),
		})
	}
	return &testkitv1.AdminListBucketsResponse{Buckets: buckets}, nil
}

// AdminSoftDeleteOwnerFiles soft-deletes all files belonging to a target owner.
// The target owner is forwarded from the request.
func (s *Service) AdminSoftDeleteOwnerFiles(ctx context.Context, req *testkitv1.AdminSoftDeleteOwnerFilesRequest) (*testkitv1.AdminSoftDeleteOwnerFilesResponse, error) {
	resp, err := s.storage.AdminSoftDeleteOwnerFiles(ctx, &storagev1.AdminSoftDeleteOwnerFilesRequest{
		OwnerType: storagev1.OwnerType(req.GetOwnerType()),
		OwnerId:   req.GetOwnerId(),
		RequestId: req.GetRequestId(),
	})
	if err != nil {
		return nil, err
	}
	return &testkitv1.AdminSoftDeleteOwnerFilesResponse{
		FilesDeleted:  resp.GetFilesDeleted(),
		BytesReleased: resp.GetBytesReleased(),
	}, nil
}

// AdminDeleteOwner deletes a target owner and all its files. The target owner is
// forwarded from the request.
func (s *Service) AdminDeleteOwner(ctx context.Context, req *testkitv1.AdminDeleteOwnerRequest) (*testkitv1.AdminDeleteOwnerResponse, error) {
	resp, err := s.storage.AdminDeleteOwner(ctx, &storagev1.AdminDeleteOwnerRequest{
		OwnerType: storagev1.OwnerType(req.GetOwnerType()),
		OwnerId:   req.GetOwnerId(),
		RequestId: req.GetRequestId(),
	})
	if err != nil {
		return nil, err
	}
	return &testkitv1.AdminDeleteOwnerResponse{
		FilesDeleted:  resp.GetFilesDeleted(),
		BytesReleased: resp.GetBytesReleased(),
	}, nil
}

// AdminListAuditLogs lists audit logs with rich filters. request_id here is a
// FILTER (find logs by request_id), not caller traceability — forwarded. All
// enums int-cast; the target owner is forwarded from the request.
func (s *Service) AdminListAuditLogs(ctx context.Context, req *testkitv1.AdminListAuditLogsRequest) (*testkitv1.AdminListAuditLogsResponse, error) {
	resp, err := s.storage.AdminListAuditLogs(ctx, &storagev1.AdminListAuditLogsRequest{
		Action:     storagev1.AuditAction(req.GetAction()),
		TargetType: storagev1.AuditLogTargetType(req.GetTargetType()),
		Status:     storagev1.AuditLogStatus(req.GetStatus()),
		RequestId:  req.GetRequestId(),
		OwnerType:  storagev1.OwnerType(req.GetOwnerType()),
		OwnerId:    req.GetOwnerId(),
		TargetId:   req.GetTargetId(),
		StartTime:  req.GetStartTime(),
		EndTime:    req.GetEndTime(),
		PageSize:   req.GetPageSize(),
		PageToken:  req.GetPageToken(),
	})
	if err != nil {
		return nil, err
	}
	logs := make([]*testkitv1.AuditLogEntry, 0, len(resp.GetLogs()))
	for _, e := range resp.GetLogs() {
		logs = append(logs, toTestkitAuditLogEntry(e))
	}
	return &testkitv1.AdminListAuditLogsResponse{
		Logs:          logs,
		TotalCount:    resp.GetTotalCount(),
		NextPageToken: resp.GetNextPageToken(),
	}, nil
}

// --- converters: testkit DTO ↔ storage-service proto ---
//
// Enums are mirrored same-name/same-number between testkit.proto and
// storage-service, so each is a plain int cast. Field names line up 1:1. The
// downstream gen has no Empty alias, so Empty RPCs use *emptypb.Empty directly.

// toTestkitFileInfo maps a storage UserFileInfo (the "my" view) to testkit
// FileInfo. owner_type is the file's attribute (who owns it), not caller
// identity, so it is kept. nil input yields nil output.
func toTestkitFileInfo(f *storagev1.UserFileInfo) *testkitv1.FileInfo {
	if f == nil {
		return nil
	}
	return &testkitv1.FileInfo{
		Id:          f.GetId(),
		Filename:    f.GetFilename(),
		FilePath:    f.GetFilePath(),
		Description: f.GetDescription(),
		Metadata:    f.GetMetadata(),
		IsPublic:    f.GetIsPublic(),
		OwnerType:   testkitv1.OwnerType(f.GetOwnerType()),
		Size:        f.GetSize(),
		ContentType: f.GetContentType(),
		Extension:   f.GetExtension(),
		Md5:         f.GetMd5(),
		CreatedAt:   f.GetCreatedAt(),
		UpdatedAt:   f.GetUpdatedAt(),
	}
}

// toTestkitAdminFileInfo maps a storage AdminFileInfo (the admin view, including
// provider/bucket/object location) to testkit AdminFileInfo. nil → nil.
func toTestkitAdminFileInfo(f *storagev1.AdminFileInfo) *testkitv1.AdminFileInfo {
	if f == nil {
		return nil
	}
	return &testkitv1.AdminFileInfo{
		Id:          f.GetId(),
		OwnerType:   testkitv1.OwnerType(f.GetOwnerType()),
		OwnerId:     f.GetOwnerId(),
		Filename:    f.GetFilename(),
		FilePath:    f.GetFilePath(),
		Description: f.GetDescription(),
		Metadata:    f.GetMetadata(),
		IsPublic:    f.GetIsPublic(),
		ObjectId:    f.GetObjectId(),
		Size:        f.GetSize(),
		ContentType: f.GetContentType(),
		Extension:   f.GetExtension(),
		Md5:         f.GetMd5(),
		Provider:    f.GetProvider(),
		Bucket:      f.GetBucket(),
		ObjectKey:   f.GetObjectKey(),
		CreatedAt:   f.GetCreatedAt(),
		UpdatedAt:   f.GetUpdatedAt(),
	}
}

// toTestkitQuotaInfo maps a storage QuotaInfo to testkit QuotaInfo. nil → nil.
func toTestkitQuotaInfo(q *storagev1.QuotaInfo) *testkitv1.QuotaInfo {
	if q == nil {
		return nil
	}
	return &testkitv1.QuotaInfo{
		TotalBytes:     q.GetTotalBytes(),
		UsedBytes:      q.GetUsedBytes(),
		AvailableBytes: q.GetAvailableBytes(),
		FileCount:      q.GetFileCount(),
	}
}

// toTestkitAuditLogEntry maps a storage AuditLogEntry to testkit AuditLogEntry.
// before/after (google.protobuf.Struct) are forwarded by reference. nil → nil.
func toTestkitAuditLogEntry(e *storagev1.AuditLogEntry) *testkitv1.AuditLogEntry {
	if e == nil {
		return nil
	}
	return &testkitv1.AuditLogEntry{
		Id:           e.GetId(),
		Action:       testkitv1.AuditAction(e.GetAction()),
		OwnerType:    testkitv1.OwnerType(e.GetOwnerType()),
		OwnerId:      e.GetOwnerId(),
		TargetType:   testkitv1.AuditLogTargetType(e.GetTargetType()),
		TargetId:     e.GetTargetId(),
		Before:       e.GetBefore(),
		After:        e.GetAfter(),
		Status:       testkitv1.AuditLogStatus(e.GetStatus()),
		ErrorMessage: e.GetErrorMessage(),
		RequestId:    e.GetRequestId(),
		CreatedAt:    e.GetCreatedAt(),
	}
}

// toTestkitAdminGetStatsResponse maps the aggregated stats response, recursing
// into the nested OwnerStats / ProviderStats / BucketStats slices. nil → nil.
func toTestkitAdminGetStatsResponse(r *storagev1.AdminGetStatsResponse) *testkitv1.AdminGetStatsResponse {
	if r == nil {
		return nil
	}
	owners := make([]*testkitv1.OwnerStats, 0, len(r.GetOwnerStats()))
	for _, o := range r.GetOwnerStats() {
		owners = append(owners, &testkitv1.OwnerStats{
			OwnerType:  testkitv1.OwnerType(o.GetOwnerType()),
			FileCount:  o.GetFileCount(),
			TotalBytes: o.GetTotalBytes(),
		})
	}
	providers := make([]*testkitv1.ProviderStats, 0, len(r.GetProviderStats()))
	for _, p := range r.GetProviderStats() {
		providers = append(providers, &testkitv1.ProviderStats{
			Provider:    p.GetProvider(),
			ObjectCount: p.GetObjectCount(),
			TotalBytes:  p.GetTotalBytes(),
		})
	}
	buckets := make([]*testkitv1.BucketStats, 0, len(r.GetBucketStats()))
	for _, b := range r.GetBucketStats() {
		buckets = append(buckets, &testkitv1.BucketStats{
			Bucket:      b.GetBucket(),
			ObjectCount: b.GetObjectCount(),
			TotalBytes:  b.GetTotalBytes(),
			FileCount:   b.GetFileCount(),
		})
	}
	return &testkitv1.AdminGetStatsResponse{
		TotalObjects:  r.GetTotalObjects(),
		TotalFiles:    r.GetTotalFiles(),
		PhysicalBytes: r.GetPhysicalBytes(),
		LogicalBytes:  r.GetLogicalBytes(),
		OwnerStats:    owners,
		ProviderStats: providers,
		BucketStats:   buckets,
	}
}

// toStorageImageProcessOps maps a slice of testkit ImageProcessOp to storage.
// Type is the nested enum storagev1.ImageProcessOp_Type (testkit hoists it to
// the top level as ImageProcessType, same number → plain int cast). Format and
// ResizeMode are int-cast like the other top-level enums.
func toStorageImageProcessOps(ops []*testkitv1.ImageProcessOp) []*storagev1.ImageProcessOp {
	out := make([]*storagev1.ImageProcessOp, 0, len(ops))
	for _, o := range ops {
		out = append(out, &storagev1.ImageProcessOp{
			Type:          storagev1.ImageProcessOp_Type(o.GetType()),
			Width:         o.GetWidth(),
			Height:        o.GetHeight(),
			Format:        storagev1.ImageFormat(o.GetFormat()),
			Quality:       o.GetQuality(),
			ResizeMode:    storagev1.ImageResizeMode(o.GetResizeMode()),
			WatermarkText: o.GetWatermarkText(),
			RotateDegrees: o.GetRotateDegrees(),
		})
	}
	return out
}

// toTestkitUploadCredentialItem maps the oneof result (success token | error).
// The two oneof arms are mirrored name-for-name in testkit.
func toTestkitUploadCredentialItem(it *storagev1.UploadCredentialItem) *testkitv1.UploadCredentialItem {
	switch v := it.GetResult().(type) {
	case *storagev1.UploadCredentialItem_Token:
		return &testkitv1.UploadCredentialItem{Result: &testkitv1.UploadCredentialItem_Token{Token: &testkitv1.UploadTokenInfo{
			UploadToken: v.Token.GetUploadToken(),
			ExpiresAt:   v.Token.GetExpiresAt(),
			FileId:      v.Token.GetFileId(),
			ObjectKey:   v.Token.GetObjectKey(),
		}}}
	case *storagev1.UploadCredentialItem_Error:
		return &testkitv1.UploadCredentialItem{Result: &testkitv1.UploadCredentialItem_Error{Error: &testkitv1.ItemError{
			Index:   v.Error.GetIndex(),
			Code:    v.Error.GetCode(),
			Message: v.Error.GetMessage(),
		}}}
	}
	return nil
}
