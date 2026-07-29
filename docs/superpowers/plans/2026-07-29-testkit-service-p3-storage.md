# testkit-service P3（文件域）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 storage-service 的 29 个用户/管理态 RPC（30 个去掉 Ping）聚合进 testkit BFF 的 `TestKitService`，落地自包含 proto + owner-from-ctx 映射层 + swagger 前端联动，产出「我的文件 / 我的配额审计 / 文件管理后台（admin）」前端页。

**Architecture:** testkit 是唯一信任边界。所有「我的」类 RPC 的 `Owner{USER, user_id}` 由 BFF 从 ctx（AuthInterceptor 注入的 `grpcx.UserIDKey`）构造，**testkit request message 里不存在 owner 字段**（spec §3.2 规则 1）。admin / owner-quota 类 RPC 的 `owner_type` + `owner_id` 是**操作目标**（不是调用方身份），保留在 testkit request 里。枚举在 testkit proto 重新定义（镜像 storage 同名同号），映射用整型直转。映射层 `internal/service/storage/storage.go` 是**唯一同时 import `testkitv1` 与 `storagev1`** 的文件。下游 `xerr.Error` 透传，不吞错。

**Tech Stack:** Go 1.26 + go-common（grpcx/dbx/redisx/xerr）+ buf v2 + grpc-gateway；storage in-process embed（P1 thirdcall `mode=module`，client = `*storage.Handler`）；前端 Ant Design Pro v6（React 19 + antd 6 + Umi Max 4 + ProComponents），请求层 100% 由 `npm run openapi` 从 testkit.swagger.json 生成。

---

## 关键决策与映射约定（实现前必读）

1. **Owner 字段下沉到 ctx（核心 curation）**
   - 「我的」类 RPC（`ListMyFiles*`、`GetMyFile`、`UpdateMyFile`、`DeleteMyFile`、`BatchDeleteMyFiles`、`GetMyQuota`、`ListMyAuditLogs`、`GenerateDownloadURL`、`GenerateProcessURL`、`GenerateCDNURL`、`GenerateUploadURL`、`GetSTSCredential`、`BatchGetSTSCredential`、`ConfirmUpload`、`CancelUpload`）：**testkit request 不含 owner / owner_type / owner_id**。映射层用 `ownerFromCtx(ctx)` 构造 `storagev1.Owner{OwnerType: OWNER_TYPE_USER, OwnerId: <ctx user_id>}` 填入下游请求。
   - admin / owner-quota 类 RPC（`AdminListFiles`、`AdminGetFile`、`AdminDeleteFile`、`AdminGetQuota`、`AdminSetQuota`、`AdminGetStats`、`AdminListProviders`、`AdminListBuckets`、`AdminSoftDeleteOwnerFiles`、`AdminDeleteOwner`、`AdminListAuditLogs`、`SetOwnerQuota`、`AddOwnerQuota`）：前端指定的 `owner_type` + `owner_id` 是**操作目标**，**保留**在 testkit request（无 Owner message，用扁平字段）。**本期不做 RBAC 鉴权**——admin 端点仅登录态 + 身份注入（见 v2 §3.5；OPA 后续）。
   - testkit proto **不定义 `Owner` message**——「我的」类不需要（ctx 注入），admin 类用扁平 `owner_type`/`owner_id`。

2. **枚举镜像 + int 直转**：在 testkit proto 重新定义 12 个枚举（spec 列的 11 个 + 新增 `ImageProcessType`，因下游 `ImageProcessOp.Type` 是嵌套枚举，testkit 拎到顶层便于 swagger）。名称+编号与 `storage.v1` 逐字一致，映射用 `storagev1.SortField(r.GetOrderBy())` 整型直转，无需查表。

3. **`request_id` curation**：下游每个写 RPC 带 `request_id`（审计追溯用，optional）。**统一从 testkit request 去掉**（前端不读不写；BFF 需要时可用 trace id 自动生成）。**例外**：`AdminListAuditLogs.request_id` 是**查询过滤字段**（按 request_id 搜审计日志），不是调用方追溯，**保留**。判定标准：该 request_id 描述「操作谁/什么」（保留）还是「调用方身份/追溯」（去掉）。

4. **REST 路由避免 enum-in-path**：下游用 `/v1/admin/owners/{owner_type}/{owner_id}/quota`（enum 在 path）。grpc-gateway 对 path 里的 enum 默认按 JSON 名解析，前端要拼 `OWNER_TYPE_USER` 进 URL，既脆又不友好。testkit 改为：GET 用 query 参数、POST/PUT/DELETE 用 body 传递 `owner_type`+`owner_id`。路由前缀：用户态 `/api/v1/files/*`、`/api/v1/storage/*`；管理态 `/api/v1/admin/files/*`、`/api/v1/admin/storage/*`、`/api/v1/admin/audit-logs`。

5. **转换器命名（P3 约定，覆盖 P1 旧命名）**：`toStorage<Method>Request`（testkit→storage 请求）、`toTestkit<Entity>`（storage→testkit 实体/响应）。`ownerFromCtx` 是共享 helper。「我的」类 converter 签名带 `ctx`（为了注入 owner）；admin 类不带 ctx（纯 int-cast + 透传）。

6. **下游 gen 只被两处 import**（spec §3.4）：`internal/thirdcall/storage`（client 接线，P1 已建）+ `internal/service/storage`（本域映射）。`pkg/handler`、testkit proto、前端对 `storagev1` 完全无感。

7. **stub 测试技巧**：`storagev1.UnimplementedStorageServiceServer` 实现了全部 30 个 RPC 方法（返回 unimplemented）。测试 stub 嵌入它即可满足本域 `StorageClient` 接口，只需覆写被测方法——stub 里断言 `req.GetOwner().GetOwnerId() == ctx 注入的 user_id`，验证 owner 注入正确。

---

## File Structure

P3 涉及的文件（创建/修改）：

```
testkit-service/
├── api/proto/testkit/v1/testkit.proto          # 追加 storage 枚举 + 消息 + 29 RPC [改]
├── api/swagger/testkit/v1/testkit.swagger.json # make proto 重生 [改]
├── gen/testkit/v1/                             # make proto 重生 [改]
├── internal/service/
│   ├── service.go                              # 加 storage *storage.Service + New + Storage() facade [改]
│   └── storage/
│       ├── storage.go                          # Service + 29 方法 + converters（唯一 import storagev1） [建]
│       └── storage_test.go                     # stub client + 映射测试 [建]
├── pkg/
│   ├── handler/testkit.go                      # 29 个 RPC 薄壳一行委托 [改]
│   ├── xcodes/storage.go                       # storage 域 testkit 错误码（ErrCallerRequired 等） [建]
│   └── auth/interceptor.go                     # 确认 user_id 已注入 ctx（P1 已做，P3 依赖） [无改]
└── web/
    ├── config/config.ts                        # openAPI 字段（P1 已建） [无改]
    ├── config/routes.ts                        # 加 /files、/storage、/admin/* 路由 [改]
    └── src/pages/
        ├── Files/MyFiles/                      # 我的文件（ProTable + 上传 + 下载/处理） [建]
        ├── Storage/Quota/                      # 我的配额 [建]
        ├── Storage/Audit/                      # 我的审计 [建]
        └── Admin/Storage/                      # admin 文件/配额/统计/Provider/Bucket/审计 [建]
```

**职责边界**：`internal/service/storage`（业务方法 + 映射同文件，converters 在 `// --- converters ---` 下）；`pkg/handler`（只见 testkitv1，一行委托）；`pkg/xcodes/storage.go`（testkit 自身错误码，下游 xerr 透传不归这管）。

---

## Task 1: proto 镜像 storage 枚举

**Files:**
- Modify: `api/proto/testkit/v1/testkit.proto`

- [ ] **Step 1: 在 proto 文件末尾（P2 user 域之后、`service TestKitService {` 闭合括号之前的消息区，或文件尾的 message 区）追加 storage 枚举块**

在 `api/proto/testkit/v1/testkit.proto` 追加（保持 P1/P2 已有内容不动）：

```proto
// ---- Storage enums (P3) ----
// 镜像 storage-service (api/proto/storage/v1/storage.proto) 同名同号，
// testkit↔storagev1 转换即整型直转：storagev1.SortField(r.GetOrderBy())。
// 在 testkit 重新定义（非 import）以保持 proto 自包含（v2 §3.1），并给前端真实 enum 类型。

enum OwnerType {
  OWNER_TYPE_UNSPECIFIED = 0;
  OWNER_TYPE_USER = 1;
  OWNER_TYPE_SYSTEM = 2;
  OWNER_TYPE_GROUP = 3;
  OWNER_TYPE_BUSINESS = 4;
  OWNER_TYPE_SERVICE = 5;
}

enum Vendor {
  VENDOR_UNSPECIFIED = 0;
  VENDOR_ALIYUN_OSS = 1;
  VENDOR_AWS_S3 = 2;
  VENDOR_S3_COMPATIBLE = 3;
  VENDOR_TENCENT_COS = 4;
  VENDOR_HUAWEI_OBS = 5;
  VENDOR_VOLCENGINE_TOS = 6;
}

enum StorageClass {
  STORAGE_CLASS_UNSPECIFIED = 0;
  STORAGE_CLASS_STANDARD = 1;
  STORAGE_CLASS_INFREQUENT_ACCESS = 2;
  STORAGE_CLASS_ARCHIVE = 3;
  STORAGE_CLASS_DEEP_ARCHIVE = 4;
}

enum BucketACL {
  BUCKET_ACL_UNSPECIFIED = 0;
  BUCKET_ACL_PRIVATE = 1;
  BUCKET_ACL_PUBLIC_READ = 2;
  BUCKET_ACL_PUBLIC_READ_WRITE = 3;
}

enum ImageResizeMode {
  IMAGE_RESIZE_MODE_UNSPECIFIED = 0;
  IMAGE_RESIZE_MODE_FIT = 1;
  IMAGE_RESIZE_MODE_FILL = 2;
  IMAGE_RESIZE_MODE_PAD = 3;
}

enum ImageFormat {
  IMAGE_FORMAT_UNSPECIFIED = 0;
  IMAGE_FORMAT_JPG = 1;
  IMAGE_FORMAT_PNG = 2;
  IMAGE_FORMAT_WEBP = 3;
  IMAGE_FORMAT_GIF = 4;
  IMAGE_FORMAT_BMP = 5;
  IMAGE_FORMAT_HEIC = 6;
  IMAGE_FORMAT_AVIF = 7;
}

enum SortField {
  SORT_FIELD_UNSPECIFIED = 0;
  SORT_FIELD_CREATED_AT = 1;
  SORT_FIELD_FILENAME = 2;
  SORT_FIELD_SIZE = 3;
}

enum AuditAction {
  AUDIT_ACTION_UNSPECIFIED = 0;
  AUDIT_ACTION_UPLOAD = 1;
  AUDIT_ACTION_UPDATE = 2;
  AUDIT_ACTION_DELETE = 3;
  AUDIT_ACTION_BATCH_DELETE = 4;
  AUDIT_ACTION_ADMIN_DELETE = 5;
  AUDIT_ACTION_ADMIN_SET_QUOTA = 6;
  AUDIT_ACTION_ADMIN_SOFT_DELETE_OWNER = 7;
  AUDIT_ACTION_ADMIN_DELETE_OWNER = 8;
  AUDIT_ACTION_SET_OWNER_QUOTA = 9;
  AUDIT_ACTION_ADD_OWNER_QUOTA = 10;
  AUDIT_ACTION_UPLOAD_SESSION_CREATE  = 11;
  AUDIT_ACTION_UPLOAD_SESSION_CONFIRM = 12;
  AUDIT_ACTION_UPLOAD_SESSION_CANCEL  = 13;
  AUDIT_ACTION_UPLOAD_SESSION_GC      = 14;
}

enum UploadSessionStatus {
  UPLOAD_SESSION_STATUS_UNSPECIFIED = 0;
  UPLOAD_SESSION_STATUS_PENDING     = 1;
  UPLOAD_SESSION_STATUS_CONFIRMED   = 2;
  UPLOAD_SESSION_STATUS_EXPIRED     = 3;
  UPLOAD_SESSION_STATUS_CANCELLED   = 4;
}

enum AuditLogStatus {
  AUDIT_LOG_STATUS_UNSPECIFIED = 0;
  AUDIT_LOG_STATUS_SUCCESS = 1;
  AUDIT_LOG_STATUS_FAILED = 2;
}

enum AuditLogTargetType {
  AUDIT_LOG_TARGET_TYPE_UNSPECIFIED = 0;
  AUDIT_LOG_TARGET_TYPE_FILE = 1;
  AUDIT_LOG_TARGET_TYPE_QUOTA = 2;
  AUDIT_LOG_TARGET_TYPE_OWNER = 3;
}

// ImageProcessType 镜像下游 ImageProcessOp.Type 嵌套枚举。
// testkit 拎到顶层（swagger 更友好），映射时整型直转。
enum ImageProcessType {
  IMAGE_PROCESS_TYPE_UNSPECIFIED = 0;
  IMAGE_PROCESS_TYPE_RESIZE = 1;
  IMAGE_PROCESS_TYPE_CROP = 2;
  IMAGE_PROCESS_TYPE_QUALITY = 3;
  IMAGE_PROCESS_TYPE_FORMAT = 4;
  IMAGE_PROCESS_TYPE_WATERMARK = 5;
  IMAGE_PROCESS_TYPE_ROTATE = 6;
}
```

- [ ] **Step 2: 暂不 `make proto`**（Task 2 一起生成，避免半生不熟的 proto 触发生成失败）。

- [ ] **Step 3: Commit（与 Task 2 合并提交，或单独提交 proto 枚举）**

若单独提交：
```bash
git add api/proto/testkit/v1/testkit.proto
git commit -m "feat(proto): mirror storage enums for P3"
```

---

## Task 2: proto 自定义 storage 消息 + 29 RPC

**Files:**
- Modify: `api/proto/testkit/v1/testkit.proto`

- [ ] **Step 1: 追加 storage 共享实体 message**

在 Task 1 枚举块之后追加（curated：见「关键决策」，已去 owner/request_id，保留目标 id，枚举重定义）：

```proto
// ---- Storage shared entities (P3) ----

// FileInfo 是用户态文件实体（镜像 storage.UserFileInfo，全字段保留——均为文件属性，非调用方身份）。
message FileInfo {
  int64 id = 1;
  string filename = 2;
  string file_path = 3;
  string description = 4;
  map<string, string> metadata = 5;
  bool is_public = 6;
  OwnerType owner_type = 7;
  int64 size = 10;
  string content_type = 11;
  string extension = 12;
  string md5 = 13;
  string created_at = 20;
  string updated_at = 21;
}

// AdminFileInfo 是管理态文件实体（含 provider/bucket/object_key/object_id 等内部定位字段）。
message AdminFileInfo {
  int64 id = 1;
  OwnerType owner_type = 2;
  int64 owner_id = 3;
  string filename = 4;
  string file_path = 5;
  string description = 6;
  map<string, string> metadata = 7;
  bool is_public = 8;
  int64 object_id = 9;
  int64 size = 10;
  string content_type = 11;
  string extension = 12;
  string md5 = 13;
  string provider = 14;
  string bucket = 15;
  string object_key = 16;
  string created_at = 20;
  string updated_at = 21;
}

message QuotaInfo {
  int64 total_bytes = 1;
  int64 used_bytes = 2;
  int64 available_bytes = 3;
  int32 file_count = 4;
}

// ImageProcessOp 镜像下游同名 message（type 用顶层 ImageProcessType）。
message ImageProcessOp {
  ImageProcessType type = 1;
  int32 width = 2;
  int32 height = 3;
  ImageFormat format = 4;
  int32 quality = 5;
  ImageResizeMode resize_mode = 6;
  string watermark_text = 7;
  int32 rotate_degrees = 8;
}

// UploadFileMeta 用于批量 STS（镜像下游 UploadFileMeta，无 owner——owner 由 ctx 注入）。
message UploadFileMeta {
  string md5 = 1 [(buf.validate.field).string = {len: 32}];
  int64 size = 2 [(buf.validate.field).int64 = {gt: 0}];
  string filename = 3 [(buf.validate.field).string = {min_len: 1, max_len: 256}];
  string content_type = 4 [(buf.validate.field).string = {min_len: 1}];
  string file_path = 5;
  string description = 6;
  map<string, string> metadata = 7;
}

message UploadTokenInfo {
  string upload_token = 1;
  int64 expires_at = 2;
  int64 file_id = 3;       // MD5 dedup 命中时非 0（即时上传）
  string object_key = 4;
}

message ItemError {
  int32 index = 1;
  string code = 2;
  string message = 3;
}

// UploadCredentialItem 用 oneof 表达「成功 token | 失败 error」（镜像下游）。
message UploadCredentialItem {
  oneof result {
    UploadTokenInfo token = 1;
    ItemError error = 2;
  }
}

message AuditLogEntry {
  int64 id = 1;
  AuditAction action = 2;
  OwnerType owner_type = 3;
  int64 owner_id = 4;
  AuditLogTargetType target_type = 5;
  int64 target_id = 6;
  google.protobuf.Struct before = 7;
  google.protobuf.Struct after = 8;
  AuditLogStatus status = 9;
  string error_message = 10;
  string request_id = 11;
  string created_at = 12;
}

message OwnerStats {
  OwnerType owner_type = 1;
  int64 file_count = 2;
  int64 total_bytes = 3;
}

message ProviderStats {
  string provider = 1;
  int64 object_count = 2;
  int64 total_bytes = 3;
}

message BucketStats {
  string bucket = 1;
  int64 object_count = 2;
  int64 total_bytes = 3;
  int64 file_count = 4;
}

message ProviderInfo {
  string name = 1;
  Vendor vendor = 2;
  string endpoint = 3;
  string region = 4;
}

message BucketInfo {
  string name = 1;
  string provider = 2;
  string key_prefix = 3;
  BucketACL acl = 4;
  Vendor vendor = 5;
}
```

