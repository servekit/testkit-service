package storage_test

import (
	"context"
	"errors"
	"testing"

	"google.golang.org/protobuf/types/known/structpb"

	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/xerr"
	"github.com/stretchr/testify/require"

	storagev1 "github.com/servekit/storage-service/gen/storage/v1"
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/internal/service/storage"
)

// stubServer embeds storagev1.UnimplementedStorageServiceServer so it satisfies
// storagev1.StorageServiceServer (the seam storage.Service holds) with zero
// boilerplate. Each RPC under test is overridden via a function field; unset
// methods fall through to Unimplemented (returning NotImplemented), proving a
// method was reached only when its field is set.
type stubServer struct {
	storagev1.UnimplementedStorageServiceServer

	listMyFilesPaged func(context.Context, *storagev1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedResponse, error)
	getSTSCredential func(context.Context, *storagev1.GetSTSCredentialRequest) (*storagev1.GetSTSCredentialResponse, error)
	adminListFiles   func(context.Context, *storagev1.AdminListFilesRequest) (*storagev1.AdminListFilesResponse, error)
	adminGetStats    func(context.Context, *storagev1.AdminGetStatsRequest) (*storagev1.AdminGetStatsResponse, error)
	batchGetSTS      func(context.Context, *storagev1.BatchGetSTSCredentialRequest) (*storagev1.BatchGetSTSCredentialResponse, error)
	listMyAuditLogs  func(context.Context, *storagev1.ListMyAuditLogsRequest) (*storagev1.ListMyAuditLogsResponse, error)
}

func (s *stubServer) ListMyFilesPaged(ctx context.Context, req *storagev1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedResponse, error) {
	if s.listMyFilesPaged != nil {
		return s.listMyFilesPaged(ctx, req)
	}
	return s.UnimplementedStorageServiceServer.ListMyFilesPaged(ctx, req)
}

func (s *stubServer) GetSTSCredential(ctx context.Context, req *storagev1.GetSTSCredentialRequest) (*storagev1.GetSTSCredentialResponse, error) {
	if s.getSTSCredential != nil {
		return s.getSTSCredential(ctx, req)
	}
	return s.UnimplementedStorageServiceServer.GetSTSCredential(ctx, req)
}

func (s *stubServer) AdminListFiles(ctx context.Context, req *storagev1.AdminListFilesRequest) (*storagev1.AdminListFilesResponse, error) {
	if s.adminListFiles != nil {
		return s.adminListFiles(ctx, req)
	}
	return s.UnimplementedStorageServiceServer.AdminListFiles(ctx, req)
}

func (s *stubServer) AdminGetStats(ctx context.Context, req *storagev1.AdminGetStatsRequest) (*storagev1.AdminGetStatsResponse, error) {
	if s.adminGetStats != nil {
		return s.adminGetStats(ctx, req)
	}
	return s.UnimplementedStorageServiceServer.AdminGetStats(ctx, req)
}

func (s *stubServer) BatchGetSTSCredential(ctx context.Context, req *storagev1.BatchGetSTSCredentialRequest) (*storagev1.BatchGetSTSCredentialResponse, error) {
	if s.batchGetSTS != nil {
		return s.batchGetSTS(ctx, req)
	}
	return s.UnimplementedStorageServiceServer.BatchGetSTSCredential(ctx, req)
}

func (s *stubServer) ListMyAuditLogs(ctx context.Context, req *storagev1.ListMyAuditLogsRequest) (*storagev1.ListMyAuditLogsResponse, error) {
	if s.listMyAuditLogs != nil {
		return s.listMyAuditLogs(ctx, req)
	}
	return s.UnimplementedStorageServiceServer.ListMyAuditLogs(ctx, req)
}

// Close is a no-op: the stub satisfies storageservice.Service (which
// adds Close for lifecycle) without owning any real backend.
func (s *stubServer) Close() error { return nil }

// ctxWithUser returns a context carrying an authenticated user_id, mirroring
// what the P1 auth interceptor injects.
func ctxWithUser(uid int64) context.Context {
	return context.WithValue(context.Background(), grpcx.UserIDKey, uid)
}

