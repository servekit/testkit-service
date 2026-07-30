package storage

import (
	"context"
	"fmt"

	"google.golang.org/protobuf/types/known/emptypb"

	storagev1 "github.com/servekit/storage-service/gen/storage/v1"
	storageservice "github.com/servekit/storage-service/pkg"
)

type grpcStorage struct {
	client *storageservice.Client
}

func NewGRPC(target string) (StorageService, error) {
	c, err := storageservice.NewClient(target)
	if err != nil {
		return nil, fmt.Errorf("dial storage-service %q: %w", target, err)
	}
	return &grpcStorage{client: c}, nil
}

func (g *grpcStorage) GenerateUploadURL(ctx context.Context, r *storagev1.GenerateUploadURLRequest) (*storagev1.GenerateUploadURLResponse, error) {
	return g.client.GenerateUploadURL(ctx, r)
}
func (g *grpcStorage) GetSTSCredential(ctx context.Context, r *storagev1.GetSTSCredentialRequest) (*storagev1.GetSTSCredentialResponse, error) {
	return g.client.GetSTSCredential(ctx, r)
}
func (g *grpcStorage) BatchGetSTSCredential(ctx context.Context, r *storagev1.BatchGetSTSCredentialRequest) (*storagev1.BatchGetSTSCredentialResponse, error) {
	return g.client.BatchGetSTSCredential(ctx, r)
}
func (g *grpcStorage) ConfirmUpload(ctx context.Context, r *storagev1.ConfirmUploadRequest) (*storagev1.ConfirmUploadResponse, error) {
	return g.client.ConfirmUpload(ctx, r)
}
func (g *grpcStorage) CancelUpload(ctx context.Context, r *storagev1.CancelUploadRequest) (*emptypb.Empty, error) {
	return g.client.CancelUpload(ctx, r)
}
func (g *grpcStorage) GenerateDownloadURL(ctx context.Context, r *storagev1.GenerateDownloadURLRequest) (*storagev1.GenerateDownloadURLResponse, error) {
	return g.client.GenerateDownloadURL(ctx, r)
}
func (g *grpcStorage) ListMyFiles(ctx context.Context, r *storagev1.ListMyFilesRequest) (*storagev1.ListMyFilesResponse, error) {
	return g.client.ListMyFiles(ctx, r)
}
func (g *grpcStorage) ListMyFilesPaged(ctx context.Context, r *storagev1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedResponse, error) {
	return g.client.ListMyFilesPaged(ctx, r)
}
func (g *grpcStorage) GetMyFile(ctx context.Context, r *storagev1.GetMyFileRequest) (*storagev1.UserFileInfo, error) {
	return g.client.GetMyFile(ctx, r)
}
func (g *grpcStorage) UpdateMyFile(ctx context.Context, r *storagev1.UpdateMyFileRequest) (*storagev1.UserFileInfo, error) {
	return g.client.UpdateMyFile(ctx, r)
}
func (g *grpcStorage) DeleteMyFile(ctx context.Context, r *storagev1.DeleteMyFileRequest) (*emptypb.Empty, error) {
	return g.client.DeleteMyFile(ctx, r)
}
func (g *grpcStorage) BatchDeleteMyFiles(ctx context.Context, r *storagev1.BatchDeleteMyFilesRequest) (*storagev1.BatchDeleteMyFilesResponse, error) {
	return g.client.BatchDeleteMyFiles(ctx, r)
}
func (g *grpcStorage) GenerateProcessURL(ctx context.Context, r *storagev1.GenerateProcessURLRequest) (*storagev1.GenerateProcessURLResponse, error) {
	return g.client.GenerateProcessURL(ctx, r)
}
func (g *grpcStorage) GenerateCDNURL(ctx context.Context, r *storagev1.GenerateCDNURLRequest) (*storagev1.GenerateCDNURLResponse, error) {
	return g.client.GenerateCDNURL(ctx, r)
}
func (g *grpcStorage) GetMyQuota(ctx context.Context, r *storagev1.GetMyQuotaRequest) (*storagev1.QuotaInfo, error) {
	return g.client.GetMyQuota(ctx, r)
}
func (g *grpcStorage) AdminListFiles(ctx context.Context, r *storagev1.AdminListFilesRequest) (*storagev1.AdminListFilesResponse, error) {
	return g.client.AdminListFiles(ctx, r)
}
func (g *grpcStorage) AdminGetFile(ctx context.Context, r *storagev1.AdminGetFileRequest) (*storagev1.AdminFileInfo, error) {
	return g.client.AdminGetFile(ctx, r)
}
func (g *grpcStorage) AdminDeleteFile(ctx context.Context, r *storagev1.AdminDeleteFileRequest) (*emptypb.Empty, error) {
	return g.client.AdminDeleteFile(ctx, r)
}
func (g *grpcStorage) AdminGetQuota(ctx context.Context, r *storagev1.AdminGetQuotaRequest) (*storagev1.QuotaInfo, error) {
	return g.client.AdminGetQuota(ctx, r)
}
func (g *grpcStorage) AdminSetQuota(ctx context.Context, r *storagev1.AdminSetQuotaRequest) (*storagev1.QuotaInfo, error) {
	return g.client.AdminSetQuota(ctx, r)
}
func (g *grpcStorage) AdminGetStats(ctx context.Context, r *storagev1.AdminGetStatsRequest) (*storagev1.AdminGetStatsResponse, error) {
	return g.client.AdminGetStats(ctx, r)
}
func (g *grpcStorage) AdminListProviders(ctx context.Context, r *emptypb.Empty) (*storagev1.AdminListProvidersResponse, error) {
	return g.client.AdminListProviders(ctx, r)
}
func (g *grpcStorage) AdminListBuckets(ctx context.Context, r *emptypb.Empty) (*storagev1.AdminListBucketsResponse, error) {
	return g.client.AdminListBuckets(ctx, r)
}
func (g *grpcStorage) AdminSoftDeleteOwnerFiles(ctx context.Context, r *storagev1.AdminSoftDeleteOwnerFilesRequest) (*storagev1.AdminSoftDeleteOwnerFilesResponse, error) {
	return g.client.AdminSoftDeleteOwnerFiles(ctx, r)
}
func (g *grpcStorage) AdminDeleteOwner(ctx context.Context, r *storagev1.AdminDeleteOwnerRequest) (*storagev1.AdminDeleteOwnerResponse, error) {
	return g.client.AdminDeleteOwner(ctx, r)
}
func (g *grpcStorage) ListMyAuditLogs(ctx context.Context, r *storagev1.ListMyAuditLogsRequest) (*storagev1.ListMyAuditLogsResponse, error) {
	return g.client.ListMyAuditLogs(ctx, r)
}
func (g *grpcStorage) AdminListAuditLogs(ctx context.Context, r *storagev1.AdminListAuditLogsRequest) (*storagev1.AdminListAuditLogsResponse, error) {
	return g.client.AdminListAuditLogs(ctx, r)
}
func (g *grpcStorage) SetOwnerQuota(ctx context.Context, r *storagev1.SetOwnerQuotaRequest) (*storagev1.QuotaInfo, error) {
	return g.client.SetOwnerQuota(ctx, r)
}
func (g *grpcStorage) AddOwnerQuota(ctx context.Context, r *storagev1.AddOwnerQuotaRequest) (*storagev1.QuotaInfo, error) {
	return g.client.AddOwnerQuota(ctx, r)
}

func (g *grpcStorage) Close() error { return g.client.Close() }