> 注：`AuditLogEntry` 保留 `before`/`after`（`google.protobuf.Struct`），openapiv2 会编成 `object`，前端可读；如前端确认不用可后续裁。`import "google/protobuf/struct.proto";` 需在文件头 import 区加（若 P1/P2 未引）。

- [ ] **Step 2: 追加 29 个 RPC 的 curated request/response message**

继续追加。每条 message 已按 curation 规则去 owner/request_id（admin 类保留 owner_type/owner_id 目标；AdminListAuditLogs.request_id 是过滤字段保留）：

```proto
// ---- Upload ----

message GenerateUploadURLRequest {
  string filename = 1 [(buf.validate.field).string = {min_len: 1, max_len: 256}];
  int64 size = 2 [(buf.validate.field).int64 = {gt: 0}];
  string md5 = 3 [(buf.validate.field).string = {len: 32}];
  string content_type = 4 [(buf.validate.field).string = {min_len: 1}];
  string bucket = 5;
  string file_path = 6;
  string description = 7;
  map<string, string> metadata = 8;
  Vendor vendor = 10;
}
message GenerateUploadURLResponse {
  bool instant = 1;
  int64 file_id = 2;
  FileInfo file_info = 3;
  string upload_token = 10;
  string upload_url = 11;
  string object_key = 12;
  map<string, string> headers = 13;
}

message GetSTSCredentialRequest {
  string bucket = 1;
  int64 max_size = 2;
  string filename = 3 [(buf.validate.field).string = {min_len: 1, max_len: 256}];
  string md5 = 4 [(buf.validate.field).string = {len: 32}];
  string content_type = 5 [(buf.validate.field).string = {min_len: 1}];
  string file_path = 6;
  string description = 7;
  map<string, string> metadata = 8;
  Vendor vendor = 10;
  google.protobuf.Duration ttl = 11;
  repeated string allowed_extensions = 12;
}
message GetSTSCredentialResponse {
  bool instant = 1;
  int64 file_id = 2;
  FileInfo file_info = 3;
  string upload_token = 10;
  string access_key = 11;
  string secret_key = 12;
  string security_token = 13;
  string endpoint = 14;
  string bucket = 15;
  string object_key = 16;
  int64 expires_at = 17;
}

message BatchGetSTSCredentialRequest {
  repeated UploadFileMeta files = 1 [(buf.validate.field).repeated = {min_items: 1, max_items: 100}];
  string bucket = 2;
  google.protobuf.Duration ttl = 3;
  repeated string allowed_extensions = 4;
}
message BatchGetSTSCredentialResponse {
  string access_key = 1;
  string secret_key = 2;
  string security_token = 3;
  string endpoint = 4;
  string bucket = 5;
  int64 expires_at = 6;
  repeated UploadCredentialItem items = 7;
}

message ConfirmUploadRequest {
  string upload_token = 1 [(buf.validate.field).string = {min_len: 1}];
}
message ConfirmUploadResponse {
  int64 file_id = 1;
  FileInfo file_info = 2;
}

message CancelUploadRequest {
  string upload_token = 1 [(buf.validate.field).string = {min_len: 1}];
}

// ---- Download / Process ----

message GenerateDownloadURLRequest {
  int64 file_id = 1 [(buf.validate.field).int64 = {gt: 0}];
  int32 ttl_seconds = 2;
  optional string filename = 3;
}
message GenerateDownloadURLResponse {
  string download_url = 1;
  int64 expires_at = 2;
}

message GenerateProcessURLRequest {
  int64 file_id = 1 [(buf.validate.field).int64 = {gt: 0}];
  repeated ImageProcessOp ops = 2 [(buf.validate.field).repeated = {min_items: 1}];
  int32 ttl_seconds = 3;
}
message GenerateProcessURLResponse {
  string url = 1;
  int64 expires_at = 2;
}

message GenerateCDNURLRequest {
  int64 file_id = 1 [(buf.validate.field).int64 = {gt: 0}];
  repeated ImageProcessOp ops = 2;       // 空 = 纯下载 URL
  google.protobuf.Duration ttl = 3;
  bool public = 4;
  optional string filename = 5;
}
message GenerateCDNURLResponse {
  string url = 1;
  int64 expires_at = 2;
}

// ---- My Files ----

message ListMyFilesRequest {
  string path_prefix = 1;
  string extension = 2;
  string content_type_prefix = 3;
  SortField order_by = 4;
  bool descending = 5;
  int32 page_size = 6;
  string page_token = 7;
}
message ListMyFilesResponse {
  repeated FileInfo files = 1;
  string next_page_token = 3;
}

message ListMyFilesPagedRequest {
  int32 page = 1;
  int32 page_size = 2;
  string path_prefix = 3;
  string extension = 4;
  string content_type_prefix = 5;
  SortField order_by = 6;
  bool descending = 7;
}
message ListMyFilesPagedResponse {
  repeated FileInfo files = 1;
  int64 total_count = 2;
  int32 page = 3;
  int32 total_pages = 4;
  bool has_more = 5;
}

message GetMyFileRequest {
  int64 file_id = 1 [(buf.validate.field).int64 = {gt: 0}];
}
message UpdateMyFileRequest {
  int64 file_id = 1 [(buf.validate.field).int64 = {gt: 0}];
  optional string filename = 2;
  optional string file_path = 3;
  optional string description = 4;
  map<string, string> metadata = 5;
  optional bool clear_metadata = 7;
}
message DeleteMyFileRequest {
  int64 file_id = 1 [(buf.validate.field).int64 = {gt: 0}];
}
message BatchDeleteMyFilesRequest {
  repeated int64 file_ids = 1 [(buf.validate.field).repeated = {min_items: 1, max_items: 100}];
}
message BatchDeleteMyFilesResponse {
  int32 deleted_count = 1;
  repeated int64 failed_ids = 2;
}

// ---- My Quota / Audit ----

// GetMyQuotaRequest = Empty（owner 由 ctx 注入，无其他字段）。
// ListMyAuditLogs:
message ListMyAuditLogsRequest {
  AuditAction action = 1;
  AuditLogTargetType target_type = 2;
  string start_time = 3;
  string end_time = 4;
  int32 page_size = 5;
  string page_token = 6;
}
message ListMyAuditLogsResponse {
  repeated AuditLogEntry logs = 1;
  int32 total_count = 2;
  string next_page_token = 3;
}

// ---- Owner quota（BFF 内部编排，admin-gated；owner_type/owner_id 为目标，保留）----

message SetOwnerQuotaRequest {
  OwnerType owner_type = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  int64 owner_id = 2 [(buf.validate.field).int64 = {gt: 0}];
  int64 total_bytes = 3 [(buf.validate.field).int64 = {gt: 0}];
}
message AddOwnerQuotaRequest {
  OwnerType owner_type = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  int64 owner_id = 2 [(buf.validate.field).int64 = {gt: 0}];
  int64 delta_bytes = 3;
}

// ---- Admin ----

message AdminListFilesRequest {
  OwnerType owner_type = 1;
  int64 owner_id = 2;
  string path_prefix = 3;
  string extension = 4;
  string content_type_prefix = 5;
  SortField order_by = 6;
  bool descending = 7;
  int32 page_size = 8;
  string page_token = 9;
  string provider = 10;
  string bucket = 11;
}
message AdminListFilesResponse {
  repeated AdminFileInfo files = 1;
  int32 total_count = 2;
  string next_page_token = 3;
}

message AdminGetFileRequest {
  int64 file_id = 1 [(buf.validate.field).int64 = {gt: 0}];
}
message AdminDeleteFileRequest {
  int64 file_id = 1 [(buf.validate.field).int64 = {gt: 0}];
}

message AdminGetQuotaRequest {
  OwnerType owner_type = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  int64 owner_id = 2 [(buf.validate.field).int64 = {gt: 0}];
}
message AdminSetQuotaRequest {
  OwnerType owner_type = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  int64 owner_id = 2 [(buf.validate.field).int64 = {gt: 0}];
  int64 total_bytes = 3 [(buf.validate.field).int64 = {gt: 0}];
}

message AdminGetStatsRequest {
  OwnerType owner_type = 1;
  int64 owner_id = 2;
}
message AdminGetStatsResponse {
  int64 total_objects = 1;
  int64 total_files = 2;
  int64 physical_bytes = 4;
  int64 logical_bytes = 5;
  repeated OwnerStats owner_stats = 8;
  repeated ProviderStats provider_stats = 6;
  repeated BucketStats bucket_stats = 7;
}

message AdminListProvidersResponse {
  repeated ProviderInfo providers = 1;
}
message AdminListBucketsResponse {
  repeated BucketInfo buckets = 1;
}

message AdminSoftDeleteOwnerFilesRequest {
  OwnerType owner_type = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  int64 owner_id = 2 [(buf.validate.field).int64 = {gt: 0}];
}
message AdminSoftDeleteOwnerFilesResponse {
  int64 files_deleted = 1;
  int64 bytes_released = 2;
}

message AdminDeleteOwnerRequest {
  OwnerType owner_type = 1 [(buf.validate.field).enum = {defined_only: true, not_in: [0]}];
  int64 owner_id = 2 [(buf.validate.field).int64 = {gt: 0}];
}
message AdminDeleteOwnerResponse {
  int64 files_deleted = 1;
  int64 bytes_released = 2;
}

message AdminListAuditLogsRequest {
  AuditAction action = 1;
  AuditLogTargetType target_type = 2;
  AuditLogStatus status = 3;
  string request_id = 4;                // 过滤字段（按 request_id 搜日志），保留
  OwnerType owner_type = 5;
  int64 owner_id = 6;
  int64 target_id = 7;
  string start_time = 8;
  string end_time = 9;
  int32 page_size = 10;
  string page_token = 11;
}
message AdminListAuditLogsResponse {
  repeated AuditLogEntry logs = 1;
  int32 total_count = 2;
  string next_page_token = 3;
}
```

> 注：若文件头 import 区没有 `google/protobuf/duration.proto`，加 `import "google/protobuf/duration.proto";`（GetSTSCredential.ttl / BatchGetSTSCredential.ttl / GenerateCDNURL.ttl 用到）。

- [ ] **Step 3: 在 `service TestKitService { ... }` 块内追加 29 个 RPC（带 google.api.http 注解）**

```proto
  // ---- Storage / Files (P3) ----

  // Upload（owner 由 ctx 注入）
  rpc GenerateUploadURL(GenerateUploadURLRequest) returns (GenerateUploadURLResponse) {
    option (google.api.http) = { post: "/api/v1/files/uploads" body: "*" };
  }
  rpc GetSTSCredential(GetSTSCredentialRequest) returns (GetSTSCredentialResponse) {
    option (google.api.http) = { post: "/api/v1/files/sts" body: "*" };
  }
  rpc BatchGetSTSCredential(BatchGetSTSCredentialRequest) returns (BatchGetSTSCredentialResponse) {
    option (google.api.http) = { post: "/api/v1/files/sts:batch" body: "*" };
  }
  rpc ConfirmUpload(ConfirmUploadRequest) returns (ConfirmUploadResponse) {
    option (google.api.http) = { post: "/api/v1/files/uploads:confirm" body: "*" };
  }
  rpc CancelUpload(CancelUploadRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { post: "/api/v1/files/uploads:cancel" body: "*" };
  }

  // Download / Process（owner 由 ctx 注入）
  rpc GenerateDownloadURL(GenerateDownloadURLRequest) returns (GenerateDownloadURLResponse) {
    option (google.api.http) = { post: "/api/v1/files/{file_id}:downloadUrl" body: "*" };
  }
  rpc GenerateProcessURL(GenerateProcessURLRequest) returns (GenerateProcessURLResponse) {
    option (google.api.http) = { post: "/api/v1/files/{file_id}:processUrl" body: "*" };
  }
  rpc GenerateCDNURL(GenerateCDNURLRequest) returns (GenerateCDNURLResponse) {
    option (google.api.http) = { post: "/api/v1/files/{file_id}:cdnUrl" body: "*" };
  }

  // My Files（owner 由 ctx 注入）
  rpc ListMyFiles(ListMyFilesRequest) returns (ListMyFilesResponse) {
    option (google.api.http) = { get: "/api/v1/files" };
  }
  rpc ListMyFilesPaged(ListMyFilesPagedRequest) returns (ListMyFilesPagedResponse) {
    option (google.api.http) = { get: "/api/v1/files:page" };
  }
  rpc GetMyFile(GetMyFileRequest) returns (FileInfo) {
    option (google.api.http) = { get: "/api/v1/files/{file_id}" };
  }
  rpc UpdateMyFile(UpdateMyFileRequest) returns (FileInfo) {
    option (google.api.http) = { patch: "/api/v1/files/{file_id}" body: "*" };
  }
  rpc DeleteMyFile(DeleteMyFileRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { delete: "/api/v1/files/{file_id}" };
  }
  rpc BatchDeleteMyFiles(BatchDeleteMyFilesRequest) returns (BatchDeleteMyFilesResponse) {
    option (google.api.http) = { post: "/api/v1/files:batchDelete" body: "*" };
  }

  // My Quota / Audit（owner 由 ctx 注入）
  rpc GetMyQuota(google.protobuf.Empty) returns (QuotaInfo) {
    option (google.api.http) = { get: "/api/v1/storage/quota" };
  }
  rpc ListMyAuditLogs(ListMyAuditLogsRequest) returns (ListMyAuditLogsResponse) {
    option (google.api.http) = { get: "/api/v1/storage/audit-logs" };
  }

  // Owner quota（BFF 内部编排；owner_type/owner_id 为操作目标）
  rpc SetOwnerQuota(SetOwnerQuotaRequest) returns (QuotaInfo) {
    option (google.api.http) = { put: "/api/v1/storage/owners/quota" body: "*" };
  }
  rpc AddOwnerQuota(AddOwnerQuotaRequest) returns (QuotaInfo) {
    option (google.api.http) = { post: "/api/v1/storage/owners/quota:add" body: "*" };
  }

  // Admin（owner_type/owner_id 为查询/操作目标）
  rpc AdminListFiles(AdminListFilesRequest) returns (AdminListFilesResponse) {
    option (google.api.http) = { get: "/api/v1/admin/files" };
  }
  rpc AdminGetFile(AdminGetFileRequest) returns (AdminFileInfo) {
    option (google.api.http) = { get: "/api/v1/admin/files/{file_id}" };
  }
  rpc AdminDeleteFile(AdminDeleteFileRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = { delete: "/api/v1/admin/files/{file_id}" };
  }
  rpc AdminGetQuota(AdminGetQuotaRequest) returns (QuotaInfo) {
    option (google.api.http) = { get: "/api/v1/admin/storage/quota" };
  }
  rpc AdminSetQuota(AdminSetQuotaRequest) returns (QuotaInfo) {
    option (google.api.http) = { put: "/api/v1/admin/storage/quota" body: "*" };
  }
  rpc AdminGetStats(AdminGetStatsRequest) returns (AdminGetStatsResponse) {
    option (google.api.http) = { get: "/api/v1/admin/storage/stats" };
  }
  rpc AdminListProviders(google.protobuf.Empty) returns (AdminListProvidersResponse) {
    option (google.api.http) = { get: "/api/v1/admin/storage/providers" };
  }
  rpc AdminListBuckets(google.protobuf.Empty) returns (AdminListBucketsResponse) {
    option (google.api.http) = { get: "/api/v1/admin/storage/buckets" };
  }
  rpc AdminSoftDeleteOwnerFiles(AdminSoftDeleteOwnerFilesRequest) returns (AdminSoftDeleteOwnerFilesResponse) {
    option (google.api.http) = { post: "/api/v1/admin/storage/owners:softDeleteFiles" body: "*" };
  }
  rpc AdminDeleteOwner(AdminDeleteOwnerRequest) returns (AdminDeleteOwnerResponse) {
    option (google.api.http) = { post: "/api/v1/admin/storage/owners:delete" body: "*" };
  }
  rpc AdminListAuditLogs(AdminListAuditLogsRequest) returns (AdminListAuditLogsResponse) {
    option (google.api.http) = { get: "/api/v1/admin/audit-logs" };
  }
```

> 注：`AdminDeleteOwner` 下游是 `DELETE /v1/admin/owners/{owner_type}/{owner_id}`（path 带 enum）。testkit 改用 `POST .../owners:delete` + body，避免 enum-in-path（关键决策 4）。

- [ ] **Step 4: 重生成 + 验证编译**

```bash
cd /Users/moss/code/servekit/testkit-service
make proto
go build ./...
```

Expected: `gen/testkit/v1/` 含全部新 message + 29 RPC；`api/swagger/testkit/v1/testkit.swagger.json` 重生。`go build` 会因 `pkg/handler` / `internal/service` 未实现新 RPC 而 FAIL——预期，后续 Task 补。仅确认 proto 生成成功。