// TestListMyFilesPaged_InjectsOwnerFromCtx is the template "my" RPC: it proves
// ownerFromCtx builds Owner{USER, ctx.user_id} and injects it into the downstream
// request, the SortField enum is int-cast, and the UserFileInfo→FileInfo response
// mapping keeps owner_type (file attribute, not identity).
func TestListMyFilesPaged_InjectsOwnerFromCtx(t *testing.T) {
	stub := &stubServer{}
	stub.listMyFilesPaged = func(_ context.Context, req *storagev1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedResponse, error) {
		require.Equal(t, storagev1.OwnerType_OWNER_TYPE_USER, req.GetOwner().GetOwnerType())
		require.Equal(t, int64(42), req.GetOwner().GetOwnerId())                // ctx user_id → owner
		require.Equal(t, storagev1.SortField_SORT_FIELD_SIZE, req.GetOrderBy()) // enum int-cast
		return &storagev1.ListMyFilesPagedResponse{
			Files:      []*storagev1.UserFileInfo{{Id: 7, Filename: "a.jpg", Size: 100, OwnerType: storagev1.OwnerType_OWNER_TYPE_USER}},
			TotalCount: 1, Page: 1, TotalPages: 1, HasMore: true,
		}, nil
	}
	svc := storage.New(stub)
	resp, err := svc.ListMyFilesPaged(ctxWithUser(42), &testkitv1.ListMyFilesPagedRequest{
		Page: 1, PageSize: 10, OrderBy: testkitv1.SortField_SORT_FIELD_SIZE,
	})
	require.NoError(t, err)
	require.Len(t, resp.GetFiles(), 1)
	require.Equal(t, int64(7), resp.GetFiles()[0].GetId())
	require.Equal(t, "a.jpg", resp.GetFiles()[0].GetFilename())
	require.Equal(t, testkitv1.OwnerType_OWNER_TYPE_USER, resp.GetFiles()[0].GetOwnerType())
	require.Equal(t, int32(1), resp.GetPage())
	require.Equal(t, int64(1), resp.GetTotalCount())
	require.True(t, resp.GetHasMore())
}

// TestMyRPC_MissingCallerReturns401 proves ownerFromCtx surfaces a missing caller
// as an xerr 401 (Unauthorized) rather than panicking. Required since every
// "my" RPC depends on the interceptor having injected user_id.
func TestMyRPC_MissingCallerReturns401(t *testing.T) {
	stub := &stubServer{} // no method set → if reached, returns NotImplemented
	svc := storage.New(stub)
	_, err := svc.ListMyFilesPaged(context.Background(), &testkitv1.ListMyFilesPagedRequest{})
	require.Error(t, err)
	var xerrErr *xerr.Error
	require.ErrorAs(t, err, &xerrErr)
	require.Equal(t, 401, xerrErr.HTTPCode())
}

// TestGetSTSCredential_InjectsOwnerAndMapsCredential is the upload-credential
// template: multi-field request forward + vendor enum int-cast + credential blob
// response mapping (access_key/secret_key/security_token/endpoint/bucket/object_key)
// + instant-upload file_info path. Owner injected from ctx.
func TestGetSTSCredential_InjectsOwnerAndMapsCredential(t *testing.T) {
	stub := &stubServer{}
	stub.getSTSCredential = func(_ context.Context, req *storagev1.GetSTSCredentialRequest) (*storagev1.GetSTSCredentialResponse, error) {
		require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
		require.Equal(t, storagev1.Vendor_VENDOR_ALIYUN_OSS, req.GetVendor())
		require.Equal(t, "photo.jpg", req.GetFilename())
		require.Equal(t, []string{".jpg"}, req.GetAllowedExtensions())
		return &storagev1.GetSTSCredentialResponse{
			Instant: true, FileId: 99,
			UploadToken: "tok",
			AccessKey:   "ak", SecretKey: "sk", SecurityToken: "st",
			Endpoint: "https://oss.example.com", Bucket: "bkt", ObjectKey: "obj",
			ExpiresAt: 1700000000,
			FileInfo:  &storagev1.UserFileInfo{Id: 99, Filename: "photo.jpg"},
		}, nil
	}
	svc := storage.New(stub)
	resp, err := svc.GetSTSCredential(ctxWithUser(42), &testkitv1.GetSTSCredentialRequest{
		Filename: "photo.jpg", Md5: "900150983cd24fb0d6963f7d28e17f72",
		ContentType: "image/jpeg", Vendor: testkitv1.Vendor_VENDOR_ALIYUN_OSS,
		AllowedExtensions: []string{".jpg"},
	})
	require.NoError(t, err)
	require.True(t, resp.GetInstant())
	require.Equal(t, int64(99), resp.GetFileId())
	require.Equal(t, "ak", resp.GetAccessKey())
	require.Equal(t, "sk", resp.GetSecretKey())
	require.Equal(t, "st", resp.GetSecurityToken())
	require.Equal(t, "https://oss.example.com", resp.GetEndpoint())
	require.Equal(t, "bkt", resp.GetBucket())
	require.Equal(t, "obj", resp.GetObjectKey())
	require.Equal(t, "tok", resp.GetUploadToken())
	require.Equal(t, int64(1700000000), resp.GetExpiresAt())
	require.NotNil(t, resp.GetFileInfo())
	require.Equal(t, "photo.jpg", resp.GetFileInfo().GetFilename())
}

