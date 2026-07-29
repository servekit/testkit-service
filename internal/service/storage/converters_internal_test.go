package storage

import (
	"testing"

	"github.com/stretchr/testify/require"

	storagev1 "github.com/servekit/storage-service/gen/storage/v1"
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
)

// These tests exercise the unexported converters directly: nil branches and the
// enum edge values that the RPC happy-path tests in storage_test.go don't reach.
// They live in the internal package (not storage_test) so they can call the
// lowercase converters.

func TestToTestkitFileInfo_Nil(t *testing.T) {
	require.Nil(t, toTestkitFileInfo(nil))
}

func TestToTestkitAdminFileInfo_Nil(t *testing.T) {
	require.Nil(t, toTestkitAdminFileInfo(nil))
}

func TestToTestkitQuotaInfo_Nil(t *testing.T) {
	require.Nil(t, toTestkitQuotaInfo(nil))
}

func TestToTestkitAuditLogEntry_Nil(t *testing.T) {
	require.Nil(t, toTestkitAuditLogEntry(nil))
}

func TestToTestkitAdminGetStatsResponse_Nil(t *testing.T) {
	require.Nil(t, toTestkitAdminGetStatsResponse(nil))
}

// TestToTestkitFileInfo_EnumCast proves the owner_type enum is int-cast (not
// table-mapped) and every scalar field is carried.
func TestToTestkitFileInfo_EnumCast(t *testing.T) {
	in := &storagev1.UserFileInfo{
		Id: 3, Filename: "f", FilePath: "p", Description: "d",
		Metadata: map[string]string{"k": "v"}, IsPublic: true,
		OwnerType: storagev1.OwnerType_OWNER_TYPE_BUSINESS,
		Size:      99, ContentType: "ct", Extension: ".txt", Md5: "md5",
		CreatedAt: "t1", UpdatedAt: "t2",
	}
	out := toTestkitFileInfo(in)
	require.Equal(t, int64(3), out.GetId())
	require.Equal(t, "p", out.GetFilePath())
	require.Equal(t, map[string]string{"k": "v"}, out.GetMetadata())
	require.True(t, out.GetIsPublic())
	require.Equal(t, testkitv1.OwnerType_OWNER_TYPE_BUSINESS, out.GetOwnerType())
	require.Equal(t, ".txt", out.GetExtension())
	require.Equal(t, "t2", out.GetUpdatedAt())
}

// TestToStorageImageProcessOps_NestedEnumAndCasts covers the nested-enum int-cast
// (ImageProcessOp_Type — the value testkit hoists to ImageProcessType) plus the
// ImageFormat / ImageResizeMode casts, on a multi-op slice and an empty slice.
func TestToStorageImageProcessOps_NestedEnumAndCasts(t *testing.T) {
	in := []*testkitv1.ImageProcessOp{
		{Type: testkitv1.ImageProcessType_IMAGE_PROCESS_TYPE_RESIZE, Width: 10, Height: 20, Format: testkitv1.ImageFormat_IMAGE_FORMAT_WEBP, Quality: 80, ResizeMode: testkitv1.ImageResizeMode_IMAGE_RESIZE_MODE_FIT, WatermarkText: "w", RotateDegrees: 90},
		{Type: testkitv1.ImageProcessType_IMAGE_PROCESS_TYPE_CROP},
	}
	out := toStorageImageProcessOps(in)
	require.Len(t, out, 2)
	require.Equal(t, storagev1.ImageProcessOp_TYPE_RESIZE, out[0].GetType())
	require.Equal(t, int32(10), out[0].GetWidth())
	require.Equal(t, storagev1.ImageFormat_IMAGE_FORMAT_WEBP, out[0].GetFormat())
	require.Equal(t, storagev1.ImageResizeMode_IMAGE_RESIZE_MODE_FIT, out[0].GetResizeMode())
	require.Equal(t, "w", out[0].GetWatermarkText())
	require.Equal(t, int32(90), out[0].GetRotateDegrees())
	require.Equal(t, storagev1.ImageProcessOp_TYPE_CROP, out[1].GetType())

	// Empty slice → empty (non-nil) slice; preserves count for downstream min_items.
	empty := toStorageImageProcessOps(nil)
	require.NotNil(t, empty)
	require.Len(t, empty, 0)
}

// TestToTestkitUploadCredentialItem_UnknownOneof ensures an unknown/empty oneof
// arm maps to nil rather than panicking (forward-compat with downstream adding a
// new arm).
func TestToTestkitUploadCredentialItem_UnknownOneof(t *testing.T) {
	require.Nil(t, toTestkitUploadCredentialItem(&storagev1.UploadCredentialItem{}))
}