- [ ] **Step 5: Commit**

```bash
git add api/proto/ gen/ api/swagger/
git commit -m "feat(proto): add P3 storage RPCs with curated self-contained messages"
```

## Task 3: storage 域 Service 骨架 + StorageClient 接口 + 接线

**Files:**
- Create: `internal/service/storage/storage.go`（骨架，方法体随 Task 4-10 填）
- Create: `pkg/xcodes/storage.go`
- Modify: `internal/service/service.go`（加 `storage *storage.Service` + `New` 构造 + `Storage()` facade）
- Modify: `pkg/handler/testkit.go`（29 个 RPC 一行委托——本 Task 先加占位 `panic("TODO")`，Task 4-10 逐个填实；或一次性全加，编译依赖 Task 4-10 完成）

- [ ] **Step 1: 建 `pkg/xcodes/storage.go`**

`pkg/xcodes/storage.go`：

```go
// Package xcodes holds testkit-service's own error codes, grouped per domain.
// Downstream storage-service xerr.Error is passed through untouched (spec §9);
// this file only defines testkit-originated errors for the storage domain.
package xcodes

import "github.com/servekit/go-common/xerr"

// ErrCallerRequired is returned when a "my-*" storage RPC is invoked without an
// authenticated caller in ctx (AuthInterceptor should have injected user_id).
var ErrCallerRequired = xerr.New(
    "caller_required",
    xerr.CategoryUnauthenticated,
    401,
    "authenticated caller is required",
)
```

> 注：`xerr.New` 参数顺序与常量名以 `go-common/xerr` 实际签名为准（P1 Task 11 同款）；storage 下游错误（配额超限、bucket 不存在等）由映射层透传，不在此重定义。

- [ ] **Step 2: 建 `internal/service/storage/storage.go` 骨架（Service + New + StorageClient 接口 + ownerFromCtx helper + 空 converters 区）**

`internal/service/storage/storage.go`：

```go
// Package storage implements testkit's storage domain: map testkit DTOs to
// storage-service protos and back. This is the ONLY file in testkit-service
// that imports both testkitv1 and storagev1 (spec §3.4).
package storage

import (
    "context"

    "github.com/servekit/go-common/grpcx"
    storagev1 "github.com/servekit/storage-service/gen/storage/v1"
    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    testkitxcodes "github.com/servekit/testkit-service/pkg/xcodes"
)

// StorageClient is the subset of the embedded storage-service *handler.Handler
// that the storage domain calls. *handler.Handler satisfies it; tests use a
// stub that embeds storagev1.UnimplementedStorageServiceServer.
type StorageClient interface {
    GenerateUploadURL(ctx context.Context, req *storagev1.GenerateUploadURLRequest) (*storagev1.GenerateUploadURLResponse, error)
    GetSTSCredential(ctx context.Context, req *storagev1.GetSTSCredentialRequest) (*storagev1.GetSTSCredentialResponse, error)
    BatchGetSTSCredential(ctx context.Context, req *storagev1.BatchGetSTSCredentialRequest) (*storagev1.BatchGetSTSCredentialResponse, error)
    ConfirmUpload(ctx context.Context, req *storagev1.ConfirmUploadRequest) (*storagev1.ConfirmUploadResponse, error)
    CancelUpload(ctx context.Context, req *storagev1.CancelUploadRequest) (*storagev1.Empty, error)
    GenerateDownloadURL(ctx context.Context, req *storagev1.GenerateDownloadURLRequest) (*storagev1.GenerateDownloadURLResponse, error)
    GenerateProcessURL(ctx context.Context, req *storagev1.GenerateProcessURLRequest) (*storagev1.GenerateProcessURLResponse, error)
    GenerateCDNURL(ctx context.Context, req *storagev1.GenerateCDNURLRequest) (*storagev1.GenerateCDNURLResponse, error)
    ListMyFiles(ctx context.Context, req *storagev1.ListMyFilesRequest) (*storagev1.ListMyFilesResponse, error)
    ListMyFilesPaged(ctx context.Context, req *storagev1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedResponse, error)
    GetMyFile(ctx context.Context, req *storagev1.GetMyFileRequest) (*storagev1.UserFileInfo, error)
    UpdateMyFile(ctx context.Context, req *storagev1.UpdateMyFileRequest) (*storagev1.UserFileInfo, error)
    DeleteMyFile(ctx context.Context, req *storagev1.DeleteMyFileRequest) (*storagev1.Empty, error)
    BatchDeleteMyFiles(ctx context.Context, req *storagev1.BatchDeleteMyFilesRequest) (*storagev1.BatchDeleteMyFilesResponse, error)
    GetMyQuota(ctx context.Context, req *storagev1.GetMyQuotaRequest) (*storagev1.QuotaInfo, error)
    ListMyAuditLogs(ctx context.Context, req *storagev1.ListMyAuditLogsRequest) (*storagev1.ListMyAuditLogsResponse, error)
    SetOwnerQuota(ctx context.Context, req *storagev1.SetOwnerQuotaRequest) (*storagev1.QuotaInfo, error)
    AddOwnerQuota(ctx context.Context, req *storagev1.AddOwnerQuotaRequest) (*storagev1.QuotaInfo, error)
    AdminListFiles(ctx context.Context, req *storagev1.AdminListFilesRequest) (*storagev1.AdminListFilesResponse, error)
    AdminGetFile(ctx context.Context, req *storagev1.AdminGetFileRequest) (*storagev1.AdminFileInfo, error)
    AdminDeleteFile(ctx context.Context, req *storagev1.AdminDeleteFileRequest) (*storagev1.Empty, error)
    AdminGetQuota(ctx context.Context, req *storagev1.AdminGetQuotaRequest) (*storagev1.QuotaInfo, error)
    AdminSetQuota(ctx context.Context, req *storagev1.AdminSetQuotaRequest) (*storagev1.QuotaInfo, error)
    AdminGetStats(ctx context.Context, req *storagev1.AdminGetStatsRequest) (*storagev1.AdminGetStatsResponse, error)
    AdminListProviders(ctx context.Context, req *storagev1.Empty) (*storagev1.AdminListProvidersResponse, error)
    AdminListBuckets(ctx context.Context, req *storagev1.Empty) (*storagev1.AdminListBucketsResponse, error)
    AdminSoftDeleteOwnerFiles(ctx context.Context, req *storagev1.AdminSoftDeleteOwnerFilesRequest) (*storagev1.AdminSoftDeleteOwnerFilesResponse, error)
    AdminDeleteOwner(ctx context.Context, req *storagev1.AdminDeleteOwnerRequest) (*storagev1.AdminDeleteOwnerResponse, error)
    AdminListAuditLogs(ctx context.Context, req *storagev1.AdminListAuditLogsRequest) (*storagev1.AdminListAuditLogsResponse, error)
}

// Service implements the storage domain.
type Service struct {
    storage StorageClient
}

// Option configures Service.
type Option func(*Service)

// WithStorageClient injects a storage client (for tests).
func WithStorageClient(c StorageClient) Option { return func(s *Service) { s.storage = c } }

// New constructs the storage domain service.
func New(client StorageClient, opts ...Option) *Service {
    s := &Service{storage: client}
    for _, o := range opts {
        o(s)
    }
    return s
}

// --- internal helpers ---

// ownerFromCtx builds Owner{USER, ctx.user_id} — the trust-boundary injection
// for all "my-*" RPCs. Returns ErrCallerRequired if AuthInterceptor didn't
// inject a user_id (should never happen behind the interceptor).
func ownerFromCtx(ctx context.Context) (*storagev1.Owner, error) {
    uid, err := grpcx.GetUserIDFromCtx(ctx)
    if err != nil {
        return nil, testkitxcodes.ErrCallerRequired.New()
    }
    return &storagev1.Owner{
        OwnerType: storagev1.OwnerType_OWNER_TYPE_USER,
        OwnerId:   uid,
    }, nil
}

// --- converters (filled in Task 4-10) ---
```

> 注：`storagev1.Empty` 是下游对 `google.protobuf.Empty` 生成的别名类型——实际生成器产出的是 `*emptypb.Empty`（`google.golang.org/protobuf/types/known/emptypb`）。若 `storagev1` 没有 `Empty` 类型别名，把接口里 `*storagev1.Empty` 全改成 `*emptypb.Empty`（import `google.golang.org/protobuf/types/known/emptypb`）。实现时以 `go build` 提示为准：`storage-service/gen/storage/v1/storage.pb.go` 里 grep `type Empty` 确认。下文 Task 4-10 统一用 `*emptypb.Empty` 写法（下游 handler 方法签名就是 `*emptypb.Empty`）。

- [ ] **Step 3: service.go 加 storage 子服务 + facade**

在 `internal/service/service.go` 的 `Service` struct 加字段、`New` 里构造、加 facade（仿 P1 Task 14 auth 接线）：

```go
// in import block
"github.com/servekit/testkit-service/internal/service/storage"

// in Service struct
storage *storage.Service

// in New(), after storage handler built (s.storage = stHdl from resolveDownstreams):
storageSvc := storage.New(stHdl)
s.storage = storageSvc

// accessor
// Storage exposes the storage domain.
func (s *Service) Storage() *storage.Service { return s.storage }
```

> 注：`storage.New(stHdl)` 里 `stHdl` 是 `*storage.Handler`（P1 thirdcall），它满足 `storage.StorageClient` 接口（结构式类型）。

- [ ] **Step 4: 暂不编译**（方法未实现，待 Task 4-10）。先进入 Task 4。

---

## Task 4 [FULLY-WORKED TDD]: ListMyFilesPaged（my-resource passthrough + owner-from-ctx）

代表模式：分页列表、owner 由 ctx 注入、enum（SortField）int 直转、响应实体映射（UserFileInfo→FileInfo）。后续 ListMyFiles / ListMyAuditLogs / GetMyQuota 同构。

**Files:**
- Modify: `internal/service/storage/storage.go`
- Create: `internal/service/storage/storage_test.go`

- [ ] **Step 1: 写测试**

`internal/service/storage/storage_test.go`：

```go
package storage_test

import (
    "context"
    "testing"

    "github.com/servekit/go-common/grpcx"
    storagev1 "github.com/servekit/storage-service/gen/storage/v1"
    testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
    "github.com/servekit/testkit-service/internal/service/storage"
    "github.com/stretchr/testify/require"
)

// stubStorage embeds storagev1.UnimplementedStorageServiceServer so it satisfies
// storage.StorageClient with zero boilerplate; each test overrides only the
// method under test. Echoing req.Owner.OwnerId back as a file Id proves the
// owner was injected from ctx.
type stubStorage struct {
    storagev1.UnimplementedStorageServiceServer
}

func ctxWithUser(uid int64) context.Context {
    return context.WithValue(context.Background(), grpcx.UserIDKey, uid)
}

func TestListMyFilesPaged_InjectsOwnerFromCtx(t *testing.T) {
    s := &stubStorage{}
    s.ListMyFilesPaged = func(_ context.Context, req *storagev1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedResponse, error) {
        require.Equal(t, storagev1.OwnerType_OWNER_TYPE_USER, req.GetOwner().GetOwnerType())
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId()) // ctx user_id → owner
        require.Equal(t, storagev1.SortField_SORT_FIELD_SIZE, req.GetOrderBy()) // int-cast enum
        return &storagev1.ListMyFilesPagedResponse{
            Files:      []*storagev1.UserFileInfo{{Id: 7, Filename: "a.jpg", Size: 100, OwnerType: storagev1.OwnerType_OWNER_TYPE_USER}},
            TotalCount: 1, Page: 1, TotalPages: 1, HasMore: false,
        }, nil
    }
    // override via closure-on-method trick: Go doesn't allow method override on
    // embedded interface; instead wrap with a tiny struct (see helper below).
    svc := storage.New(newStub(s))
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
}
```

> **stub 包装说明**：Go 不允许在嵌入的接口/结构体上「覆写方法」。上面用 `newStub(s)` 把覆写方法转成一个实现 `storage.StorageClient` 的结构体。为避免在每个测试里写 29 个空方法，我们引入一个 `stubFuncs` 结构，按需注入函数值。实现见 Step 2 文件末尾的 test-helper（放在 `storage_test.go` 同包 `_test` 里）。

- [ ] **Step 2: 完善 `storage_test.go` 的 stub 基础设施**

在 `storage_test.go` 顶部追加（提供按需覆写能力，避免每个 stub 写满 29 方法）：

```go
// stubFuncs lets a test override individual RPCs by function value. Methods
// not set fall through to the embedded Unimplemented (returns NotImplemented).
type stubFuncs struct {
    storagev1.UnimplementedStorageServiceServer
    listMyFilesPaged func(context.Context, *storagev1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedResponse, error)
    getSTSCredential func(context.Context, *storagev1.GetSTSCredentialRequest) (*storagev1.GetSTSCredentialResponse, error)
    adminListFiles   func(context.Context, *storagev1.AdminListFilesRequest) (*storagev1.AdminListFilesResponse, error)
    adminGetStats    func(context.Context, *storagev1.AdminGetStatsRequest) (*storagev1.AdminGetStatsResponse, error)
    // ... 后续 Task 按需加字段
}

func newStub(base *stubStorage) *stubFuncs { return &stubFuncs{UnimplementedStorageServiceServer: base} }

func (s *stubFuncs) ListMyFilesPaged(ctx context.Context, req *storagev1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedResponse, error) {
    if s.listMyFilesPaged != nil {
        return s.listMyFilesPaged(ctx, req)
    }
    return s.UnimplementedStorageServiceServer.ListMyFilesPaged(ctx, req)
}
// Task 5-7 在此加 GetSTSCredential / AdminListFiles / AdminGetStats 的转发。
```

> 注：把 Step 1 测试里 `s.ListMyFilesPaged = func(...)` 改为 `stub := newStub(s); stub.listMyFilesPaged = func(...); svc := storage.New(stub)`。最终测试体：

```go
func TestListMyFilesPaged_InjectsOwnerFromCtx(t *testing.T) {
    base := &stubStorage{}
    stub := newStub(base)
    stub.listMyFilesPaged = func(_ context.Context, req *storagev1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedResponse, error) {
        require.Equal(t, storagev1.OwnerType_OWNER_TYPE_USER, req.GetOwner().GetOwnerType())
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        require.Equal(t, storagev1.SortField_SORT_FIELD_SIZE, req.GetOrderBy())
        return &storagev1.ListMyFilesPagedResponse{
            Files: []*storagev1.UserFileInfo{{Id: 7, Filename: "a.jpg", Size: 100, OwnerType: storagev1.OwnerType_OWNER_TYPE_USER}},
            TotalCount: 1, Page: 1, TotalPages: 1,
        }, nil
    }
    svc := storage.New(stub)
    resp, err := svc.ListMyFilesPaged(ctxWithUser(42), &testkitv1.ListMyFilesPagedRequest{
        Page: 1, PageSize: 10, OrderBy: testkitv1.SortField_SORT_FIELD_SIZE,
    })
    require.NoError(t, err)
    require.Equal(t, int64(7), resp.GetFiles()[0].GetId())
    require.Equal(t, "a.jpg", resp.GetFiles()[0].GetFilename())
    require.Equal(t, testkitv1.OwnerType_OWNER_TYPE_USER, resp.GetFiles()[0].GetOwnerType())
    require.Equal(t, int64(1), resp.GetTotalCount())
}
```

- [ ] **Step 3: 运行测试，确认失败**

```bash
go test ./internal/service/storage/...
```

Expected: FAIL / 编译失败（`ListMyFilesPaged` 方法未实现）。

- [ ] **Step 4: 实现 Service 方法 + converters（追加到 storage.go 的 `// --- converters ---` 区，并加 Service 方法）**

在 `storage.go` 的 `Service` 方法区加：

```go
// ListMyFilesPaged lists the caller's files with offset pagination.
func (s *Service) ListMyFilesPaged(ctx context.Context, req *testkitv1.ListMyFilesPagedRequest) (*testkitv1.ListMyFilesPagedResponse, error) {
    downReq, err := toStorageListMyFilesPagedRequest(ctx, req)
    if err != nil {
        return nil, err
    }
    resp, err := s.storage.ListMyFilesPaged(ctx, downReq)
    if err != nil {
        return nil, err
    }
    return toTestkitListMyFilesPagedResponse(resp), nil
}
```

在 converters 区加：