// TestAdminListFiles_KeepsTargetOwner_NoCtxInjection is the admin template: the
// request's flat owner_type/owner_id are the OPERATION TARGET (filters), forwarded
// unchanged — NOT injected from ctx (the test calls with a bare context.Background
// to prove no caller identity is needed). AdminFileInfo mapping keeps the internal
// provider/bucket/object_key location fields.
func TestAdminListFiles_KeepsTargetOwner_NoCtxInjection(t *testing.T) {
	stub := &stubServer{}
	stub.adminListFiles = func(_ context.Context, req *storagev1.AdminListFilesRequest) (*storagev1.AdminListFilesResponse, error) {
		require.Equal(t, storagev1.OwnerType_OWNER_TYPE_USER, req.GetOwnerType())
		require.Equal(t, int64(77), req.GetOwnerId())
		require.Equal(t, "oss-prod", req.GetProvider())
		require.Equal(t, storagev1.SortField_SORT_FIELD_SIZE, req.GetOrderBy())
		return &storagev1.AdminListFilesResponse{
			Files: []*storagev1.AdminFileInfo{{
				Id: 1, OwnerType: storagev1.OwnerType_OWNER_TYPE_USER, OwnerId: 77,
				Filename: "x.pdf", Size: 2000, Provider: "oss-prod", Bucket: "bkt", ObjectKey: "k",
				ObjectId: 55,
			}},
			TotalCount: 1,
		}, nil
	}
	svc := storage.New(stub)
	// NOTE: context.Background() — no user_id. Admin RPCs must not need ctx owner.
	resp, err := svc.AdminListFiles(context.Background(), &testkitv1.AdminListFilesRequest{
		OwnerType: testkitv1.OwnerType_OWNER_TYPE_USER, OwnerId: 77, Provider: "oss-prod",
		OrderBy: testkitv1.SortField_SORT_FIELD_SIZE,
	})
	require.NoError(t, err)
	require.Len(t, resp.GetFiles(), 1)
	f := resp.GetFiles()[0]
	require.Equal(t, int64(1), f.GetId())
	require.Equal(t, int64(77), f.GetOwnerId())
	require.Equal(t, testkitv1.OwnerType_OWNER_TYPE_USER, f.GetOwnerType())
	require.Equal(t, "oss-prod", f.GetProvider())
	require.Equal(t, "k", f.GetObjectKey())
	require.Equal(t, int64(55), f.GetObjectId())
}

// TestAdminGetStats_MapsNestedAggregates covers the aggregated-response pattern:
// nested repeated OwnerStats/ProviderStats/BucketStats each mapped field-for-field
// with enum int-cast, plus the top-level totals. Owner filter (0 = all) forwarded.
func TestAdminGetStats_MapsNestedAggregates(t *testing.T) {
	stub := &stubServer{}
	stub.adminGetStats = func(_ context.Context, req *storagev1.AdminGetStatsRequest) (*storagev1.AdminGetStatsResponse, error) {
		require.Equal(t, storagev1.OwnerType_OWNER_TYPE_UNSPECIFIED, req.GetOwnerType())
		require.Equal(t, int64(0), req.GetOwnerId()) // 0 = all owners
		return &storagev1.AdminGetStatsResponse{
			TotalObjects: 10, TotalFiles: 50, PhysicalBytes: 5000, LogicalBytes: 8000,
			OwnerStats:    []*storagev1.OwnerStats{{OwnerType: storagev1.OwnerType_OWNER_TYPE_USER, FileCount: 50, TotalBytes: 8000}},
			ProviderStats: []*storagev1.ProviderStats{{Provider: "oss", ObjectCount: 10, TotalBytes: 5000}},
			BucketStats:   []*storagev1.BucketStats{{Bucket: "bkt", ObjectCount: 10, TotalBytes: 5000, FileCount: 50}},
		}, nil
	}
	svc := storage.New(stub)
	resp, err := svc.AdminGetStats(context.Background(), &testkitv1.AdminGetStatsRequest{})
	require.NoError(t, err)
	require.Equal(t, int64(10), resp.GetTotalObjects())
	require.Equal(t, int64(50), resp.GetTotalFiles())
	require.Equal(t, int64(5000), resp.GetPhysicalBytes())
	require.Equal(t, int64(8000), resp.GetLogicalBytes())
	require.Len(t, resp.GetOwnerStats(), 1)
	require.Equal(t, testkitv1.OwnerType_OWNER_TYPE_USER, resp.GetOwnerStats()[0].GetOwnerType())
	require.Equal(t, int64(50), resp.GetOwnerStats()[0].GetFileCount())
	require.Equal(t, int64(8000), resp.GetOwnerStats()[0].GetTotalBytes())
	require.Equal(t, "oss", resp.GetProviderStats()[0].GetProvider())
	require.Equal(t, int64(5000), resp.GetProviderStats()[0].GetTotalBytes())
	require.Equal(t, "bkt", resp.GetBucketStats()[0].GetBucket())
	require.Equal(t, int64(50), resp.GetBucketStats()[0].GetFileCount())
}

