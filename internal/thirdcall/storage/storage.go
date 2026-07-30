// Package storage adapts storage-service to testkit's internal needs. Mirrors
// user-service's thirdcall pattern.
package storage

import (
	"context"

	"google.golang.org/protobuf/types/known/emptypb"

	storagev1 "github.com/servekit/storage-service/gen/storage/v1"
)

// StorageService is the subset of storage-service testkit forwards (storage
// domain + dashboard GetMyQuota). Methods take/return storage-service proto
// verbatim.
type StorageService interface {
	GenerateUploadURL(context.Context, *storagev1.GenerateUploadURLRequest) (*storagev1.GenerateUploadURLResponse, error)
	GetSTSCredential(context.Context, *storagev1.GetSTSCredentialRequest) (*storagev1.GetSTSCredentialResponse, error)
	BatchGetSTSCredential(context.Context, *storagev1.BatchGetSTSCredentialRequest) (*storagev1.BatchGetSTSCredentialResponse, error)
	ConfirmUpload(context.Context, *storagev1.ConfirmUploadRequest) (*storagev1.ConfirmUploadResponse, error)
	CancelUpload(context.Context, *storagev1.CancelUploadRequest) (*emptypb.Empty, error)
	GenerateDownloadURL(context.Context, *storagev1.GenerateDownloadURLRequest) (*storagev1.GenerateDownloadURLResponse, error)
	ListMyFiles(context.Context, *storagev1.ListMyFilesRequest) (*storagev1.ListMyFilesResponse, error)
	ListMyFilesPaged(context.Context, *storagev1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedResponse, error)
	GetMyFile(context.Context, *storagev1.GetMyFileRequest) (*storagev1.UserFileInfo, error)
	UpdateMyFile(context.Context, *storagev1.UpdateMyFileRequest) (*storagev1.UserFileInfo, error)
	DeleteMyFile(context.Context, *storagev1.DeleteMyFileRequest) (*emptypb.Empty, error)
	BatchDeleteMyFiles(context.Context, *storagev1.BatchDeleteMyFilesRequest) (*storagev1.BatchDeleteMyFilesResponse, error)
	GenerateProcessURL(context.Context, *storagev1.GenerateProcessURLRequest) (*storagev1.GenerateProcessURLResponse, error)
	GenerateCDNURL(context.Context, *storagev1.GenerateCDNURLRequest) (*storagev1.GenerateCDNURLResponse, error)
	GetMyQuota(context.Context, *storagev1.GetMyQuotaRequest) (*storagev1.QuotaInfo, error)
	AdminListFiles(context.Context, *storagev1.AdminListFilesRequest) (*storagev1.AdminListFilesResponse, error)
	AdminGetFile(context.Context, *storagev1.AdminGetFileRequest) (*storagev1.AdminFileInfo, error)
	AdminDeleteFile(context.Context, *storagev1.AdminDeleteFileRequest) (*emptypb.Empty, error)
	AdminGetQuota(context.Context, *storagev1.AdminGetQuotaRequest) (*storagev1.QuotaInfo, error)
	AdminSetQuota(context.Context, *storagev1.AdminSetQuotaRequest) (*storagev1.QuotaInfo, error)
	AdminGetStats(context.Context, *storagev1.AdminGetStatsRequest) (*storagev1.AdminGetStatsResponse, error)
	AdminListProviders(context.Context, *emptypb.Empty) (*storagev1.AdminListProvidersResponse, error)
	AdminListBuckets(context.Context, *emptypb.Empty) (*storagev1.AdminListBucketsResponse, error)
	AdminSoftDeleteOwnerFiles(context.Context, *storagev1.AdminSoftDeleteOwnerFilesRequest) (*storagev1.AdminSoftDeleteOwnerFilesResponse, error)
	AdminDeleteOwner(context.Context, *storagev1.AdminDeleteOwnerRequest) (*storagev1.AdminDeleteOwnerResponse, error)
	ListMyAuditLogs(context.Context, *storagev1.ListMyAuditLogsRequest) (*storagev1.ListMyAuditLogsResponse, error)
	AdminListAuditLogs(context.Context, *storagev1.AdminListAuditLogsRequest) (*storagev1.AdminListAuditLogsResponse, error)
	SetOwnerQuota(context.Context, *storagev1.SetOwnerQuotaRequest) (*storagev1.QuotaInfo, error)
	AddOwnerQuota(context.Context, *storagev1.AddOwnerQuotaRequest) (*storagev1.QuotaInfo, error)
	Close() error
}

var (
	_ StorageService = (*moduleStorage)(nil)
	_ StorageService = (*grpcStorage)(nil)
)