```go
func toStorageListMyFilesPagedRequest(ctx context.Context, r *testkitv1.ListMyFilesPagedRequest) (*storagev1.ListMyFilesPagedRequest, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil {
        return nil, err
    }
    return &storagev1.ListMyFilesPagedRequest{
        Page:               r.GetPage(),
        PageSize:           r.GetPageSize(),
        PathPrefix:         r.GetPathPrefix(),
        Extension:          r.GetExtension(),
        ContentTypePrefix:  r.GetContentTypePrefix(),
        OrderBy:            storagev1.SortField(r.GetOrderBy()),
        Descending:         r.GetDescending(),
        Owner:              owner,
    }, nil
}

func toTestkitListMyFilesPagedResponse(r *storagev1.ListMyFilesPagedResponse) *testkitv1.ListMyFilesPagedResponse {
    files := make([]*testkitv1.FileInfo, 0, len(r.GetFiles()))
    for _, f := range r.GetFiles() {
        files = append(files, toTestkitFileInfo(f))
    }
    return &testkitv1.ListMyFilesPagedResponse{
        Files:      files,
        TotalCount: r.GetTotalCount(),
        Page:       r.GetPage(),
        TotalPages: r.GetTotalPages(),
        HasMore:    r.GetHasMore(),
    }
}

// toTestkitFileInfo maps a storage UserFileInfo to testkit FileInfo (all fields;
// owner_type is the file's attribute, not caller identity — kept).
func toTestkitFileInfo(f *storagev1.UserFileInfo) *testkitv1.FileInfo {
    if f == nil {
        return nil
    }
    return &testkitv1.FileInfo{
        Id:            f.GetId(),
        Filename:      f.GetFilename(),
        FilePath:      f.GetFilePath(),
        Description:   f.GetDescription(),
        Metadata:      f.GetMetadata(),
        IsPublic:      f.GetIsPublic(),
        OwnerType:     testkitv1.OwnerType(f.GetOwnerType()),
        Size:          f.GetSize(),
        ContentType:   f.GetContentType(),
        Extension:     f.GetExtension(),
        Md5:           f.GetMd5(),
        CreatedAt:     f.GetCreatedAt(),
        UpdatedAt:     f.GetUpdatedAt(),
    }
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
go test ./internal/service/storage/...
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add internal/service/storage/ pkg/xcodes/storage.go
git commit -m "feat(storage): ListMyFilesPaged with owner-from-ctx + FileInfo mapping"
```

---

## Task 5 [FULLY-WORKED TDD]: GetSTSCredential（upload-credential RPC）

代表模式：上传凭证类 RPC——请求多字段 + 可选 vendor + Duration ttl，响应是凭证 blob（access_key/secret_key/security_token/endpoint/bucket/object_key/expires_at）+ upload_token + 即时上传（file_info）。owner 由 ctx 注入。后续 GenerateUploadURL / BatchGetSTSCredential / ConfirmUpload / CancelUpload 同构。

**Files:**
- Modify: `internal/service/storage/storage.go`, `storage_test.go`

- [ ] **Step 1: 写测试**

追加到 `storage_test.go`：

```go
func TestGetSTSCredential_InjectsOwnerAndMapsCredential(t *testing.T) {
    base := &stubStorage{}
    stub := newStub(base)
    stub.getSTSCredential = func(_ context.Context, req *storagev1.GetSTSCredentialRequest) (*storagev1.GetSTSCredentialResponse, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        require.Equal(t, storagev1.Vendor_VENDOR_ALIYUN_OSS, req.GetVendor())
        require.Equal(t, "abc.md5", req.GetFilename()) // passthrough sanity
        return &storagev1.GetSTSCredentialResponse{
            Instant: true, FileId: 99,
            UploadToken:    "tok",
            AccessKey:      "ak", SecretKey: "sk", SecurityToken: "st",
            Endpoint: "https://oss.example.com", Bucket: "bkt", ObjectKey: "obj",
            ExpiresAt: 1700000000,
            FileInfo: &storagev1.UserFileInfo{Id: 99, Filename: "abc.md5"},
        }, nil
    }
    svc := storage.New(stub)
    resp, err := svc.GetSTSCredential(ctxWithUser(42), &testkitv1.GetSTSCredentialRequest{
        Filename: "abc.md5", Md5: "900150983cd24fb0d6963f7d28e17f72",
        ContentType: "text/plain", Vendor: testkitv1.Vendor_VENDOR_ALIYUN_OSS,
    })
    require.NoError(t, err)
    require.True(t, resp.GetInstant())
    require.Equal(t, int64(99), resp.GetFileId())
    require.Equal(t, "ak", resp.GetAccessKey())
    require.Equal(t, "obj", resp.GetObjectKey())
    require.Equal(t, "tok", resp.GetUploadToken())
    require.NotNil(t, resp.GetFileInfo())
    require.Equal(t, "abc.md5", resp.GetFileInfo().GetFilename())
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/storage/...
```

Expected: FAIL（`GetSTSCredential` 未实现）。

- [ ] **Step 3: 加 stub 转发 + 实现 + converter**

在 `stubFuncs` 加字段 + 转发方法：

```go
// in stubFuncs struct
getSTSCredential func(context.Context, *storagev1.GetSTSCredentialRequest) (*storagev1.GetSTSCredentialResponse, error)

// method
func (s *stubFuncs) GetSTSCredential(ctx context.Context, req *storagev1.GetSTSCredentialRequest) (*storagev1.GetSTSCredentialResponse, error) {
    if s.getSTSCredential != nil {
        return s.getSTSCredential(ctx, req)
    }
    return s.UnimplementedStorageServiceServer.GetSTSCredential(ctx, req)
}
```

在 `storage.go` 加 Service 方法 + converter：

```go
// GetSTSCredential returns STS temporary credentials + upload token for client-side upload.
func (s *Service) GetSTSCredential(ctx context.Context, req *testkitv1.GetSTSCredentialRequest) (*testkitv1.GetSTSCredentialResponse, error) {
    downReq, err := toStorageGetSTSCredentialRequest(ctx, req)
    if err != nil {
        return nil, err
    }
    resp, err := s.storage.GetSTSCredential(ctx, downReq)
    if err != nil {
        return nil, err
    }
    return toTestkitGetSTSCredentialResponse(resp), nil
}
```

converters：

```go
func toStorageGetSTSCredentialRequest(ctx context.Context, r *testkitv1.GetSTSCredentialRequest) (*storagev1.GetSTSCredentialRequest, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil {
        return nil, err
    }
    return &storagev1.GetSTSCredentialRequest{
        Bucket:            r.GetBucket(),
        MaxSize:           r.GetMaxSize(),
        Filename:          r.GetFilename(),
        Md5:               r.GetMd5(),
        ContentType:       r.GetContentType(),
        FilePath:          r.GetFilePath(),
        Description:       r.GetDescription(),
        Metadata:          r.GetMetadata(),
        Vendor:            storagev1.Vendor(r.GetVendor()),
        Ttl:               r.GetTtl(),
        AllowedExtensions: r.GetAllowedExtensions(),
        Owner:             owner,
    }, nil
}

func toTestkitGetSTSCredentialResponse(r *storagev1.GetSTSCredentialResponse) *testkitv1.GetSTSCredentialResponse {
    return &testkitv1.GetSTSCredentialResponse{
        Instant:       r.GetInstant(),
        FileId:        r.GetFileId(),
        FileInfo:      toTestkitFileInfo(r.GetFileInfo()),
        UploadToken:   r.GetUploadToken(),
        AccessKey:     r.GetAccessKey(),
        SecretKey:     r.GetSecretKey(),
        SecurityToken: r.GetSecurityToken(),
        Endpoint:      r.GetEndpoint(),
        Bucket:        r.GetBucket(),
        ObjectKey:     r.GetObjectKey(),
        ExpiresAt:     r.GetExpiresAt(),
    }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/service/storage/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/service/storage/
git commit -m "feat(storage): GetSTSCredential with owner-from-ctx + credential mapping"
```

---

## Task 6 [FULLY-WORKED TDD]: AdminListFiles（admin RPC with target owner）

代表模式：admin 类——请求**保留** `owner_type` + `owner_id`（操作目标/过滤），不带 ctx owner 注入，纯 enum int-cast + 透传，响应映射 `AdminFileInfo`（含 provider/bucket/object_key）。后续所有 admin RPC 同构。

**Files:**
- Modify: `internal/service/storage/storage.go`, `storage_test.go`

- [ ] **Step 1: 写测试**

```go
func TestAdminListFiles_KeepsTargetOwner_NoCtxInjection(t *testing.T) {
    base := &stubStorage{}
    stub := newStub(base)
    stub.adminListFiles = func(ctx context.Context, req *storagev1.AdminListFilesRequest) (*storagev1.AdminListFilesResponse, error) {
        // owner_type/owner_id are the OPERATION TARGET, passed through from request.
        require.Equal(t, storagev1.OwnerType_OWNER_TYPE_USER, req.GetOwnerType())
        require.Equal(t, int64(77), req.GetOwnerId())
        require.Equal(t, "oss-prod", req.GetProvider())
        // No ctx owner injection on admin RPCs — ctx may not even have a user_id.
        return &storagev1.AdminListFilesResponse{
            Files: []*storagev1.AdminFileInfo{{
                Id: 1, OwnerType: storagev1.OwnerType_OWNER_TYPE_USER, OwnerId: 77,
                Filename: "x.pdf", Size: 2000, Provider: "oss-prod", Bucket: "bkt", ObjectKey: "k",
            }},
            TotalCount: 1,
        }, nil
    }
    svc := storage.New(stub)
    resp, err := svc.AdminListFiles(context.Background(), &testkitv1.AdminListFilesRequest{
        OwnerType: testkitv1.OwnerType_OWNER_TYPE_USER, OwnerId: 77, Provider: "oss-prod",
    })
    require.NoError(t, err)
    require.Len(t, resp.GetFiles(), 1)
    f := resp.GetFiles()[0]
    require.Equal(t, int64(1), f.GetId())
    require.Equal(t, int64(77), f.GetOwnerId())
    require.Equal(t, testkitv1.OwnerType_OWNER_TYPE_USER, f.GetOwnerType())
    require.Equal(t, "oss-prod", f.GetProvider())
    require.Equal(t, "k", f.GetObjectKey())
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/storage/...
```

Expected: FAIL（`AdminListFiles` 未实现）。

- [ ] **Step 3: 加 stub 转发 + 实现 + converter**

`stubFuncs` 加 `adminListFiles` 字段 + 转发（同 Task 5 模式）。`storage.go`：

```go
// AdminListFiles lists all files (admin only). owner_type/owner_id are filters,
// NOT caller identity — passed through unchanged.
func (s *Service) AdminListFiles(ctx context.Context, req *testkitv1.AdminListFilesRequest) (*testkitv1.AdminListFilesResponse, error) {
    resp, err := s.storage.AdminListFiles(ctx, toStorageAdminListFilesRequest(req))
    if err != nil {
        return nil, err
    }
    return toTestkitAdminListFilesResponse(resp), nil
}
```

converters（admin 类**无 ctx 参数**）：

```go
func toStorageAdminListFilesRequest(r *testkitv1.AdminListFilesRequest) *storagev1.AdminListFilesRequest {
    return &storagev1.AdminListFilesRequest{
        OwnerType:        storagev1.OwnerType(r.GetOwnerType()),
        OwnerId:          r.GetOwnerId(),
        PathPrefix:       r.GetPathPrefix(),
        Extension:        r.GetExtension(),
        ContentTypePrefix: r.GetContentTypePrefix(),
        OrderBy:          storagev1.SortField(r.GetOrderBy()),
        Descending:       r.GetDescending(),
        PageSize:         r.GetPageSize(),
        PageToken:        r.GetPageToken(),
        Provider:         r.GetProvider(),
        Bucket:           r.GetBucket(),
    }
}

func toTestkitAdminListFilesResponse(r *storagev1.AdminListFilesResponse) *testkitv1.AdminListFilesResponse {
    files := make([]*testkitv1.AdminFileInfo, 0, len(r.GetFiles()))
    for _, f := range r.GetFiles() {
        files = append(files, toTestkitAdminFileInfo(f))
    }
    return &testkitv1.AdminListFilesResponse{
        Files:        files,
        TotalCount:   r.GetTotalCount(),
        NextPageToken: r.GetNextPageToken(),
    }
}

// toTestkitAdminFileInfo maps storage AdminFileInfo → testkit AdminFileInfo (all fields).
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
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/service/storage/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/service/storage/
git commit -m "feat(storage): AdminListFiles keeps target owner, maps AdminFileInfo"
```

---

## Task 7 [FULLY-WORKED TDD]: AdminGetStats（aggregated stats）

代表模式：聚合响应——嵌套 `repeated OwnerStats/ProviderStats/BucketStats`，请求带可选过滤（owner_type/owner_id，0=all）。映射是嵌套实体的逐字段 + enum int-cast。

**Files:**
- Modify: `internal/service/storage/storage.go`, `storage_test.go`

- [ ] **Step 1: 写测试**

```go
func TestAdminGetStats_MapsNestedAggregates(t *testing.T) {
    base := &stubStorage{}
    stub := newStub(base)
    stub.adminGetStats = func(_ context.Context, req *storagev1.AdminGetStatsRequest) (*storagev1.AdminGetStatsResponse, error) {
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
    require.Equal(t, int64(5000), resp.GetPhysicalBytes())
    require.Len(t, resp.GetOwnerStats(), 1)
    require.Equal(t, testkitv1.OwnerType_OWNER_TYPE_USER, resp.GetOwnerStats()[0].GetOwnerType())
    require.Equal(t, int64(50), resp.GetOwnerStats()[0].GetFileCount())
    require.Equal(t, "oss", resp.GetProviderStats()[0].GetProvider())
    require.Equal(t, int64(50), resp.GetBucketStats()[0].GetFileCount())
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
go test ./internal/service/storage/...
```

Expected: FAIL（`AdminGetStats` 未实现）。

- [ ] **Step 3: 加 stub 转发 + 实现 + converter**

`stubFuncs` 加 `adminGetStats` 字段 + 转发。`storage.go`：

```go
// AdminGetStats returns aggregated storage statistics (admin only).
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
```

converter：

```go
func toTestkitAdminGetStatsResponse(r *storagev1.AdminGetStatsResponse) *testkitv1.AdminGetStatsResponse {
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
            Provider:     p.GetProvider(),
            ObjectCount:  p.GetObjectCount(),
            TotalBytes:   p.GetTotalBytes(),
        })
    }
    buckets := make([]*testkitv1.BucketStats, 0, len(r.GetBucketStats()))
    for _, b := range r.GetBucketStats() {
        buckets = append(buckets, &testkitv1.BucketStats{
            Bucket:       b.GetBucket(),
            ObjectCount:  b.GetObjectCount(),
            TotalBytes:   b.GetTotalBytes(),
            FileCount:    b.GetFileCount(),
        })
    }
    return &testkitv1.AdminGetStatsResponse{
        TotalObjects:   r.GetTotalObjects(),
        TotalFiles:     r.GetTotalFiles(),
        PhysicalBytes:  r.GetPhysicalBytes(),
        LogicalBytes:   r.GetLogicalBytes(),
        OwnerStats:     owners,
        ProviderStats:  providers,
        BucketStats:    buckets,
    }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
go test ./internal/service/storage/...
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add internal/service/storage/
git commit -m "feat(storage): AdminGetStats with nested aggregate mapping"
```

## Task 8 [enumeration]: 剩余 upload / download / process RPCs

Task 5 已建立「upload-credential + owner-from-ctx + 多字段映射」模式。本 Task 把剩余 6 个同构 RPC 一次实现，每个给完整 Service 方法 + converter + stub 转发；写一个合并测试覆盖代表性路径。

覆盖：`GenerateUploadURL`、`BatchGetSTSCredential`、`ConfirmUpload`、`CancelUpload`、`GenerateDownloadURL`、`GenerateProcessURL`、`GenerateCDNURL`（7 个）。

**Files:**
- Modify: `internal/service/storage/storage.go`, `storage_test.go`

- [ ] **Step 1: 在 `stubFuncs` 加 7 个字段 + 转发方法（同 Task 5 模式）**

```go
// 字段
generateUploadURL   func(context.Context, *storagev1.GenerateUploadURLRequest) (*storagev1.GenerateUploadURLResponse, error)
batchGetSTSCredential func(context.Context, *storagev1.BatchGetSTSCredentialRequest) (*storagev1.BatchGetSTSCredentialResponse, error)
confirmUpload       func(context.Context, *storagev1.ConfirmUploadRequest) (*storagev1.ConfirmUploadResponse, error)
cancelUpload        func(context.Context, *storagev1.CancelUploadRequest) (*emptypb.Empty, error)
generateDownloadURL func(context.Context, *storagev1.GenerateDownloadURLRequest) (*storagev1.GenerateDownloadURLResponse, error)
generateProcessURL  func(context.Context, *storagev1.GenerateProcessURLRequest) (*storagev1.GenerateProcessURLResponse, error)
generateCDNURL      func(context.Context, *storagev1.GenerateCDNURLRequest) (*storagev1.GenerateCDNURLResponse, error)

// 转发方法（每个：if f != nil { return f(ctx,req) }; return s.UnimplementedStorageServiceServer.X(ctx,req)
```

> 注：`cancelUpload` 返回 `*emptypb.Empty`（下游 handler 签名）；`storagev1` 若无 `Empty` 类型别名则 import `google.golang.org/protobuf/types/known/emptypb`。下同。

- [ ] **Step 2: 写合并测试（owner 注入 + 关键映射各抽 1 断言）**