// TestBatchGetSTSCredential_MapsOneofItems covers the batch upload-credential
// path including the oneof result arms (success token | error). Owner injected.
func TestBatchGetSTSCredential_MapsOneofItems(t *testing.T) {
	stub := &stubServer{}
	stub.batchGetSTS = func(_ context.Context, req *storagev1.BatchGetSTSCredentialRequest) (*storagev1.BatchGetSTSCredentialResponse, error) {
		require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
		require.Len(t, req.GetFiles(), 1)
		require.Equal(t, "f.bin", req.GetFiles()[0].GetFilename())
		return &storagev1.BatchGetSTSCredentialResponse{
			AccessKey: "ak", SecretKey: "sk", SecurityToken: "st", Endpoint: "e", Bucket: "b", ExpiresAt: 1700,
			Items: []*storagev1.UploadCredentialItem{
				{Result: &storagev1.UploadCredentialItem_Token{Token: &storagev1.UploadTokenInfo{UploadToken: "t1", ObjectKey: "o1", FileId: 9}}},
				{Result: &storagev1.UploadCredentialItem_Error{Error: &storagev1.ItemError{Index: 1, Code: "TOO_LARGE", Message: "big"}}},
			},
		}, nil
	}
	svc := storage.New(stub)
	resp, err := svc.BatchGetSTSCredential(ctxWithUser(42), &testkitv1.BatchGetSTSCredentialRequest{
		Files: []*testkitv1.UploadFileMeta{{Md5: "900150983cd24fb0d6963f7d28e17f72", Size: 1, Filename: "f.bin", ContentType: "application/octet-stream"}},
	})
	require.NoError(t, err)
	require.Equal(t, "ak", resp.GetAccessKey())
	require.Len(t, resp.GetItems(), 2)
	require.Equal(t, "t1", resp.GetItems()[0].GetToken().GetUploadToken())
	require.Equal(t, "o1", resp.GetItems()[0].GetToken().GetObjectKey())
	require.Equal(t, int64(9), resp.GetItems()[0].GetToken().GetFileId())
	require.Equal(t, int32(1), resp.GetItems()[1].GetError().GetIndex())
	require.Equal(t, "TOO_LARGE", resp.GetItems()[1].GetError().GetCode())
	require.Equal(t, "big", resp.GetItems()[1].GetError().GetMessage())
}