```go
func TestUploadAndDownloadRPCs(t *testing.T) {
    base := &stubStorage{}
    stub := newStub(base)

    stub.generateUploadURL = func(_ context.Context, req *storagev1.GenerateUploadURLRequest) (*storagev1.GenerateUploadURLResponse, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        return &storagev1.GenerateUploadURLResponse{Instant: false, UploadToken: "t", UploadUrl: "https://up", ObjectKey: "k", Headers: map[string]string{"a": "b"}}, nil
    }
    stub.confirmUpload = func(_ context.Context, req *storagev1.ConfirmUploadRequest) (*storagev1.ConfirmUploadResponse, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        require.Equal(t, "tok", req.GetUploadToken())
        return &storagev1.ConfirmUploadResponse{FileId: 5, FileInfo: &storagev1.UserFileInfo{Id: 5}}, nil
    }
    stub.cancelUpload = func(_ context.Context, req *storagev1.CancelUploadRequest) (*emptypb.Empty, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        return &emptypb.Empty{}, nil
    }
    stub.generateDownloadURL = func(_ context.Context, req *storagev1.GenerateDownloadURLRequest) (*storagev1.GenerateDownloadURLResponse, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        return &storagev1.GenerateDownloadURLResponse{DownloadUrl: "https://dl", ExpiresAt: 1700}, nil
    }
    stub.generateProcessURL = func(_ context.Context, req *storagev1.GenerateProcessURLRequest) (*storagev1.GenerateProcessURLResponse, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        require.Len(t, req.GetOps(), 1)
        require.Equal(t, storagev1.ImageProcessOp_TYPE_RESIZE, req.GetOps()[0].GetType())
        return &storagev1.GenerateProcessURLResponse{Url: "https://p", ExpiresAt: 1700}, nil
    }
    stub.generateCDNURL = func(_ context.Context, req *storagev1.GenerateCDNURLRequest) (*storagev1.GenerateCDNURLResponse, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        return &storagev1.GenerateCDNURLResponse{Url: "https://cdn", ExpiresAt: 0}, nil
    }

    svc := storage.New(stub)
    ctx := ctxWithUser(42)

    r1, err := svc.GenerateUploadURL(ctx, &testkitv1.GenerateUploadURLRequest{Filename: "f", Size: 1, Md5: "900150983cd24fb0d6963f7d28e17f72", ContentType: "x"})
    require.NoError(t, err); require.Equal(t, "https://up", r1.GetUploadUrl()); require.Equal(t, "b", r1.GetHeaders()["a"])

    r2, err := svc.ConfirmUpload(ctx, &testkitv1.ConfirmUploadRequest{UploadToken: "tok"})
    require.NoError(t, err); require.Equal(t, int64(5), r2.GetFileId())

    _, err = svc.CancelUpload(ctx, &testkitv1.CancelUploadRequest{UploadToken: "tok"})
    require.NoError(t, err)

    r4, err := svc.GenerateDownloadURL(ctx, &testkitv1.GenerateDownloadURLRequest{FileId: 1})
    require.NoError(t, err); require.Equal(t, "https://dl", r4.GetDownloadUrl())

    r5, err := svc.GenerateProcessURL(ctx, &testkitv1.GenerateProcessURLRequest{FileId: 1, Ops: []*testkitv1.ImageProcessOp{{Type: testkitv1.ImageProcessType_IMAGE_PROCESS_TYPE_RESIZE, Width: 100}}})
    require.NoError(t, err); require.Equal(t, "https://p", r5.GetUrl())

    r6, err := svc.GenerateCDNURL(ctx, &testkitv1.GenerateCDNURLRequest{FileId: 1, Public: true})
    require.NoError(t, err); require.Equal(t, "https://cdn", r6.GetUrl())
}

func TestBatchGetSTSCredential_MapsItems(t *testing.T) {
    base := &stubStorage{}
    stub := newStub(base)
    stub.batchGetSTSCredential = func(_ context.Context, req *storagev1.BatchGetSTSCredentialRequest) (*storagev1.BatchGetSTSCredentialResponse, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        require.Len(t, req.GetFiles(), 1)
        return &storagev1.BatchGetSTSCredentialResponse{
            AccessKey: "ak", SecretKey: "sk", SecurityToken: "st", Endpoint: "e", Bucket: "b", ExpiresAt: 1700,
            Items: []*storagev1.UploadCredentialItem{
                {Result: &storagev1.UploadCredentialItem_Token{Token: &storagev1.UploadTokenInfo{UploadToken: "t1", ObjectKey: "o1"}}},
                {Result: &storagev1.UploadCredentialItem_Error{Error: &storagev1.ItemError{Index: 1, Code: "TOO_LARGE", Message: "big"}}},
            },
        }, nil
    }
    svc := storage.New(stub)
    resp, err := svc.BatchGetSTSCredential(ctxWithUser(42), &testkitv1.BatchGetSTSCredentialRequest{
        Files: []*testkitv1.UploadFileMeta{{Md5: "900150983cd24fb0d6963f7d28e17f72", Size: 1, Filename: "f", ContentType: "x"}},
    })
    require.NoError(t, err)
    require.Equal(t, "ak", resp.GetAccessKey())
    require.Len(t, resp.GetItems(), 2)
    require.Equal(t, "t1", resp.GetItems()[0].GetToken().GetUploadToken())
    require.Equal(t, "TOO_LARGE", resp.GetItems()[1].GetError().GetCode())
}
```

- [ ] **Step 3: 运行测试，确认失败**

```bash
go test ./internal/service/storage/...
```

Expected: FAIL（方法未实现）。

- [ ] **Step 4: 实现 7 个 Service 方法 + converters（追加到 storage.go）**

```go
// --- Upload ---

func (s *Service) GenerateUploadURL(ctx context.Context, req *testkitv1.GenerateUploadURLRequest) (*testkitv1.GenerateUploadURLResponse, error) {
    downReq, err := toStorageGenerateUploadURLRequest(ctx, req)
    if err != nil { return nil, err }
    resp, err := s.storage.GenerateUploadURL(ctx, downReq)
    if err != nil { return nil, err }
    return toTestkitGenerateUploadURLResponse(resp), nil
}

func (s *Service) BatchGetSTSCredential(ctx context.Context, req *testkitv1.BatchGetSTSCredentialRequest) (*testkitv1.BatchGetSTSCredentialResponse, error) {
    downReq, err := toStorageBatchGetSTSCredentialRequest(ctx, req)
    if err != nil { return nil, err }
    resp, err := s.storage.BatchGetSTSCredential(ctx, downReq)
    if err != nil { return nil, err }
    return toTestkitBatchGetSTSCredentialResponse(resp), nil
}

func (s *Service) ConfirmUpload(ctx context.Context, req *testkitv1.ConfirmUploadRequest) (*testkitv1.ConfirmUploadResponse, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    resp, err := s.storage.ConfirmUpload(ctx, &storagev1.ConfirmUploadRequest{UploadToken: req.GetUploadToken(), Owner: owner})
    if err != nil { return nil, err }
    return &testkitv1.ConfirmUploadResponse{FileId: resp.GetFileId(), FileInfo: toTestkitFileInfo(resp.GetFileInfo())}, nil
}

func (s *Service) CancelUpload(ctx context.Context, req *testkitv1.CancelUploadRequest) (*emptypb.Empty, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    return s.storage.CancelUpload(ctx, &storagev1.CancelUploadRequest{UploadToken: req.GetUploadToken(), Owner: owner})
}

// --- Download / Process ---

func (s *Service) GenerateDownloadURL(ctx context.Context, req *testkitv1.GenerateDownloadURLRequest) (*testkitv1.GenerateDownloadURLResponse, error) {
    downReq, err := toStorageGenerateDownloadURLRequest(ctx, req)
    if err != nil { return nil, err }
    resp, err := s.storage.GenerateDownloadURL(ctx, downReq)
    if err != nil { return nil, err }
    return &testkitv1.GenerateDownloadURLResponse{DownloadUrl: resp.GetDownloadUrl(), ExpiresAt: resp.GetExpiresAt()}, nil
}

func (s *Service) GenerateProcessURL(ctx context.Context, req *testkitv1.GenerateProcessURLRequest) (*testkitv1.GenerateProcessURLResponse, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    ops := toStorageImageProcessOps(req.GetOps())
    resp, err := s.storage.GenerateProcessURL(ctx, &storagev1.GenerateProcessURLRequest{
        FileId: req.GetFileId(), Ops: ops, TtlSeconds: req.GetTtlSeconds(), Owner: owner,
    })
    if err != nil { return nil, err }
    return &testkitv1.GenerateProcessURLResponse{Url: resp.GetUrl(), ExpiresAt: resp.GetExpiresAt()}, nil
}

func (s *Service) GenerateCDNURL(ctx context.Context, req *testkitv1.GenerateCDNURLRequest) (*testkitv1.GenerateCDNURLResponse, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    ops := toStorageImageProcessOps(req.GetOps())
    resp, err := s.storage.GenerateCDNURL(ctx, &storagev1.GenerateCDNURLRequest{
        FileId: req.GetFileId(), Ops: ops, Ttl: req.GetTtl(), Public: req.GetPublic(), Filename: req.GetFilename(), Owner: owner,
    })
    if err != nil { return nil, err }
    return &testkitv1.GenerateCDNURLResponse{Url: resp.GetUrl(), ExpiresAt: resp.GetExpiresAt()}, nil
}
```

converters（注意 `optional string filename` → 下游 `optional string filename` 直接透传 `req.Filename`；若生成器给出的是 `*string`，用 `Filename: req.Filename` 传递指针）：

```go
func toStorageGenerateUploadURLRequest(ctx context.Context, r *testkitv1.GenerateUploadURLRequest) (*storagev1.GenerateUploadURLRequest, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    return &storagev1.GenerateUploadURLRequest{
        Filename: r.GetFilename(), Size: r.GetSize(), Md5: r.GetMd5(), ContentType: r.GetContentType(),
        Bucket: r.GetBucket(), FilePath: r.GetFilePath(), Description: r.GetDescription(),
        Metadata: r.GetMetadata(), Vendor: storagev1.Vendor(r.GetVendor()), Owner: owner,
    }, nil
}
func toTestkitGenerateUploadURLResponse(r *storagev1.GenerateUploadURLResponse) *testkitv1.GenerateUploadURLResponse {
    return &testkitv1.GenerateUploadURLResponse{
        Instant: r.GetInstant(), FileId: r.GetFileId(), FileInfo: toTestkitFileInfo(r.GetFileInfo()),
        UploadToken: r.GetUploadToken(), UploadUrl: r.GetUploadUrl(), ObjectKey: r.GetObjectKey(), Headers: r.GetHeaders(),
    }
}

func toStorageBatchGetSTSCredentialRequest(ctx context.Context, r *testkitv1.BatchGetSTSCredentialRequest) (*storagev1.BatchGetSTSCredentialRequest, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    files := make([]*storagev1.UploadFileMeta, 0, len(r.GetFiles()))
    for _, f := range r.GetFiles() {
        files = append(files, &storagev1.UploadFileMeta{
            Md5: f.GetMd5(), Size: f.GetSize(), Filename: f.GetFilename(), ContentType: f.GetContentType(),
            FilePath: f.GetFilePath(), Description: f.GetDescription(), Metadata: f.GetMetadata(),
        })
    }
    return &storagev1.BatchGetSTSCredentialRequest{
        Files: files, Bucket: r.GetBucket(), Ttl: r.GetTtl(),
        AllowedExtensions: r.GetAllowedExtensions(), Owner: owner,
    }, nil
}
func toTestkitBatchGetSTSCredentialResponse(r *storagev1.BatchGetSTSCredentialResponse) *testkitv1.BatchGetSTSCredentialResponse {
    items := make([]*testkitv1.UploadCredentialItem, 0, len(r.GetItems()))
    for _, it := range r.GetItems() {
        items = append(items, toTestkitUploadCredentialItem(it))
    }
    return &testkitv1.BatchGetSTSCredentialResponse{
        AccessKey: r.GetAccessKey(), SecretKey: r.GetSecretKey(), SecurityToken: r.GetSecurityToken(),
        Endpoint: r.GetEndpoint(), Bucket: r.GetBucket(), ExpiresAt: r.GetExpiresAt(), Items: items,
    }
}

// toTestkitUploadCredentialItem maps the oneof result (token | error).
func toTestkitUploadCredentialItem(it *storagev1.UploadCredentialItem) *testkitv1.UploadCredentialItem {
    switch v := it.GetResult().(type) {
    case *storagev1.UploadCredentialItem_Token:
        return &testkitv1.UploadCredentialItem{Result: &testkitv1.UploadCredentialItem_Token{Token: &testkitv1.UploadTokenInfo{
            UploadToken: v.Token.GetUploadToken(), ExpiresAt: v.Token.GetExpiresAt(),
            FileId: v.Token.GetFileId(), ObjectKey: v.Token.GetObjectKey(),
        }}}
    case *storagev1.UploadCredentialItem_Error:
        return &testkitv1.UploadCredentialItem{Result: &testkitv1.UploadCredentialItem_Error{Error: &testkitv1.ItemError{
            Index: v.Error.GetIndex(), Code: v.Error.GetCode(), Message: v.Error.GetMessage(),
        }}}
    }
    return nil
}

func toStorageGenerateDownloadURLRequest(ctx context.Context, r *testkitv1.GenerateDownloadURLRequest) (*storagev1.GenerateDownloadURLRequest, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    return &storagev1.GenerateDownloadURLRequest{
        FileId: r.GetFileId(), TtlSeconds: r.GetTtlSeconds(), Filename: r.Filename, Owner: owner,
    }, nil
}

// toStorageImageProcessOps maps a slice of ImageProcessOp (enum int-cast on type+format).
func toStorageImageProcessOps(ops []*testkitv1.ImageProcessOp) []*storagev1.ImageProcessOp {
    out := make([]*storagev1.ImageProcessOp, 0, len(ops))
    for _, o := range ops {
        out = append(out, &storagev1.ImageProcessOp{
            Type: storagev1.ImageProcessOp_TYPE(o.GetType()), // 见下方注记
            Width: o.GetWidth(), Height: o.GetHeight(),
            Format: storagev1.ImageFormat(o.GetFormat()), Quality: o.GetQuality(),
            ResizeMode: storagev1.ImageResizeMode(o.GetResizeMode()),
            WatermarkText: o.GetWatermarkText(), RotateDegrees: o.GetRotateDegrees(),
        })
    }
    return out
}
```

> **嵌套 enum 注记**：下游 `ImageProcessOp.Type` 是**嵌套枚举**（`storagev1.ImageProcessOp_TYPE`）。testkit 把它拎到顶层 `ImageProcessType`。整型值一致，故 `storagev1.ImageProcessOp_TYPE(o.GetType())` 整型直转。若下游生成的类型名不同（如 `ImageProcessOp_Type`），按 `go build` 提示调整大小写/下划线。

- [ ] **Step 5: 运行测试，确认通过**

```bash
go test ./internal/service/storage/...
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add internal/service/storage/
git commit -m "feat(storage): upload/download/process RPCs with owner-from-ctx + oneof/enum mapping"
```

---

## Task 9 [enumeration]: 剩余 my-files / my-quota / my-audit RPCs

Task 4 已建立「my-resource + owner-from-ctx + 实体映射」模式。本 Task 把剩余 7 个同构 RPC 一次实现。覆盖：`ListMyFiles`、`GetMyFile`、`UpdateMyFile`、`DeleteMyFile`、`BatchDeleteMyFiles`、`GetMyQuota`、`ListMyAuditLogs`。

**Files:**
- Modify: `internal/service/storage/storage.go`, `storage_test.go`

- [ ] **Step 1: `stubFuncs` 加字段 + 转发（同模式）**

```go
listMyFiles       func(context.Context, *storagev1.ListMyFilesRequest) (*storagev1.ListMyFilesResponse, error)
getMyFile         func(context.Context, *storagev1.GetMyFileRequest) (*storagev1.UserFileInfo, error)
updateMyFile      func(context.Context, *storagev1.UpdateMyFileRequest) (*storagev1.UserFileInfo, error)
deleteMyFile      func(context.Context, *storagev1.DeleteMyFileRequest) (*emptypb.Empty, error)
batchDeleteMyFiles func(context.Context, *storagev1.BatchDeleteMyFilesRequest) (*storagev1.BatchDeleteMyFilesResponse, error)
getMyQuota        func(context.Context, *storagev1.GetMyQuotaRequest) (*storagev1.QuotaInfo, error)
listMyAuditLogs   func(context.Context, *storagev1.ListMyAuditLogsRequest) (*storagev1.ListMyAuditLogsResponse, error)
```

- [ ] **Step 2: 写合并测试（owner 注入 + 各 RPC 代表性断言）**