// TestListMyAuditLogs_EnumCastAndStructPassthrough covers the audit pattern:
// AuditAction int-cast on the request, and AuditLogEntry mapping forwards the
// google.protobuf.Struct before/after fields by reference and int-casts every
// enum. Owner injected from ctx.
func TestListMyAuditLogs_EnumCastAndStructPassthrough(t *testing.T) {
	before, _ := structpb.NewStruct(map[string]any{"old": 1})
	after, _ := structpb.NewStruct(map[string]any{"new": 2})
	stub := &stubServer{}
	stub.listMyAuditLogs = func(_ context.Context, req *storagev1.ListMyAuditLogsRequest) (*storagev1.ListMyAuditLogsResponse, error) {
		require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
		require.Equal(t, storagev1.AuditAction_AUDIT_ACTION_UPLOAD, req.GetAction())
		require.Equal(t, storagev1.AuditLogTargetType_AUDIT_LOG_TARGET_TYPE_FILE, req.GetTargetType())
		return &storagev1.ListMyAuditLogsResponse{
			Logs: []*storagev1.AuditLogEntry{{
				Id: 1, Action: storagev1.AuditAction_AUDIT_ACTION_UPLOAD,
				OwnerType: storagev1.OwnerType_OWNER_TYPE_USER, OwnerId: 42,
				TargetType: storagev1.AuditLogTargetType_AUDIT_LOG_TARGET_TYPE_FILE, TargetId: 9,
				Before: before, After: after,
				Status: storagev1.AuditLogStatus_AUDIT_LOG_STATUS_SUCCESS, RequestId: "req-1",
			}},
			TotalCount: 1, NextPageToken: "tok",
		}, nil
	}
	svc := storage.New(stub)
	resp, err := svc.ListMyAuditLogs(ctxWithUser(42), &testkitv1.ListMyAuditLogsRequest{
		Action:     testkitv1.AuditAction_AUDIT_ACTION_UPLOAD,
		TargetType: testkitv1.AuditLogTargetType_AUDIT_LOG_TARGET_TYPE_FILE,
	})
	require.NoError(t, err)
	require.Equal(t, "tok", resp.GetNextPageToken())
	require.Equal(t, int32(1), resp.GetTotalCount())
	require.Len(t, resp.GetLogs(), 1)
	l := resp.GetLogs()[0]
	require.Equal(t, testkitv1.AuditAction_AUDIT_ACTION_UPLOAD, l.GetAction())
	require.Equal(t, testkitv1.AuditLogTargetType_AUDIT_LOG_TARGET_TYPE_FILE, l.GetTargetType())
	require.Equal(t, testkitv1.AuditLogStatus_AUDIT_LOG_STATUS_SUCCESS, l.GetStatus())
	require.Equal(t, "req-1", l.GetRequestId())
	require.Equal(t, before, l.GetBefore()) // struct forwarded by reference
	require.Equal(t, after, l.GetAfter())
}

// TestMyRPC_DownstreamErrorPassthrough proves a downstream xerr.Error is returned
// untouched (v2 §9 — never swallowed or re-wrapped into a 500).
func TestMyRPC_DownstreamErrorPassthrough(t *testing.T) {
	downErr := xerr.New("QUOTA_EXCEEDED", xerr.CategoryForbidden, 403, "quota exceeded").New()
	stub := &stubServer{}
	stub.getSTSCredential = func(context.Context, *storagev1.GetSTSCredentialRequest) (*storagev1.GetSTSCredentialResponse, error) {
		return nil, downErr
	}
	svc := storage.New(stub)
	_, err := svc.GetSTSCredential(ctxWithUser(42), &testkitv1.GetSTSCredentialRequest{
		Filename: "f", Md5: "900150983cd24fb0d6963f7d28e17f72", ContentType: "x",
	})
	require.ErrorIs(t, err, downErr)
	var xe *xerr.Error
	require.ErrorAs(t, err, &xe)
	require.Equal(t, "QUOTA_EXCEEDED", xe.Code().Reason())
	require.Equal(t, 403, xe.HTTPCode()) // original code preserved, not flattened to 500
}

// TestNew_WithStorageClientOption confirms the WithStorageClient option overrides
// the constructor-supplied client (used by tests; mirrors user.WithUserClient).
func TestNew_WithStorageClientOption(t *testing.T) {
	primary := &stubServer{}
	override := &stubServer{}
	called := false
	override.listMyFilesPaged = func(context.Context, *storagev1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedResponse, error) {
		called = true
		return &storagev1.ListMyFilesPagedResponse{}, nil
	}
	svc := storage.New(primary, storage.WithStorageClient(override))
	_, err := svc.ListMyFilesPaged(ctxWithUser(1), &testkitv1.ListMyFilesPagedRequest{})
	require.NoError(t, err)
	require.True(t, called, "WithStorageClient override must be the client actually used")
}

// errServer is a minimal stub used only to assert a non-xerr downstream error is
// returned verbatim too.
type errServer struct {
	storagev1.UnimplementedStorageServiceServer
}

var errSentinel = errors.New("boom")

func (s *errServer) ListMyFilesPaged(context.Context, *storagev1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedResponse, error) {
	return nil, errSentinel
}

// Close is a no-op: the stub satisfies storageservice.Service.
func (s *errServer) Close() error { return nil }

func TestMyRPC_PlainErrorPassthrough(t *testing.T) {
	svc := storage.New(&errServer{})
	_, err := svc.ListMyFilesPaged(ctxWithUser(1), &testkitv1.ListMyFilesPagedRequest{})
	require.ErrorIs(t, err, errSentinel)
}