```go
func TestMyFilesQuotaAuditRPCs(t *testing.T) {
    base := &stubStorage{}
    stub := newStub(base)

    stub.listMyFiles = func(_ context.Context, req *storagev1.ListMyFilesRequest) (*storagev1.ListMyFilesResponse, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        return &storagev1.ListMyFilesResponse{Files: []*storagev1.UserFileInfo{{Id: 1}}, NextPageToken: "tok"}, nil
    }
    stub.getMyFile = func(_ context.Context, req *storagev1.GetMyFileRequest) (*storagev1.UserFileInfo, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        require.Equal(t, int64(9), req.GetFileId())
        return &storagev1.UserFileInfo{Id: 9, Filename: "f"}, nil
    }
    stub.updateMyFile = func(_ context.Context, req *storagev1.UpdateMyFileRequest) (*storagev1.UserFileInfo, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        require.True(t, req.GetClearMetadata())
        return &storagev1.UserFileInfo{Id: 9, Description: req.GetDescription()}, nil
    }
    stub.deleteMyFile = func(_ context.Context, req *storagev1.DeleteMyFileRequest) (*emptypb.Empty, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        return &emptypb.Empty{}, nil
    }
    stub.batchDeleteMyFiles = func(_ context.Context, req *storagev1.BatchDeleteMyFilesRequest) (*storagev1.BatchDeleteMyFilesResponse, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        return &storagev1.BatchDeleteMyFilesResponse{DeletedCount: 1, FailedIds: []int64{99}}, nil
    }
    stub.getMyQuota = func(_ context.Context, req *storagev1.GetMyQuotaRequest) (*storagev1.QuotaInfo, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        return &storagev1.QuotaInfo{TotalBytes: 1000, UsedBytes: 200, AvailableBytes: 800, FileCount: 3}, nil
    }
    stub.listMyAuditLogs = func(_ context.Context, req *storagev1.ListMyAuditLogsRequest) (*storagev1.ListMyAuditLogsResponse, error) {
        require.Equal(t, int64(42), req.GetOwner().GetOwnerId())
        require.Equal(t, storagev1.AuditAction_AUDIT_ACTION_UPLOAD, req.GetAction())
        return &storagev1.ListMyAuditLogsResponse{
            Logs: []*storagev1.AuditLogEntry{{Id: 1, Action: storagev1.AuditAction_AUDIT_ACTION_UPLOAD, Status: storagev1.AuditLogStatus_AUDIT_LOG_STATUS_SUCCESS}},
            TotalCount: 1,
        }, nil
    }

    svc := storage.New(stub)
    ctx := ctxWithUser(42)

    r1, err := svc.ListMyFiles(ctx, &testkitv1.ListMyFilesRequest{PageSize: 10})
    require.NoError(t, err); require.Equal(t, "tok", r1.GetNextPageToken())

    r2, err := svc.GetMyFile(ctx, &testkitv1.GetMyFileRequest{FileId: 9})
    require.NoError(t, err); require.Equal(t, "f", r2.GetFilename())

    r3, err := svc.UpdateMyFile(ctx, &testkitv1.UpdateMyFileRequest{FileId: 9, Description: wrapper("d"), ClearMetadata: wrapperBool(true)})
    require.NoError(t, err); require.Equal(t, "d", r3.GetDescription())

    _, err = svc.DeleteMyFile(ctx, &testkitv1.DeleteMyFileRequest{FileId: 9})
    require.NoError(t, err)

    r5, err := svc.BatchDeleteMyFiles(ctx, &testkitv1.BatchDeleteMyFilesRequest{FileIds: []int64{9, 99}})
    require.NoError(t, err); require.Equal(t, int32(1), r5.GetDeletedCount()); require.Equal(t, []int64{99}, r5.GetFailedIds())

    r6, err := svc.GetMyQuota(ctx, &emptypb.Empty{})
    require.NoError(t, err); require.Equal(t, int64(800), r6.GetAvailableBytes()); require.Equal(t, int32(3), r6.GetFileCount())

    r7, err := svc.ListMyAuditLogs(ctx, &testkitv1.ListMyAuditLogsRequest{Action: testkitv1.AuditAction_AUDIT_ACTION_UPLOAD})
    require.NoError(t, err)
    require.Equal(t, testkitv1.AuditLogStatus_AUDIT_LOG_STATUS_SUCCESS, r7.GetLogs()[0].GetStatus())
}
```

> `wrapper` / `wrapperBool` 是 `proto.String` / `proto.Bool` 的别名 helper（optional 字段）；测试里直接用 `proto.String("d")` / `proto.Bool(true)` 即可（import `google.golang.org/protobuf/proto`）。上面伪写法实际替换为 `Description: proto.String("d"), ClearMetadata: proto.Bool(true)`。

- [ ] **Step 3: 运行测试，确认失败**

```bash
go test ./internal/service/storage/...
```

Expected: FAIL。

- [ ] **Step 4: 实现 7 个 Service 方法 + converters**

```go
// --- My Files ---

func (s *Service) ListMyFiles(ctx context.Context, req *testkitv1.ListMyFilesRequest) (*testkitv1.ListMyFilesResponse, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    resp, err := s.storage.ListMyFiles(ctx, &storagev1.ListMyFilesRequest{
        PathPrefix: req.GetPathPrefix(), Extension: req.GetExtension(), ContentTypePrefix: req.GetContentTypePrefix(),
        OrderBy: storagev1.SortField(req.GetOrderBy()), Descending: req.GetDescending(),
        PageSize: req.GetPageSize(), PageToken: req.GetPageToken(), Owner: owner,
    })
    if err != nil { return nil, err }
    files := make([]*testkitv1.FileInfo, 0, len(resp.GetFiles()))
    for _, f := range resp.GetFiles() { files = append(files, toTestkitFileInfo(f)) }
    return &testkitv1.ListMyFilesResponse{Files: files, NextPageToken: resp.GetNextPageToken()}, nil
}

func (s *Service) GetMyFile(ctx context.Context, req *testkitv1.GetMyFileRequest) (*testkitv1.FileInfo, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    f, err := s.storage.GetMyFile(ctx, &storagev1.GetMyFileRequest{FileId: req.GetFileId(), Owner: owner})
    if err != nil { return nil, err }
    return toTestkitFileInfo(f), nil
}

func (s *Service) UpdateMyFile(ctx context.Context, req *testkitv1.UpdateMyFileRequest) (*testkitv1.FileInfo, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    f, err := s.storage.UpdateMyFile(ctx, &storagev1.UpdateMyFileRequest{
        FileId: req.GetFileId(), Filename: req.Filename, FilePath: req.FilePath,
        Description: req.Description, Metadata: req.GetMetadata(), ClearMetadata: req.ClearMetadata, Owner: owner,
    })
    if err != nil { return nil, err }
    return toTestkitFileInfo(f), nil
}

func (s *Service) DeleteMyFile(ctx context.Context, req *testkitv1.DeleteMyFileRequest) (*emptypb.Empty, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    return s.storage.DeleteMyFile(ctx, &storagev1.DeleteMyFileRequest{FileId: req.GetFileId(), Owner: owner})
}

func (s *Service) BatchDeleteMyFiles(ctx context.Context, req *testkitv1.BatchDeleteMyFilesRequest) (*testkitv1.BatchDeleteMyFilesResponse, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    resp, err := s.storage.BatchDeleteMyFiles(ctx, &storagev1.BatchDeleteMyFilesRequest{FileIds: req.GetFileIds(), Owner: owner})
    if err != nil { return nil, err }
    return &testkitv1.BatchDeleteMyFilesResponse{DeletedCount: resp.GetDeletedCount(), FailedIds: resp.GetFailedIds()}, nil
}

// --- My Quota / Audit ---

func (s *Service) GetMyQuota(ctx context.Context, _ *emptypb.Empty) (*testkitv1.QuotaInfo, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    q, err := s.storage.GetMyQuota(ctx, &storagev1.GetMyQuotaRequest{Owner: owner})
    if err != nil { return nil, err }
    return toTestkitQuotaInfo(q), nil
}

func (s *Service) ListMyAuditLogs(ctx context.Context, req *testkitv1.ListMyAuditLogsRequest) (*testkitv1.ListMyAuditLogsResponse, error) {
    owner, err := ownerFromCtx(ctx)
    if err != nil { return nil, err }
    resp, err := s.storage.ListMyAuditLogs(ctx, &storagev1.ListMyAuditLogsRequest{
        Action: storagev1.AuditAction(req.GetAction()), TargetType: storagev1.AuditLogTargetType(req.GetTargetType()),
        StartTime: req.GetStartTime(), EndTime: req.GetEndTime(),
        PageSize: req.GetPageSize(), PageToken: req.GetPageToken(), Owner: owner,
    })
    if err != nil { return nil, err }
    return toTestkitListAuditLogsResponse(resp.GetLogs(), resp.GetTotalCount(), resp.GetNextPageToken()), nil
}

// --- shared audit/quota converters ---

func toTestkitQuotaInfo(q *storagev1.QuotaInfo) *testkitv1.QuotaInfo {
    if q == nil { return nil }
    return &testkitv1.QuotaInfo{
        TotalBytes: q.GetTotalBytes(), UsedBytes: q.GetUsedBytes(),
        AvailableBytes: q.GetAvailableBytes(), FileCount: q.GetFileCount(),
    }
}

func toTestkitAuditLogEntry(e *storagev1.AuditLogEntry) *testkitv1.AuditLogEntry {
    if e == nil { return nil }
    return &testkitv1.AuditLogEntry{
        Id: e.GetId(), Action: testkitv1.AuditAction(e.GetAction()),
        OwnerType: testkitv1.OwnerType(e.GetOwnerType()), OwnerId: e.GetOwnerId(),
        TargetType: testkitv1.AuditLogTargetType(e.GetTargetType()), TargetId: e.GetTargetId(),
        Before: e.GetBefore(), After: e.GetAfter(),
        Status: testkitv1.AuditLogStatus(e.GetStatus()), ErrorMessage: e.GetErrorMessage(),
        RequestId: e.GetRequestId(), CreatedAt: e.GetCreatedAt(),
    }
}

// toTestkitListAuditLogsResponse shared by ListMyAuditLogs + AdminListAuditLogs.
func toTestkitListAuditLogsResponse(logs []*storagev1.AuditLogEntry, total int32, nextPage string) *... {
    // （两个响应类型不同，故此 helper 仅作 log slice 映射；调用方自行包成对应 testkit 响应类型）
}
```

> 注：`ListMyAuditLogs` 与 `AdminListAuditLogs` 的响应类型不同（`ListMyAuditLogsResponse` vs `AdminListAuditLogsResponse`），无法共享一个 helper 返回。改为内联映射 logs slice（模式同 Task 4 的 files slice）。把上面 `toTestkitListAuditLogsResponse` 删掉，`ListMyAuditLogs` 内联：

```go
    logs := make([]*testkitv1.AuditLogEntry, 0, len(resp.GetLogs()))
    for _, e := range resp.GetLogs() { logs = append(logs, toTestkitAuditLogEntry(e)) }
    return &testkitv1.ListMyAuditLogsResponse{Logs: logs, TotalCount: resp.GetTotalCount(), NextPageToken: resp.GetNextPageToken()}, nil
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
go test ./internal/service/storage/...
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add internal/service/storage/
git commit -m "feat(storage): my-files/quota/audit RPCs with owner-from-ctx"
```

---

## Task 10 [enumeration]: 剩余 owner-quota + admin RPCs

Task 6/7 已建立「admin + 保留 target owner + 实体/嵌套映射」模式。本 Task 把剩余 11 个 admin/owner-quota RPC 一次实现。覆盖：`SetOwnerQuota`、`AddOwnerQuota`、`AdminGetFile`、`AdminDeleteFile`、`AdminGetQuota`、`AdminSetQuota`、`AdminListProviders`、`AdminListBuckets`、`AdminSoftDeleteOwnerFiles`、`AdminDeleteOwner`、`AdminListAuditLogs`。

**Files:**
- Modify: `internal/service/storage/storage.go`, `storage_test.go`

- [ ] **Step 1: `stubFuncs` 加 11 个字段 + 转发（同模式）**

```go
setOwnerQuota              func(context.Context, *storagev1.SetOwnerQuotaRequest) (*storagev1.QuotaInfo, error)
addOwnerQuota              func(context.Context, *storagev1.AddOwnerQuotaRequest) (*storagev1.QuotaInfo, error)
adminGetFile               func(context.Context, *storagev1.AdminGetFileRequest) (*storagev1.AdminFileInfo, error)
adminDeleteFile            func(context.Context, *storagev1.AdminDeleteFileRequest) (*emptypb.Empty, error)
adminGetQuota              func(context.Context, *storagev1.AdminGetQuotaRequest) (*storagev1.QuotaInfo, error)
adminSetQuota              func(context.Context, *storagev1.AdminSetQuotaRequest) (*storagev1.QuotaInfo, error)
adminListProviders         func(context.Context, *emptypb.Empty) (*storagev1.AdminListProvidersResponse, error)
adminListBuckets           func(context.Context, *emptypb.Empty) (*storagev1.AdminListBucketsResponse, error)
adminSoftDeleteOwnerFiles  func(context.Context, *storagev1.AdminSoftDeleteOwnerFilesRequest) (*storagev1.AdminSoftDeleteOwnerFilesResponse, error)
adminDeleteOwner           func(context.Context, *storagev1.AdminDeleteOwnerRequest) (*storagev1.AdminDeleteOwnerResponse, error)
adminListAuditLogs         func(context.Context, *storagev1.AdminListAuditLogsRequest) (*storagev1.AdminListAuditLogsResponse, error)
```

- [ ] **Step 2: 写合并测试（target owner 保留 + 各 RPC 代表性断言）**

```go
func TestAdminAndOwnerQuotaRPCs(t *testing.T) {
    base := &stubStorage{}
    stub := newStub(base)

    stub.adminGetFile = func(_ context.Context, req *storagev1.AdminGetFileRequest) (*storagev1.AdminFileInfo, error) {
        require.Equal(t, int64(9), req.GetFileId())
        return &storagev1.AdminFileInfo{Id: 9, OwnerType: storagev1.OwnerType_OWNER_TYPE_USER, OwnerId: 3, Provider: "oss"}, nil
    }
    stub.adminDeleteFile = func(_ context.Context, req *storagev1.AdminDeleteFileRequest) (*emptypb.Empty, error) {
        require.Equal(t, int64(9), req.GetFileId()); return &emptypb.Empty{}, nil
    }
    stub.adminGetQuota = func(_ context.Context, req *storagev1.AdminGetQuotaRequest) (*storagev1.QuotaInfo, error) {
        require.Equal(t, int64(3), req.GetOwnerId())
        return &storagev1.QuotaInfo{TotalBytes: 1, UsedBytes: 0, AvailableBytes: 1, FileCount: 0}, nil
    }
    stub.adminSetQuota = func(_ context.Context, req *storagev1.AdminSetQuotaRequest) (*storagev1.QuotaInfo, error) {
        require.Equal(t, int64(3), req.GetOwnerId()); require.Equal(t, int64(5000), req.GetTotalBytes())
        return &storagev1.QuotaInfo{TotalBytes: 5000}, nil
    }
    stub.setOwnerQuota = func(_ context.Context, req *storagev1.SetOwnerQuotaRequest) (*storagev1.QuotaInfo, error) {
        require.Equal(t, storagev1.OwnerType_OWNER_TYPE_BUSINESS, req.GetOwnerType())
        return &storagev1.QuotaInfo{TotalBytes: req.GetTotalBytes()}, nil
    }
    stub.addOwnerQuota = func(_ context.Context, req *storagev1.AddOwnerQuotaRequest) (*storagev1.QuotaInfo, error) {
        require.Equal(t, int64(-100), req.GetDeltaBytes())
        return &storagev1.QuotaInfo{TotalBytes: 900}, nil
    }
    stub.adminListProviders = func(_ context.Context, _ *emptypb.Empty) (*storagev1.AdminListProvidersResponse, error) {
        return &storagev1.AdminListProvidersResponse{Providers: []*storagev1.ProviderInfo{{Name: "oss", Vendor: storagev1.Vendor_VENDOR_ALIYUN_OSS, Endpoint: "e", Region: "cn-hangzhou"}}}, nil
    }
    stub.adminListBuckets = func(_ context.Context, _ *emptypb.Empty) (*storagev1.AdminListBucketsResponse, error) {
        return &storagev1.AdminListBucketsResponse{Buckets: []*storagev1.BucketInfo{{Name: "b", Provider: "oss", KeyPrefix: "p", Acl: storagev1.BucketACL_BUCKET_ACL_PRIVATE, Vendor: storagev1.Vendor_VENDOR_ALIYUN_OSS}}}, nil
    }
    stub.adminSoftDeleteOwnerFiles = func(_ context.Context, req *storagev1.AdminSoftDeleteOwnerFilesRequest) (*storagev1.AdminSoftDeleteOwnerFilesResponse, error) {
        require.Equal(t, int64(3), req.GetOwnerId())
        return &storagev1.AdminSoftDeleteOwnerFilesResponse{FilesDeleted: 7, BytesReleased: 1000}, nil
    }
    stub.adminDeleteOwner = func(_ context.Context, req *storagev1.AdminDeleteOwnerRequest) (*storagev1.AdminDeleteOwnerResponse, error) {
        return &storagev1.AdminDeleteOwnerResponse{FilesDeleted: 7, BytesReleased: 1000}, nil
    }
    stub.adminListAuditLogs = func(_ context.Context, req *storagev1.AdminListAuditLogsRequest) (*storagev1.AdminListAuditLogsResponse, error) {
        require.Equal(t, "req-1", req.GetRequestId()) // request_id 是过滤字段，保留
        return &storagev1.AdminListAuditLogsResponse{Logs: []*storagev1.AuditLogEntry{{Id: 1}}, TotalCount: 1}, nil
    }

    svc := storage.New(stub)
    ctx := context.Background()

    r1, err := svc.AdminGetFile(ctx, &testkitv1.AdminGetFileRequest{FileId: 9})
    require.NoError(t, err); require.Equal(t, "oss", r1.GetProvider())

    _, err = svc.AdminDeleteFile(ctx, &testkitv1.AdminDeleteFileRequest{FileId: 9})
    require.NoError(t, err)

    r3, err := svc.AdminGetQuota(ctx, &testkitv1.AdminGetQuotaRequest{OwnerType: testkitv1.OwnerType_OWNER_TYPE_USER, OwnerId: 3})
    require.NoError(t, err); require.Equal(t, int64(1), r3.GetTotalBytes())

    r4, err := svc.AdminSetQuota(ctx, &testkitv1.AdminSetQuotaRequest{OwnerType: testkitv1.OwnerType_OWNER_TYPE_USER, OwnerId: 3, TotalBytes: 5000})
    require.NoError(t, err); require.Equal(t, int64(5000), r4.GetTotalBytes())

    r5, err := svc.SetOwnerQuota(ctx, &testkitv1.SetOwnerQuotaRequest{OwnerType: testkitv1.OwnerType_OWNER_TYPE_BUSINESS, OwnerId: 3, TotalBytes: 5000})
    require.NoError(t, err); require.Equal(t, int64(5000), r5.GetTotalBytes())

    r6, err := svc.AddOwnerQuota(ctx, &testkitv1.AddOwnerQuotaRequest{OwnerType: testkitv1.OwnerType_OWNER_TYPE_BUSINESS, OwnerId: 3, DeltaBytes: -100})
    require.NoError(t, err); require.Equal(t, int64(900), r6.GetTotalBytes())

    r7, err := svc.AdminListProviders(ctx, &emptypb.Empty{})
    require.NoError(t, err); require.Equal(t, testkitv1.Vendor_VENDOR_ALIYUN_OSS, r7.GetProviders()[0].GetVendor())

    r8, err := svc.AdminListBuckets(ctx, &emptypb.Empty{})
    require.NoError(t, err); require.Equal(t, testkitv1.BucketACL_BUCKET_ACL_PRIVATE, r8.GetBuckets()[0].GetAcl())

    r9, err := svc.AdminSoftDeleteOwnerFiles(ctx, &testkitv1.AdminSoftDeleteOwnerFilesRequest{OwnerType: testkitv1.OwnerType_OWNER_TYPE_USER, OwnerId: 3})
    require.NoError(t, err); require.Equal(t, int64(7), r9.GetFilesDeleted())

    r10, err := svc.AdminDeleteOwner(ctx, &testkitv1.AdminDeleteOwnerRequest{OwnerType: testkitv1.OwnerType_OWNER_TYPE_USER, OwnerId: 3})
    require.NoError(t, err); require.Equal(t, int64(1000), r10.GetBytesReleased())

    r11, err := svc.AdminListAuditLogs(ctx, &testkitv1.AdminListAuditLogsRequest{RequestId: "req-1"})
    require.NoError(t, err); require.Len(t, r11.GetLogs(), 1)
}
```

- [ ] **Step 3: 运行测试，确认失败**

```bash
go test ./internal/service/storage/...
```

Expected: FAIL。

- [ ] **Step 4: 实现 11 个 Service 方法 + converters**

```go
// --- Owner quota (BFF-internal orchestration; target owner kept) ---

func (s *Service) SetOwnerQuota(ctx context.Context, req *testkitv1.SetOwnerQuotaRequest) (*testkitv1.QuotaInfo, error) {
    q, err := s.storage.SetOwnerQuota(ctx, &storagev1.SetOwnerQuotaRequest{
        OwnerType: storagev1.OwnerType(req.GetOwnerType()), OwnerId: req.GetOwnerId(), TotalBytes: req.GetTotalBytes(),
    })
    if err != nil { return nil, err }
    return toTestkitQuotaInfo(q), nil
}

func (s *Service) AddOwnerQuota(ctx context.Context, req *testkitv1.AddOwnerQuotaRequest) (*testkitv1.QuotaInfo, error) {
    q, err := s.storage.AddOwnerQuota(ctx, &storagev1.AddOwnerQuotaRequest{
        OwnerType: storagev1.OwnerType(req.GetOwnerType()), OwnerId: req.GetOwnerId(), DeltaBytes: req.GetDeltaBytes(),
    })
    if err != nil { return nil, err }
    return toTestkitQuotaInfo(q), nil
}

// --- Admin ---

func (s *Service) AdminGetFile(ctx context.Context, req *testkitv1.AdminGetFileRequest) (*testkitv1.AdminFileInfo, error) {
    f, err := s.storage.AdminGetFile(ctx, &storagev1.AdminGetFileRequest{FileId: req.GetFileId()})
    if err != nil { return nil, err }
    return toTestkitAdminFileInfo(f), nil
}

func (s *Service) AdminDeleteFile(ctx context.Context, req *testkitv1.AdminDeleteFileRequest) (*emptypb.Empty, error) {
    return s.storage.AdminDeleteFile(ctx, &storagev1.AdminDeleteFileRequest{FileId: req.GetFileId()})
}

func (s *Service) AdminGetQuota(ctx context.Context, req *testkitv1.AdminGetQuotaRequest) (*testkitv1.QuotaInfo, error) {
    q, err := s.storage.AdminGetQuota(ctx, &storagev1.AdminGetQuotaRequest{
        OwnerType: storagev1.OwnerType(req.GetOwnerType()), OwnerId: req.GetOwnerId(),
    })
    if err != nil { return nil, err }
    return toTestkitQuotaInfo(q), nil
}

func (s *Service) AdminSetQuota(ctx context.Context, req *testkitv1.AdminSetQuotaRequest) (*testkitv1.QuotaInfo, error) {
    q, err := s.storage.AdminSetQuota(ctx, &storagev1.AdminSetQuotaRequest{
        OwnerType: storagev1.OwnerType(req.GetOwnerType()), OwnerId: req.GetOwnerId(), TotalBytes: req.GetTotalBytes(),
    })
    if err != nil { return nil, err }
    return toTestkitQuotaInfo(q), nil
}

func (s *Service) AdminListProviders(ctx context.Context, _ *emptypb.Empty) (*testkitv1.AdminListProvidersResponse, error) {
    resp, err := s.storage.AdminListProviders(ctx, &emptypb.Empty{})
    if err != nil { return nil, err }
    providers := make([]*testkitv1.ProviderInfo, 0, len(resp.GetProviders()))
    for _, p := range resp.GetProviders() {
        providers = append(providers, &testkitv1.ProviderInfo{
            Name: p.GetName(), Vendor: testkitv1.Vendor(p.GetVendor()), Endpoint: p.GetEndpoint(), Region: p.GetRegion(),
        })
    }
    return &testkitv1.AdminListProvidersResponse{Providers: providers}, nil
}

func (s *Service) AdminListBuckets(ctx context.Context, _ *emptypb.Empty) (*testkitv1.AdminListBucketsResponse, error) {
    resp, err := s.storage.AdminListBuckets(ctx, &emptypb.Empty{})
    if err != nil { return nil, err }
    buckets := make([]*testkitv1.BucketInfo, 0, len(resp.GetBuckets()))
    for _, b := range resp.GetBuckets() {
        buckets = append(buckets, &testkitv1.BucketInfo{
            Name: b.GetName(), Provider: b.GetProvider(), KeyPrefix: b.GetKeyPrefix(),
            Acl: testkitv1.BucketACL(b.GetAcl()), Vendor: testkitv1.Vendor(b.GetVendor()),
        })
    }
    return &testkitv1.AdminListBucketsResponse{Buckets: buckets}, nil
}

func (s *Service) AdminSoftDeleteOwnerFiles(ctx context.Context, req *testkitv1.AdminSoftDeleteOwnerFilesRequest) (*testkitv1.AdminSoftDeleteOwnerFilesResponse, error) {
    resp, err := s.storage.AdminSoftDeleteOwnerFiles(ctx, &storagev1.AdminSoftDeleteOwnerFilesRequest{
        OwnerType: storagev1.OwnerType(req.GetOwnerType()), OwnerId: req.GetOwnerId(),
    })
    if err != nil { return nil, err }
    return &testkitv1.AdminSoftDeleteOwnerFilesResponse{FilesDeleted: resp.GetFilesDeleted(), BytesReleased: resp.GetBytesReleased()}, nil
}

func (s *Service) AdminDeleteOwner(ctx context.Context, req *testkitv1.AdminDeleteOwnerRequest) (*testkitv1.AdminDeleteOwnerResponse, error) {
    resp, err := s.storage.AdminDeleteOwner(ctx, &storagev1.AdminDeleteOwnerRequest{
        OwnerType: storagev1.OwnerType(req.GetOwnerType()), OwnerId: req.GetOwnerId(),
    })
    if err != nil { return nil, err }
    return &testkitv1.AdminDeleteOwnerResponse{FilesDeleted: resp.GetFilesDeleted(), BytesReleased: resp.GetBytesReleased()}, nil
}

func (s *Service) AdminListAuditLogs(ctx context.Context, req *testkitv1.AdminListAuditLogsRequest) (*testkitv1.AdminListAuditLogsResponse, error) {
    resp, err := s.storage.AdminListAuditLogs(ctx, &storagev1.AdminListAuditLogsRequest{
        Action: storagev1.AuditAction(req.GetAction()), TargetType: storagev1.AuditLogTargetType(req.GetTargetType()),
        Status: storagev1.AuditLogStatus(req.GetStatus()), RequestId: req.GetRequestId(),
        OwnerType: storagev1.OwnerType(req.GetOwnerType()), OwnerId: req.GetOwnerId(), TargetId: req.GetTargetId(),
        StartTime: req.GetStartTime(), EndTime: req.GetEndTime(),
        PageSize: req.GetPageSize(), PageToken: req.GetPageToken(),
    })
    if err != nil { return nil, err }
    logs := make([]*testkitv1.AuditLogEntry, 0, len(resp.GetLogs()))
    for _, e := range resp.GetLogs() { logs = append(logs, toTestkitAuditLogEntry(e)) }
    return &testkitv1.AdminListAuditLogsResponse{Logs: logs, TotalCount: resp.GetTotalCount(), NextPageToken: resp.GetNextPageToken()}, nil
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
go test ./internal/service/storage/...
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add internal/service/storage/
git commit -m "feat(storage): owner-quota + remaining admin RPCs with target-owner passthrough"
```

---

## Task 10.5: handler 29 个 RPC 一行委托 + service.go facade 收尾

**Files:**
- Modify: `pkg/handler/testkit.go`
- Modify: `internal/service/service.go`

- [ ] **Step 1: handler 每个新 RPC 一行委托（薄壳，只见 testkitv1）**

`pkg/handler/testkit.go` 逐个加（仿 P1 Task 14）。示例前 3 个 + admin 一个：

```go
func (h *Handler) GenerateUploadURL(ctx context.Context, req *testkitv1.GenerateUploadURLRequest) (*testkitv1.GenerateUploadURLResponse, error) {
    return h.svc.Storage().GenerateUploadURL(ctx, req)
}
func (h *Handler) GetSTSCredential(ctx context.Context, req *testkitv1.GetSTSCredentialRequest) (*testkitv1.GetSTSCredentialResponse, error) {
    return h.svc.Storage().GetSTSCredential(ctx, req)
}
func (h *Handler) ListMyFilesPaged(ctx context.Context, req *testkitv1.ListMyFilesPagedRequest) (*testkitv1.ListMyFilesPagedResponse, error) {
    return h.svc.Storage().ListMyFilesPaged(ctx, req)
}
// ... 其余 26 个同形：return h.svc.Storage().<Method>(ctx, req)
```

> 返回 `*emptypb.Empty` 的（`CancelUpload` / `DeleteMyFile` / `AdminDeleteFile`）签名一致；返回直接实体（`GetMyFile`/`UpdateMyFile` → `FileInfo`、`AdminGetFile` → `AdminFileInfo`、`GetMyQuota`/`AdminGetQuota`/`SetOwnerQuota`/`AddOwnerQuota`/`AdminSetQuota` → `QuotaInfo`）同理。

- [ ] **Step 2: 确认 service.go 的 `Storage()` facade 已建（Task 3 Step 3），且 `New` 已注入 storage handler**

- [ ] **Step 3: 全量构建 + 测试**

```bash
go build ./...
go test -race ./...
golangci-lint run ./...
```

Expected: 全 PASS。`pkg/server.go` 的 AuthInterceptor 公开名单（P1 Task 15）**不要**加任何 P3 RPC（全部需登录）；admin RPC **本期不做 RBAC 鉴权**——仅登录态 + 身份注入（v2 §3.5；OPA 后续）。

- [ ] **Step 4: Commit**

```bash
git add pkg/handler/ internal/service/service.go
git commit -m "feat(handler): wire 29 storage RPCs through Storage() facade"
```

## Task 11 [FULLY-WORKED frontend]: 我的文件页（ProTable + STS 上传 + 下载/处理）

代表前端模式：ProTable 分页列表（`ListMyFilesPaged`）+ 上传流程（`GetSTSCredential` 拿凭证 → 客户端直传 OSS → `ConfirmUpload` 确认）+ 行内下载/处理动作。所有请求函数由 `npm run openapi` 生成，**无手写 fetch**。配额页/审计页/admin 页同构（Task 12/13）。

**Files:**
- Create: `web/src/pages/Files/MyFiles/index.tsx`
- Create: `web/src/pages/Files/MyFiles/UploadModal.tsx`
- Modify: `web/config/routes.ts`

- [ ] **Step 1: `make proto` + 前端 `npm run openapi` 重生 services**

```bash
cd /Users/moss/code/servekit/testkit-service
make proto
cd web
npm run openapi   # swagger2openapi 2.0→3.0 + max openapi → src/services/testkit/
```

Expected: `web/src/services/testkit/` 含 `listMyFilesPaged`、`getStsCredential`、`confirmUpload`、`generateDownloadUrl`、`deleteMyFile` 等生成函数；`typings.d.ts` 含对应 `API` 类型。生成函数名 = operationId（`simple_operation_ids=true`）。

> 校验：`grep -rn "fetch(" web/src/pages web/src/services/testkit` 应只见 `src/services/testkit/` 内生成器的 request 调用，页面**无手写 fetch**（spec §5.3）。

- [ ] **Step 2: 加路由**

`web/config/routes.ts`（在已有路由树加）：

```ts
{
  path: '/files',
  name: '我的文件',
  icon: 'FileText',
  access: 'canUser', // 任意登录用户
  routes: [
    { path: '/files', redirect: '/files/my' },
    { path: '/files/my', name: '文件列表', component: './Files/MyFiles' },
  ],
},
```

- [ ] **Step 3: 写 ProTable 列表 + 下载/删除动作**

`web/src/pages/Files/MyFiles/index.tsx`：

```tsx
import { ProTable } from '@ant-design/pro-components';
import { Button, Popconfirm, Space, message, Tag } from 'antd';
import {
  listMyFilesPaged,
  deleteMyFile,
  generateDownloadUrl,
} from '@/services/testkit';
import type { API } from '@/services/testkit/typings';
import { useRef } from 'react';
import UploadModal from './UploadModal';

export default function MyFiles() {
  const actionRef = useRef();
  const handleDownload = async (fileId: number) => {
    const resp = await generateDownloadUrl({ fileId });
    window.open(resp.downloadUrl, '_blank');
  };
  const handleDelete = async (fileId: number) => {
    await deleteMyFile({ fileId });
    message.success('已删除');
    actionRef.current?.reload();
  };

  return (
    <ProTable<API.FileInfo>
      actionRef={actionRef}
      rowKey="id"
      request={async (params) => {
        const resp = await listMyFilesPaged({
          page: params.current ?? 1,
          pageSize: params.pageSize ?? 10,
          pathPrefix: params.path_prefix,
          extension: params.extension,
        });
        return {
          data: resp.files ?? [],
          total: resp.totalCount ?? 0,
          success: true,
        };
      }}
      columns={[
        { title: 'ID', dataIndex: 'id', width: 80 },
        { title: '文件名', dataIndex: 'filename' },
        { title: '路径', dataIndex: 'filePath' },
        {
          title: '大小', dataIndex: 'size', search: false,
          render: (_, r) => `${(r.size / 1024).toFixed(1)} KB`,
        },
        { title: '类型', dataIndex: 'contentType', search: false },
        {
          title: '公开', dataIndex: 'isPublic', search: false,
          render: (_, r) => (r.isPublic ? <Tag color="green">公开</Tag> : <Tag>私有</Tag>),
        },
        { title: '创建时间', dataIndex: 'createdAt', search: false },
        {
          title: '操作', search: false, render: (_, r) => (
            <Space>
              <a onClick={() => handleDownload(r.id)}>下载</a>
              <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
                <a style={{ color: 'red' }}>删除</a>
              </Popconfirm>
            </Space>
          ),
        },
      ]}
      search={{ labelWidth: 'auto' }}
      toolBarRender={() => [
        <UploadModal key="upload" onDone={() => actionRef.current?.reload()} />,
      ]}
    />
  );
}
```

> 注：生成的函数名/参数名以 `typings.d.ts` 为准（openapiv2 用 camelCase 参数）。若生成的是 `listMyFilesPagedGET`，按实际调整。

- [ ] **Step 4: 写上传 Modal（STS 凭证 → 客户端直传 OSS → ConfirmUpload）**

`web/src/pages/Files/MyFiles/UploadModal.tsx`——**上传是 STS 凭证模式**：testkit 只发凭证，前端拿凭证直传 OSS（testkit 不经手文件流），上传成功后调 `ConfirmUpload`：

```tsx
import { Modal, Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { getStsCredential, confirmUpload } from '@/services/testkit';

// OSS browser SDK（按 vendor 选）——这里示意阿里云 OSS put 接口。
// 前端依赖 oss-browser-sdk 或 @aws-sdk/client-s3，按 provider 选。
async function putToOSS(opts: {
  endpoint: string; bucket: string; objectKey: string;
  accessKey: string; secretKey: string; securityToken: string;
  file: File; contentType: string;
}) {
  // 实际：new OSS({ endpoint, accessKeyId, accessKeySecret, stsToken, bucket }).put(objectKey, file)
  // 这里只占位表示「直传 OSS、不经 testkit」。
  await new Promise((resolve) => setTimeout(resolve, 50)); // 占位
}

export default function UploadModal({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const customUpload = async (opt: UploadRequestOption) => {
    const file = opt.file as File;
    setUploading(true);
    try {
      // 1) 从 testkit 拿 STS 凭证 + upload_token（testkit 从 ctx 注入 owner）
      const cred = await getStsCredential({
        filename: file.name,
        md5: '', // 实际用 spark-md5 算文件 md5；空串仅占位（生产需算）
        contentType: file.type || 'application/octet-stream',
        maxSize: file.size,
      });

      // 1a) 即时上传（MD5 dedup 命中）：fileId 已有，无需传文件
      if (cred.instant && cred.fileId) {
        message.success('秒传成功（MD5 命中）');
        onDone(); setOpen(false); opt.onSuccess?.(cred); return;
      }

      // 2) 客户端直传 OSS（testkit 不经手文件流）
      await putToOSS({
        endpoint: cred.endpoint!, bucket: cred.bucket!, objectKey: cred.objectKey!,
        accessKey: cred.accessKey!, secretKey: cred.secretKey!, securityToken: cred.securityToken!,
        file, contentType: file.type,
      });

      // 3) 回调 testkit 确认（testkit 校验 HMAC + 通知 storage 落库）
      await confirmUpload({ uploadToken: cred.uploadToken });
      message.success('上传成功');
      onDone();
      setOpen(false);
      opt.onSuccess?.({});
    } catch (e) {
      message.error('上传失败');
      opt.onError?.(e as Error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Button type="primary" icon={<UploadOutlined />} onClick={() => setOpen(true)}>上传</Button>
      <Modal open={open} onCancel={() => setOpen(false)} footer={null} title="上传文件">
        <Upload customRequest={customUpload} showUploadList={false} multiple={false}>
          <Button icon={<UploadOutlined />} loading={uploading}>选择文件</Button>
        </Upload>
      </Modal>
    </>
  );
}
```

> **关键说明**（spec §5 上传流）：上传分三步——① testkit `GetSTSCredential`（BFF 注 owner，返回 STS 凭证 + `upload_token`）；② 前端用凭证**直传 OSS**（不经 testkit，文件流不归 BFF）；③ 前端调 `ConfirmUpload`（testkit 验签 + 落库）。`md5` 生产需用 `spark-md5` 算文件 MD5（即时上传/去重靠它）。批量上传同理用 `batchGetSTSCredential`（共享一份 STS + per-file `upload_token`）。`GenerateProcessURL` 在图片场景用（行内「处理」动作调它拿带图参的 URL）。

- [ ] **Step 5: 启动栈 + 端到端验证**

```bash
cd /Users/moss/code/servekit/testkit-service
docker compose up --build -d
# 浏览器 http://localhost:8080 → 登录 → /files/my
# 列表加载 → 点上传 → 选文件 → 上传成功 → 列表刷新 → 下载
```

Expected: ProTable 分页正常；上传走 STS→OSS→Confirm 闭环；下载弹新窗。

- [ ] **Step 6: Commit**

```bash
git add web/config/routes.ts web/src/pages/Files/
git commit -m "feat(web): My Files page with STS upload flow + download/delete actions"
```

---

## Task 12 [enumeration frontend]: 我的配额页 + 我的审计页

同 Task 11 模式（生成 service + ProTable/ProCard）。配额是单实体（`GetMyQuota`），审计是列表（`ListMyAuditLogs`）。

**Files:**
- Create: `web/src/pages/Storage/Quota/index.tsx`
- Create: `web/src/pages/Storage/Audit/index.tsx`
- Modify: `web/config/routes.ts`

- [ ] **Step 1: `npm run openapi`（Task 11 已跑；新加 RPC 自动覆盖）**

- [ ] **Step 2: 配额页（ProCard 四指标）**

`web/src/pages/Storage/Quota/index.tsx`：

```tsx
import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { getMyQuota } from '@/services/testkit';

export default function MyQuota() {
  const { data, loading } = useRequest(getMyQuota, { formatResult: (r) => r });
  return (
    <ProCard ghost gutter={16} wrap>
      <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
        <StatisticCard statistic={{ title: '总配额', value: data?.totalBytes ?? 0, suffix: 'B' }} />
      </ProCard>
      <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
        <StatisticCard statistic={{ title: '已用', value: data?.usedBytes ?? 0, suffix: 'B' }} />
      </ProCard>
      <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
        <StatisticCard statistic={{ title: '可用', value: data?.availableBytes ?? 0, suffix: 'B' }} />
      </ProCard>
      <ProCard colSpan={{ xs: 24, sm: 12, md: 6 }}>
        <StatisticCard statistic={{ title: '文件数', value: data?.fileCount ?? 0 }} />
      </ProCard>
    </ProCard>
  );
}
```

- [ ] **Step 3: 审计页（ProTable 列表，带 action/status 过滤）**

`web/src/pages/Storage/Audit/index.tsx`：

```tsx
import { ProTable } from '@ant-design/pro-components';
import { listMyAuditLogs } from '@/services/testkit';

export default function MyAudit() {
  return (
    <ProTable
      rowKey="id"
      request={async (params) => {
        const resp = await listMyAuditLogs({
          action: params.action,
          pageSize: params.pageSize ?? 10,
          pageToken: params.pageToken,
          startTime: params.start_time,
          endTime: params.end_time,
        });
        return {
          data: resp.logs ?? [],
          total: resp.totalCount ?? 0,
          success: true,
        };
      }}
      columns={[
        { title: 'ID', dataIndex: 'id', width: 80 },
        { title: '操作', dataIndex: 'action' },
        { title: '目标类型', dataIndex: 'targetType', search: false },
        { title: '目标ID', dataIndex: 'targetId', search: false },
        { title: '状态', dataIndex: 'status', search: false },
        { title: '时间', dataIndex: 'createdAt', search: false },
        { title: 'request_id', dataIndex: 'requestId', search: false },
      ]}
      search={{ labelWidth: 'auto' }}
    />
  );
}
```

- [ ] **Step 4: 加路由**（`/storage/quota`、`/storage/audit`，挂在「存储」菜单下，`access: 'canUser'`）

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/Storage/ web/config/routes.ts
git commit -m "feat(web): my-quota + my-audit pages"
```

---

## Task 13 [enumeration frontend]: 管理后台页（files / quota / stats / providers / buckets / audit）

admin 模式：路由 `access: 'canInternal'`（**仅内部账号 `user_type=INTERNAL` 可见**，前端按 UserType 分流，见 P1 Task 17；**后端不做鉴权**，见 v2 §3.5）；请求带 `ownerType`/`ownerId`（目标）；其余同 Task 11/12。一个代表性（Admin 文件列表）展开，其余枚举。

**Files:**
- Create: `web/src/pages/Admin/Storage/Files/index.tsx`
- Create: `web/src/pages/Admin/Storage/Quota/index.tsx`
- Create: `web/src/pages/Admin/Storage/Stats/index.tsx`
- Create: `web/src/pages/Admin/Storage/Providers/index.tsx`
- Create: `web/src/pages/Admin/Storage/Buckets/index.tsx`
- Create: `web/src/pages/Admin/Audit/index.tsx`
- Modify: `web/config/routes.ts`

- [ ] **Step 1: Admin 文件列表（ProTable + owner 过滤 + AdminFileInfo 字段）**

`web/src/pages/Admin/Storage/Files/index.tsx`：

```tsx
import { ProTable } from '@ant-design/pro-components';
import { Popconfirm, message } from 'antd';
import { adminListFiles, adminDeleteFile } from '@/services/testkit';

export default function AdminFiles() {
  return (
    <ProTable
      rowKey="id"
      request={async (params) => {
        const resp = await adminListFiles({
          ownerType: params.owner_type,
          ownerId: params.owner_id,
          provider: params.provider,
          bucket: params.bucket,
          pathPrefix: params.path_prefix,
          pageSize: params.pageSize ?? 10,
          pageToken: params.pageToken,
        });
        return { data: resp.files ?? [], total: resp.totalCount ?? 0, success: true };
      }}
      columns={[
        { title: 'ID', dataIndex: 'id', width: 80 },
        { title: 'owner', dataIndex: 'ownerId', render: (_, r) => `${r.ownerType}/${r.ownerId}` },
        { title: '文件名', dataIndex: 'filename' },
        { title: 'provider', dataIndex: 'provider', search: false },
        { title: 'bucket', dataIndex: 'bucket', search: false },
        { title: 'object_key', dataIndex: 'objectKey', search: false },
        { title: '大小', dataIndex: 'size', search: false },
        { title: '时间', dataIndex: 'createdAt', search: false },
        {
          title: '操作', search: false, render: (_, r) => (
            <Popconfirm title="硬删除？" onConfirm={async () => {
              await adminDeleteFile({ fileId: r.id });
              message.success('已删除');
            }}>
              <a style={{ color: 'red' }}>删除</a>
            </Popconfirm>
          ),
        },
      ]}
      search={{ labelWidth: 'auto' }}
    />
  );
}
```

- [ ] **Step 2: 其余 admin 页（枚举——同模式，调生成 service）**

| 页面 | service | 说明 |
|---|---|---|
| Admin/Quota | `adminGetQuota({ownerType, ownerId})` 读；`adminSetQuota({ownerType, ownerId, totalBytes})` 写 | ProCard 读 + ProForm 写 |
| Admin/Stats | `adminGetStats({})` | 三个 StatisticCard 行（owner/provider/bucket），指标用 totalObjects/totalFiles/physicalBytes/logicalBytes |
| Admin/Providers | `adminListProviders({})` | ProTable，列 name/vendor/endpoint/region |
| Admin/Buckets | `adminListBuckets({})` | ProTable，列 name/provider/keyPrefix/acl/vendor |
| Admin/Audit | `adminListAuditLogs({action, status, requestId, ownerType, ownerId, targetId, startTime, endTime})` | ProTable（比 my-audit 多 status/requestId/owner 过滤） |

每页 `access: 'canInternal'`（仅内部账号；后端不做鉴权，见 v2 §3.5）。owner-quota（`setOwnerQuota`/`addOwnerQuota`）不暴露普通 admin UI（BFF 内部编排用），如需调试可加隐藏页。

- [ ] **Step 3: 加路由**（`/admin/storage/files`、`/admin/storage/quota`、`/admin/storage/stats`、`/admin/storage/providers`、`/admin/storage/buckets`、`/admin/audit-logs`，统一 `access: 'canInternal'`——仅内部账号；后端不做鉴权，见 v2 §3.5）

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Admin/ web/config/routes.ts
git commit -m "feat(web): admin storage pages (files/quota/stats/providers/buckets/audit)"
```

---

## 验收检查（P3 完成时跑）

- [ ] `make proto && git diff --exit-code`（gen/ + swagger 一致）
- [ ] `testkit.proto` **不 import 任何下游 proto**（`grep -n '^import' api/proto/testkit/v1/testkit.proto` 仅命中 google/buf 标准件 + struct/duration/empty）
- [ ] `go build ./...`、`golangci-lint run ./...`、`go test -race -coverprofile=coverage.out ./...` 全绿
- [ ] `internal/service/storage/storage.go` 是**唯一同时 import `testkitv1` 与 `storagev1`** 的文件：`grep -rln "storage-service/gen/storage/v1" --include="*.go" .` 仅命中 `internal/service/storage/*.go`（+ `internal/thirdcall/storage/*.go`，P1 client 接线）
- [ ] 「我的」类 RPC 的 testkit request message **无 owner 字段**：`grep -n "owner" api/proto/testkit/v1/testkit.proto` 在 `ListMy*`/`*MyFile*`/`Generate*URL`/`*STSCredential`/`ConfirmUpload`/`CancelUpload` 等消息里**无命中**（admin 类 `owner_type`/`owner_id` 是合法目标）
- [ ] 前端 `npm run openapi` 重生；`grep -rn "fetch(" web/src/pages` **无命中**（请求层 100% 生成，spec §5.3）
- [ ] 端到端：登录 → /files/my 列表 + STS 上传闭环 + 下载/删除；/storage/quota；/storage/audit；admin 各页
- [ ] xerr 透传：模拟下游配额超限 → testkit 原样回 storage 的 httpCode（不吞错）

---

## Self-Review

**1. 覆盖度 vs spec §7（storage 30 → ~28 testkit RPC）**
实际覆盖 **29 个 testkit RPC**（spec §7 P3 行写 ~28，差异为本计划把 `AdminListAuditLogs` 单独列——下游 30 个 RPC 去掉 Ping = 29，全量覆盖：Upload 5 + Download/Process 3 + My Files 6 + My Quota/Audit 2 + Owner-quota 2 + Admin 11）。无遗漏。REST 前缀按 spec 分在 `/api/v1/files/*`（用户态文件）、`/api/v1/storage/*`（用户态配额/审计 + owner-quota）、`/api/v1/admin/files/*` + `/api/v1/admin/storage/*` + `/api/v1/admin/audit-logs`（admin）。

**2. Placeholder 扫描**
- `UploadModal.putToOSS` 是**故意占位**（OSS/S3 浏览器 SDK 调用按 vendor 选包，非本计划核心；标了注释）。生产需接 `oss-browser-sdk` 或 `@aws-sdk/client-s3`，并补 `spark-md5` 算文件 MD5（即时上传去重靠它）。这是前端集成点、非逻辑占位，已明确标注。
- `stubFuncs` 按需扩字段——Task 4/5/6/7/8/9/10 的字段清单完整给出，无遗漏。
- 无 `TODO` / `... implement ...` 残留在 converter / service 方法里（Task 4-10 全部完整代码）。

**3. 一致性**
- 枚举 12 个（11 镜像 + `ImageProcessType`）名称+编号与 `storage.v1` 逐字一致；映射全用整型直转。
- converter 命名统一 `toStorage<Method>Request` / `toTestkit<Entity>`（覆盖 P1 旧的 `reqToX/respFromX`）。
- 「我的」类 converter 带 `ctx`（注入 owner）；admin 类不带（target 透传）——边界清晰。
- owner 注入唯一入口 `ownerFromCtx`；testkit proto 无 `Owner` message。
- 关键决策 4（admin 避 enum-in-path）→ REST 路由用 body/query，`AdminDeleteOwner` 改 POST action（已在 proto 注记）。

**4. 待确认 / 偏差**
- **RBAC 鉴权本期不做（后端）**（已定）：user-service RBAC 现只 CRUD、不做鉴权落地，后续统一用 OPA（v2 spec §3.5/§12）。故 admin RPC **后端**仅登录态 + 身份注入，无 permission 校验。**前端**按 UserType 双轨（P1 Task 17）：storage admin 路由 `canInternal`（仅内部账号）、我的文件/配额/审计 `canUser`（任意登录用户）。OPA 接入是未来独立工作。
- **`storagev1.Empty` vs `emptypb.Empty`**：下游生成器是否产出 `storagev1.Empty` 别名需 `go build` 确认；本计划统一按 `*emptypb.Empty` 写（下游 handler 实际签名）。
- **`optional` 字段传递**：`UpdateMyFile.filename` 等 optional 在 testkit 与 storage 间用 `req.Filename`（指针）透传——若两边生成器对 optional 的 Go 表达不同（`*string` vs wrapper），按编译器提示对齐。
- **嵌套 enum 类型名**：`storagev1.ImageProcessOp_TYPE`（下游嵌套枚举的生成名）大小写以 `go build` 提示为准。
- **即时上传 MD5**：前端 `getStsCredential` 的 `md5` 生产必须算（否则 dedup 失效），占位代码传空串需替换为 `spark-md5`。

---

## 关联

**设计文档：**
- `docs/superpowers/specs/2026-07-29-testkit-service-design.md`（v2 设计，§3 自包含 proto + 映射、§3.2 curation 规则、§7 功能清单 P3 行、§8 分期）
- `docs/superpowers/specs/2026-07-28-testkit-service-design.md`（v1，地基章节仍有效）

**前置 plan（GOLDEN TEMPLATE）：**
- `docs/superpowers/plans/2026-07-28-testkit-service-p1-foundation.md`（P1 地基 + 认证闭环——Task 5 thirdcall、Task 8 service.go、Task 12 proto+镜像 enum、Task 13 域映射+测试、Task 14 handler+facade 是本计划直接对照模板）
- P2 用户与权限（`docs/superpowers/plans/2026-07-29-testkit-service-p2-user-domain.md`）——提供 RBAC **CRUD 管理** UI（角色/权限/组）；**不提供鉴权基础设施**（本期 RBAC 不做鉴权应用，后续 OPA）。P3 admin 路由用登录态 `canUser`，不依赖任何权限基础设施。

**下游 proto（mirror/curate 来源）：**
- `storage-service/api/proto/storage/v1/storage.proto`（30 RPC / 61 message / 10 enum——P3 全量镜像 + curation）

**遵循 skill：**
- `dev-skills:golang-service-development`（架构 / 域包 / api-swagger）
- `dev-skills:proto-development`（proto 写法 / protovalidate / buf）
- `dev-skills:golang-development`（Go 风格 / lint / 测试）

**后续 plan：**
- P4 消息 → `docs/superpowers/plans/2026-07-29-testkit-service-p4-message.md`
- P5 gid + 仪表盘 → `docs/superpowers/plans/2026-07-29-testkit-service-p5-gid-dashboard.md`
