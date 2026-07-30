# testkit-service thirdcall / init 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 testkit 的 thirdcall 严格改造成 user-service 范式（手写 interface + `NewModule(h, owns)` 包络 + 真实 grpc 后端），新建 `internal/service/init.go` 集中实例化资源与依赖注入，删除终端服务用不到的 `pkg/{thirdcall,option,module}` 与 `internal/adapter`。

**Architecture:** 四个下游（gid/message/storage/user）各自在 `internal/thirdcall/<svc>/` 暴露一个手写 interface（server 风格签名 + `Close()`），module 后端包裸 handler、grpc 后端拨号转发。`init.go` 按 user-service 的 resolve 模式从 cfg 实例化 db/redis/裸 handler、沿依赖链共享裸 handler、`mgr.AddStopper(Close)` 注册生命周期，再把 thirdcall 接口注入六个子域。子域删本地接口、直接吃 thirdcall 接口。`internal/adapter` 删除，session→userID 解析改为 `Service.SessionResolver()`（service 根装配，thirdcall/user 保持纯传输边界）。

**Tech Stack:** Go 1.24、go-common（lifecycle/dbx/redisx/grpcx/cronx）、gorm、grpc-gateway、buf。

**关键参考（只读）：** `../user-service/internal/service/helper.go`（resolveGID/resolveMessage 金标准）、`../user-service/internal/thirdcall/{gid_service,message_service}/*`（thirdcall 范式）。

**重要说明（编译时机）：** Task 1 是一个原子的结构性置换——它的中间步骤彼此依赖，**只有 1.12 步会通过编译**。按顺序做完所有步骤后再编译。每个 domain 步骤会同步改该 domain 的测试，保证 1.12 测试也过。

---

## 文件结构（File Map）

**新增**
- `internal/service/init.go` — `New` + `resolve{Redis,DB,GID,Message,Storage,User}` + `buildDomains` + `setupJobs` + `rollback`
- `internal/thirdcall/gid/gid.go` — `GIDService` interface
- `internal/thirdcall/message/message.go` — `MessageService` interface
- `internal/thirdcall/storage/storage.go` — `StorageService` interface
- `internal/thirdcall/user/user.go` — `UserService` interface

**重写（整体替换）**
- `internal/thirdcall/{gid,message,storage,user}/module.go` — 改为 `NewModule(h, owns) <Svc>Service` 包络
- `internal/thirdcall/{gid,message,storage,user}/grpc.go` — 改为真实拨号后端（逐方法转发）
- `internal/service/service.go` — 仅留 `Service` 结构体 + `Start/Stop/Ping` + facade 访问器 + `SessionResolver()`
- `pkg/server.go` — 去 `ServerOption`；`NewServer(cfg)`；resolver 走 `svc.SessionResolver()`
- 各子域 `internal/service/{auth,gid,dashboard,user,storage,message}/*.go` — 字段/入参类型改 thirdcall 接口，删本地接口

**删除**
- `internal/adapter/`（整包）、`pkg/thirdcall/`（整包）、`pkg/option/`（整包）、`pkg/module.go`

**不动**
- `internal/thirdcall/user/config.go`、`pkg/config/`、`pkg/handler/`、`pkg/auth/`、`pkg/client.go`、`pkg/xcodes/`、`internal/jwt/`、`internal/jobs/`、`cmd/`

**命名约定**
- thirdcall 接口：`gid.GIDService`、`message.MessageService`、`storage.StorageService`、`user.UserService`
- import 别名（避开子域包名 `user/storage/message/gid`）：`thirdcallgid`/`thirdcallmessage`/`thirdcallstorage`/`thirdcalluser`
- 裸 handler 类型：`*gidservice.Handler`、`*messageservice.Handler`、`*storagehandler.Handler`、`*userhandler.Handler`
- 下游 client：`*gidservice.Client`、`*messageservice.Client`、`*storageservice.Client`、`*userservice.Client`

**接口方法集（权威，排除 Ping——testkit 不透传下游 Ping）**
- gid：`NextID`、`BatchNextID`、`Decompose`（+Close）
- message（13）：`SendEmail`、`SendSMS`、`GetEmail`、`ListEmails`、`ListEmailsByCursor`、`GetEmailStats`、`GetSMS`、`ListSMS`、`ListSMSByCursor`、`GetSMSStats`、`ListSMSRegions`、`ListSMSSenders`、`ListEmailSenders`（+Close）
- storage（30）：见 Step 1.3 全列（+Close）
- user（59）：见 Step 1.4 全列（+Close）

---

## Task 1: 结构性置换（thirdcall + init.go + service.go + 子域 + 删除 + server）

### Step 1.1: 重写 `internal/thirdcall/gid/`（金标准模板，完整照此风格做其余三个）

**Files:**
- Create: `internal/thirdcall/gid/gid.go`
- Rewrite: `internal/thirdcall/gid/module.go`（整体替换）
- Rewrite: `internal/thirdcall/gid/grpc.go`（整体替换）

- [ ] **写 `internal/thirdcall/gid/gid.go`**（完整）：

```go
// Package gid adapts gid-service to testkit's internal needs.
//
// GIDService is testkit's seam over gid-service: the gid RPCs testkit forwards
// (the gid debug domain) plus Close for lifecycle. The in-process Handler
// (module) and the gRPC client (grpc) both satisfy it. Mirrors user-service's
// internal/thirdcall/gid_service.
package gid

import (
	"context"

	gidv1 "github.com/servekit/gid-service/gen/gid/v1"
)

// GIDService is the subset of gid-service testkit uses. Methods take/return
// gid-service proto verbatim; Close releases the backend (module Handler Stop
// or gRPC conn Close), wired to a lifecycle Stopper by resolveGID.
type GIDService interface {
	NextID(context.Context, *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error)
	BatchNextID(context.Context, *gidv1.BatchNextIDRequest) (*gidv1.BatchNextIDResponse, error)
	Decompose(context.Context, *gidv1.DecomposeRequest) (*gidv1.DecomposeResponse, error)
	Close() error
}

// Compile-time assertions: both backends satisfy GIDService.
var (
	_ GIDService = (*moduleGID)(nil)
	_ GIDService = (*grpcGID)(nil)
)
```

- [ ] **写 `internal/thirdcall/gid/module.go`**（整体替换原文件）：

```go
package gid

import (
	gidservice "github.com/servekit/gid-service/pkg"
)

// moduleGID wraps an in-process gid-service Handler. owns reports whether this
// wrapper owns the Handler's lifecycle: true when the caller built it (Close
// Stops it), false when borrowed from an owner (Close is a no-op).
type moduleGID struct {
	*gidservice.Handler
	owns bool
}

// NewModule wraps a gid-service Handler as a GIDService. owns=true when the
// caller built the Handler (Close Stops it); false when injected by an owner.
// Resources (none for gid) are instantiated by the service root, not here.
func NewModule(h *gidservice.Handler, owns bool) GIDService {
	return &moduleGID{Handler: h, owns: owns}
}

// Close stops the Handler only if this wrapper owns it.
func (m *moduleGID) Close() error {
	if !m.owns {
		return nil
	}
	return m.Handler.Stop()
}
```

- [ ] **写 `internal/thirdcall/gid/grpc.go`**（整体替换原文件）：

```go
package gid

import (
	"context"
	"fmt"

	gidv1 "github.com/servekit/gid-service/gen/gid/v1"
	gidservice "github.com/servekit/gid-service/pkg"
)

type grpcGID struct {
	client *gidservice.Client
}

// NewGRPC dials gid-service at target and returns a GIDService over gRPC.
func NewGRPC(target string) (GIDService, error) {
	c, err := gidservice.NewClient(target)
	if err != nil {
		return nil, fmt.Errorf("dial gid-service %q: %w", target, err)
	}
	return &grpcGID{client: c}, nil
}

func (g *grpcGID) NextID(ctx context.Context, r *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error) {
	return g.client.NextID(ctx, r)
}

func (g *grpcGID) BatchNextID(ctx context.Context, r *gidv1.BatchNextIDRequest) (*gidv1.BatchNextIDResponse, error) {
	return g.client.BatchNextID(ctx, r)
}

func (g *grpcGID) Decompose(ctx context.Context, r *gidv1.DecomposeRequest) (*gidv1.DecomposeResponse, error) {
	return g.client.Decompose(ctx, r)
}

// Close closes the underlying gRPC connection.
func (g *grpcGID) Close() error { return g.client.Close() }
```

> gid 包内现在已无 `Handler` 别名、无旧 `NewModule(cfg)`、无 `Client` 别名。下一步同理处理其余三包。

### Step 1.2: 重写 `internal/thirdcall/message/`

**Files:** Create `message.go`；Rewrite `module.go`、`grpc.go`

- [ ] **写 `internal/thirdcall/message/message.go`**：

```go
// Package message adapts message-service to testkit's internal needs. Mirrors
// user-service's internal/thirdcall/message_service.
package message

import (
	"context"

	messagev1 "github.com/servekit/message-service/gen/message/v1"
)

// MessageService is the subset of message-service testkit forwards (message
// domain + dashboard stats). Methods take/return message-service proto verbatim.
type MessageService interface {
	SendEmail(context.Context, *messagev1.SendEmailRequest) (*messagev1.SendResponse, error)
	SendSMS(context.Context, *messagev1.SendSMSRequest) (*messagev1.SendResponse, error)
	GetEmail(context.Context, *messagev1.GetEmailRequest) (*messagev1.EmailRecord, error)
	ListEmails(context.Context, *messagev1.ListEmailsRequest) (*messagev1.ListEmailsResponse, error)
	ListEmailsByCursor(context.Context, *messagev1.ListEmailsByCursorRequest) (*messagev1.ListEmailsByCursorResponse, error)
	GetEmailStats(context.Context, *messagev1.GetEmailStatsRequest) (*messagev1.EmailStatsResponse, error)
	GetSMS(context.Context, *messagev1.GetSMSRequest) (*messagev1.SMSRecord, error)
	ListSMS(context.Context, *messagev1.ListSMSRequest) (*messagev1.ListSMSResponse, error)
	ListSMSByCursor(context.Context, *messagev1.ListSMSByCursorRequest) (*messagev1.ListSMSByCursorResponse, error)
	GetSMSStats(context.Context, *messagev1.GetSMSStatsRequest) (*messagev1.SMSStatsResponse, error)
	ListSMSRegions(context.Context, *messagev1.ListSMSRegionsRequest) (*messagev1.ListSMSRegionsResponse, error)
	ListSMSSenders(context.Context, *messagev1.ListSMSSendersRequest) (*messagev1.ListSMSSendersResponse, error)
	ListEmailSenders(context.Context, *messagev1.ListEmailSendersRequest) (*messagev1.ListEmailSendersResponse, error)
	Close() error
}

var (
	_ MessageService = (*moduleMessage)(nil)
	_ MessageService = (*grpcMessage)(nil)
)
```

- [ ] **写 `internal/thirdcall/message/module.go`**（整体替换）：

```go
package message

import (
	messageservice "github.com/servekit/message-service/pkg"
)

type moduleMessage struct {
	*messageservice.Handler
	owns bool
}

// NewModule wraps a message-service Handler as a MessageService. owns=true when
// the caller built the Handler; false when borrowed. Resources (db/redis/gid)
// are instantiated by the service root and injected into the downstream module
// there — this wrapper only wraps.
func NewModule(h *messageservice.Handler, owns bool) MessageService {
	return &moduleMessage{Handler: h, owns: owns}
}

func (m *moduleMessage) Close() error {
	if !m.owns {
		return nil
	}
	return m.Handler.Stop()
}
```

- [ ] **写 `internal/thirdcall/message/grpc.go`**（整体替换）。**规则**：对 interface 里每个方法 M，写一个一行转发 `func (g *grpcMessage) M(ctx, r *messagev1.<Req>) (*messagev1.<Resp>, error) { return g.client.M(ctx, r) }`。完整如下：

```go
package message

import (
	"context"
	"fmt"

	messagev1 "github.com/servekit/message-service/gen/message/v1"
	messageservice "github.com/servekit/message-service/pkg"
)

type grpcMessage struct {
	client *messageservice.Client
}

func NewGRPC(target string) (MessageService, error) {
	c, err := messageservice.NewClient(target)
	if err != nil {
		return nil, fmt.Errorf("dial message-service %q: %w", target, err)
	}
	return &grpcMessage{client: c}, nil
}

func (g *grpcMessage) SendEmail(ctx context.Context, r *messagev1.SendEmailRequest) (*messagev1.SendResponse, error) {
	return g.client.SendEmail(ctx, r)
}
func (g *grpcMessage) SendSMS(ctx context.Context, r *messagev1.SendSMSRequest) (*messagev1.SendResponse, error) {
	return g.client.SendSMS(ctx, r)
}
func (g *grpcMessage) GetEmail(ctx context.Context, r *messagev1.GetEmailRequest) (*messagev1.EmailRecord, error) {
	return g.client.GetEmail(ctx, r)
}
func (g *grpcMessage) ListEmails(ctx context.Context, r *messagev1.ListEmailsRequest) (*messagev1.ListEmailsResponse, error) {
	return g.client.ListEmails(ctx, r)
}
func (g *grpcMessage) ListEmailsByCursor(ctx context.Context, r *messagev1.ListEmailsByCursorRequest) (*messagev1.ListEmailsByCursorResponse, error) {
	return g.client.ListEmailsByCursor(ctx, r)
}
func (g *grpcMessage) GetEmailStats(ctx context.Context, r *messagev1.GetEmailStatsRequest) (*messagev1.EmailStatsResponse, error) {
	return g.client.GetEmailStats(ctx, r)
}
func (g *grpcMessage) GetSMS(ctx context.Context, r *messagev1.GetSMSRequest) (*messagev1.SMSRecord, error) {
	return g.client.GetSMS(ctx, r)
}
func (g *grpcMessage) ListSMS(ctx context.Context, r *messagev1.ListSMSRequest) (*messagev1.ListSMSResponse, error) {
	return g.client.ListSMS(ctx, r)
}
func (g *grpcMessage) ListSMSByCursor(ctx context.Context, r *messagev1.ListSMSByCursorRequest) (*messagev1.ListSMSByCursorResponse, error) {
	return g.client.ListSMSByCursor(ctx, r)
}
func (g *grpcMessage) GetSMSStats(ctx context.Context, r *messagev1.GetSMSStatsRequest) (*messagev1.SMSStatsResponse, error) {
	return g.client.GetSMSStats(ctx, r)
}
func (g *grpcMessage) ListSMSRegions(ctx context.Context, r *messagev1.ListSMSRegionsRequest) (*messagev1.ListSMSRegionsResponse, error) {
	return g.client.ListSMSRegions(ctx, r)
}
func (g *grpcMessage) ListSMSSenders(ctx context.Context, r *messagev1.ListSMSSendersRequest) (*messagev1.ListSMSSendersResponse, error) {
	return g.client.ListSMSSenders(ctx, r)
}
func (g *grpcMessage) ListEmailSenders(ctx context.Context, r *messagev1.ListEmailSendersRequest) (*messagev1.ListEmailSendersResponse, error) {
	return g.client.ListEmailSenders(ctx, r)
}

func (g *grpcMessage) Close() error { return g.client.Close() }
```

### Step 1.3: 重写 `internal/thirdcall/storage/`

**Files:** Create `storage.go`；Rewrite `module.go`、`grpc.go`

- [ ] **写 `internal/thirdcall/storage/storage.go`**（30 方法，签名取自 `storage-service/gen/storage/v1/storage_grpc.pb.go` 的 `StorageServiceServer`，去掉 `mustEmbedUnimplemented*` 与 `Ping`，加 `Close()`）：

```go
// Package storage adapts storage-service to testkit's internal needs. Mirrors
// user-service's thirdcall pattern.
package storage

import (
	"context"

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
```

> 注意 `storage.go` 需 import `"google.golang.org/protobuf/types/known/emptypb"`（多个方法入参/返回 `*emptypb.Empty`）。

- [ ] **写 `internal/thirdcall/storage/module.go`**（整体替换）：

```go
package storage

import (
	storagehandler "github.com/servekit/storage-service/pkg/handler"
)

type moduleStorage struct {
	*storagehandler.Handler
	owns bool
}

// NewModule wraps a storage-service Handler as a StorageService. owns=true when
// the caller built it; false when borrowed. Resources injected by service root.
func NewModule(h *storagehandler.Handler, owns bool) StorageService {
	return &moduleStorage{Handler: h, owns: owns}
}

func (m *moduleStorage) Close() error {
	if !m.owns {
		return nil
	}
	return m.Handler.Stop()
}
```

- [ ] **写 `internal/thirdcall/storage/grpc.go`**（整体替换）。**规则同 Step 1.2**：interface 每个 方法 一行 `func (g *grpcStorage) M(ctx, r *storagev1.<Req>) (*storagev1.<Resp>, error) { return g.client.M(ctx, r) }`（入参/返回为 `*emptypb.Empty` 的也照原签名转，例：`AdminListProviders(ctx, r *emptypb.Empty)`）。模板 + 头尾：

```go
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

// 对 storage.go 里 interface 的每个方法 M 各写一个一行转发，例如：
func (g *grpcStorage) GenerateUploadURL(ctx context.Context, r *storagev1.GenerateUploadURLRequest) (*storagev1.GenerateUploadURLResponse, error) {
	return g.client.GenerateUploadURL(ctx, r)
}
func (g *grpcStorage) AdminListProviders(ctx context.Context, r *emptypb.Empty) (*storagev1.AdminListProvidersResponse, error) {
	return g.client.AdminListProviders(ctx, r)
}
// …对其余 28 个方法各写一行同形转发（签名严格照 storage.go interface）…

func (g *grpcStorage) Close() error { return g.client.Close() }
```

> 实现时打开 `storage.go` 的 interface，对每个声明的方法逐个产出转发函数（机械、确定性）。务必 30 个方法全覆盖，漏一个会编译失败（grpcStorage 不满足 StorageService 的 `var _` 断言）。

### Step 1.4: 重写 `internal/thirdcall/user/`

**Files:** Create `user.go`；Rewrite `module.go`、`grpc.go`；保留 `config.go`

- [ ] **写 `internal/thirdcall/user/user.go`**（59 方法，签名取自 `user-service/gen/user/v1/user_grpc.pb.go` 的 `UserServiceServer`，去掉 `mustEmbedUnimplemented*` 与 `Ping`，加 `Close()`）。方法清单（顺序按 gen）：

`Register, Login, Logout, RefreshSession, GetOAuthURL, SocialLogin, MiniProgramLogin, MiniProgramPhoneLogin, GetProfile, UpdateProfile, ChangePassword, ResetPassword, ListIdentities, BindIdentity, BindOAuthIdentity, UnbindIdentity, SendVerificationCode, ListSessions, RevokeSession, RevokeAllSessions, GetSession, IssueSessionCode, ExchangeSessionCode, CreateUser, GetUser, ListUsers, ListUsersPaged, DisableUser, GetLoginLogs, CreateGroup, GetGroup, UpdateGroup, ListGroups, DeleteGroup, AddGroupMember, RemoveGroupMember, ListGroupMembers, CreateRole, UpdateRole, DeleteRole, ListRoles, GetRole, ListPermissions, CreatePermission, GetPermission, UpdatePermission, DeletePermission, CreatePermissionGroup, GetPermissionGroup, UpdatePermissionGroup, DeletePermissionGroup, ListPermissionGroups, AddGroupRole, RemoveGroupRole, ListGroupRoles, AssignRole, RevokeRole, ListUserRoles`（+Close）。

```go
// Package user adapts user-service to testkit's internal needs. The UserService
// interface is testkit's seam over user-service: the user/auth/dashboard domains
// reach the downstream exclusively through it. Mirrors user-service's thirdcall
// pattern.
package user

import (
	"context"

	"google.golang.org/protobuf/types/known/emptypb"

	userv1 "github.com/servekit/user-service/gen/user/v1"
)

// UserService is the subset of user-service testkit forwards (auth + user +
// dashboard domains, and the session resolver). Methods take/return
// user-service proto verbatim; Close releases the backend.
type UserService interface {
	Register(context.Context, *userv1.RegisterRequest) (*userv1.RegisterResponse, error)
	Login(context.Context, *userv1.LoginRequest) (*userv1.LoginResponse, error)
	Logout(context.Context, *userv1.LogoutRequest) (*emptypb.Empty, error)
	RefreshSession(context.Context, *userv1.RefreshSessionRequest) (*emptypb.Empty, error)
	GetOAuthURL(context.Context, *userv1.GetOAuthURLRequest) (*userv1.GetOAuthURLResponse, error)
	SocialLogin(context.Context, *userv1.SocialLoginRequest) (*userv1.LoginResponse, error)
	MiniProgramLogin(context.Context, *userv1.MiniProgramLoginRequest) (*userv1.LoginResponse, error)
	MiniProgramPhoneLogin(context.Context, *userv1.MiniProgramPhoneLoginRequest) (*userv1.LoginResponse, error)
	GetProfile(context.Context, *userv1.GetProfileRequest) (*userv1.User, error)
	UpdateProfile(context.Context, *userv1.UpdateProfileRequest) (*userv1.User, error)
	ChangePassword(context.Context, *userv1.ChangePasswordRequest) (*emptypb.Empty, error)
	ResetPassword(context.Context, *userv1.ResetPasswordRequest) (*emptypb.Empty, error)
	ListIdentities(context.Context, *userv1.ListIdentitiesRequest) (*userv1.ListIdentitiesResponse, error)
	BindIdentity(context.Context, *userv1.BindIdentityRequest) (*userv1.Identity, error)
	BindOAuthIdentity(context.Context, *userv1.BindOAuthIdentityRequest) (*userv1.BindOAuthIdentityResponse, error)
	UnbindIdentity(context.Context, *userv1.UnbindIdentityRequest) (*emptypb.Empty, error)
	SendVerificationCode(context.Context, *userv1.SendVerificationCodeRequest) (*userv1.SendVerificationCodeResponse, error)
	ListSessions(context.Context, *userv1.ListSessionsRequest) (*userv1.ListSessionsResponse, error)
	RevokeSession(context.Context, *userv1.RevokeSessionRequest) (*emptypb.Empty, error)
	RevokeAllSessions(context.Context, *userv1.RevokeAllSessionsRequest) (*emptypb.Empty, error)
	GetSession(context.Context, *userv1.GetSessionRequest) (*userv1.GetSessionResponse, error)
	IssueSessionCode(context.Context, *userv1.IssueSessionCodeRequest) (*userv1.IssueSessionCodeResponse, error)
	ExchangeSessionCode(context.Context, *userv1.ExchangeSessionCodeRequest) (*userv1.ExchangeSessionCodeResponse, error)
	CreateUser(context.Context, *userv1.CreateUserRequest) (*userv1.CreateUserResponse, error)
	GetUser(context.Context, *userv1.GetUserRequest) (*userv1.User, error)
	ListUsers(context.Context, *userv1.ListUsersRequest) (*userv1.ListUsersResponse, error)
	ListUsersPaged(context.Context, *userv1.ListUsersPagedRequest) (*userv1.ListUsersPagedResponse, error)
	DisableUser(context.Context, *userv1.DisableUserRequest) (*userv1.User, error)
	GetLoginLogs(context.Context, *userv1.GetLoginLogsRequest) (*userv1.GetLoginLogsResponse, error)
	CreateGroup(context.Context, *userv1.CreateGroupRequest) (*userv1.Group, error)
	GetGroup(context.Context, *userv1.GetGroupRequest) (*userv1.Group, error)
	UpdateGroup(context.Context, *userv1.UpdateGroupRequest) (*userv1.Group, error)
	ListGroups(context.Context, *userv1.ListGroupsRequest) (*userv1.ListGroupsResponse, error)
	DeleteGroup(context.Context, *userv1.DeleteGroupRequest) (*emptypb.Empty, error)
	AddGroupMember(context.Context, *userv1.AddGroupMemberRequest) (*emptypb.Empty, error)
	RemoveGroupMember(context.Context, *userv1.RemoveGroupMemberRequest) (*emptypb.Empty, error)
	ListGroupMembers(context.Context, *userv1.ListGroupMembersRequest) (*userv1.ListGroupMembersResponse, error)
	CreateRole(context.Context, *userv1.CreateRoleRequest) (*userv1.Role, error)
	UpdateRole(context.Context, *userv1.UpdateRoleRequest) (*userv1.Role, error)
	DeleteRole(context.Context, *userv1.DeleteRoleRequest) (*emptypb.Empty, error)
	ListRoles(context.Context, *userv1.ListRolesRequest) (*userv1.ListRolesResponse, error)
	GetRole(context.Context, *userv1.GetRoleRequest) (*userv1.Role, error)
	ListPermissions(context.Context, *userv1.ListPermissionsRequest) (*userv1.ListPermissionsResponse, error)
	CreatePermission(context.Context, *userv1.CreatePermissionRequest) (*userv1.Permission, error)
	GetPermission(context.Context, *userv1.GetPermissionRequest) (*userv1.Permission, error)
	UpdatePermission(context.Context, *userv1.UpdatePermissionRequest) (*userv1.Permission, error)
	DeletePermission(context.Context, *userv1.DeletePermissionRequest) (*emptypb.Empty, error)
	CreatePermissionGroup(context.Context, *userv1.CreatePermissionGroupRequest) (*userv1.PermissionGroup, error)
	GetPermissionGroup(context.Context, *userv1.GetPermissionGroupRequest) (*userv1.PermissionGroup, error)
	UpdatePermissionGroup(context.Context, *userv1.UpdatePermissionGroupRequest) (*userv1.PermissionGroup, error)
	DeletePermissionGroup(context.Context, *userv1.DeletePermissionGroupRequest) (*emptypb.Empty, error)
	ListPermissionGroups(context.Context, *userv1.ListPermissionGroupsRequest) (*userv1.ListPermissionGroupsResponse, error)
	AddGroupRole(context.Context, *userv1.AddGroupRoleRequest) (*emptypb.Empty, error)
	RemoveGroupRole(context.Context, *userv1.RemoveGroupRoleRequest) (*emptypb.Empty, error)
	ListGroupRoles(context.Context, *userv1.ListGroupRolesRequest) (*userv1.ListGroupRolesResponse, error)
	AssignRole(context.Context, *userv1.AssignRoleRequest) (*emptypb.Empty, error)
	RevokeRole(context.Context, *userv1.RevokeRoleRequest) (*emptypb.Empty, error)
	ListUserRoles(context.Context, *userv1.ListUserRolesRequest) (*userv1.ListUserRolesResponse, error)
	Close() error
}

var (
	_ UserService = (*moduleUser)(nil)
	_ UserService = (*grpcUser)(nil)
)
```

- [ ] **写 `internal/thirdcall/user/module.go`**（整体替换；保留原 `normalizeConfig` 调用语义——注意 normalize 在 service root 解析时做，见 Step 1.5）：

```go
// Package user is the in-process + gRPC wiring for user-service.
package user

import (
	userhandler "github.com/servekit/user-service/pkg/handler"
)

type moduleUser struct {
	*userhandler.Handler
	owns bool
}

// NewModule wraps a user-service Handler as a UserService. owns=true when the
// caller built it; false when borrowed. Resources (db/redis/gid/message) are
// instantiated + injected by the service root — this wrapper only wraps. The
// caller must have already normalized cfg (normalizeConfig) before building the
// Handler.
func NewModule(h *userhandler.Handler, owns bool) UserService {
	return &moduleUser{Handler: h, owns: owns}
}

func (m *moduleUser) Close() error {
	if !m.owns {
		return nil
	}
	return m.Handler.Stop()
}
```

- [ ] **写 `internal/thirdcall/user/grpc.go`**（整体替换）。**规则同前**：interface 每个方法一行 `func (g *grpcUser) M(ctx, r *userv1.<Req>) (*userv1.<Resp>, error) { return g.client.M(ctx, r) }`（`*emptypb.Empty` 入参/返回照原签名）。59 个方法全覆盖。头尾模板：

```go
package user

import (
	"context"
	"fmt"

	"google.golang.org/protobuf/types/known/emptypb"

	userv1 "github.com/servekit/user-service/gen/user/v1"
	userservice "github.com/servekit/user-service/pkg"
)

type grpcUser struct {
	client *userservice.Client
}

func NewGRPC(target string) (UserService, error) {
	c, err := userservice.NewClient(target)
	if err != nil {
		return nil, fmt.Errorf("dial user-service %q: %w", target, err)
	}
	return &grpcUser{client: c}, nil
}

// 示例（对其余方法各写一行同形转发，签名严格照 user.go interface）：
func (g *grpcUser) Login(ctx context.Context, r *userv1.LoginRequest) (*userv1.LoginResponse, error) {
	return g.client.Login(ctx, r)
}
func (g *grpcUser) Logout(ctx context.Context, r *userv1.LogoutRequest) (*emptypb.Empty, error) {
	return g.client.Logout(ctx, r)
}
func (g *grpcUser) GetSession(ctx context.Context, r *userv1.GetSessionRequest) (*userv1.GetSessionResponse, error) {
	return g.client.GetSession(ctx, r)
}
// …对其余 56 个方法各写一行转发…

func (g *grpcUser) Close() error { return g.client.Close() }
```

> `config.go`（`normalizeConfig` + dev 占位常量）**保持不动**。它将由 Step 1.5 的 `resolveUser` 调用（先 normalize 再 build）。
>
> thirdcall/user 包到此为 4 文件：`user.go`（interface）+ `module.go` + `grpc.go` + `config.go`。**不含 session/resolver**——session→userID 解析是 service 根的装配职责（见 Step 1.6 的 `Service.SessionResolver()`），thirdcall/user 保持纯传输边界、不 import `pkg/auth`。

### Step 1.5: 创建 `internal/service/init.go`（资源实例化 + DI）

**Files:** Create `internal/service/init.go`

- [ ] **写 `internal/service/init.go`**（完整）。这是组合根：实例化 redis/db/四个下游、沿链共享裸 handler、`AddStopper(Close)`、构造 jwt+六子域并注入 thirdcall 接口。

```go
// Package service resource initialization + dependency injection. All resources
// (db, redis, the four embedded downstreams) are instantiated here from cfg and
// wired into the domain subpackages via their constructors. testkit is a terminal
// service, so nothing is injectable — there is no option/owns-from-parent path.
// Lifecycle follows user-service: each downstream is registered as a Stopper
// whose stop calls Close() (Handler.Stop for module, conn.Close for grpc).
//
// Resolve order: shared redis+db → gid → message → storage → user (each
// downstream shares the raw handlers of its upstreams in module mode). On
// partial failure, already-registered components are stopped via mgr.Stop().
package service

import (
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	gidservice "github.com/servekit/gid-service/pkg"
	gidconfig "github.com/servekit/gid-service/pkg/config"
	"github.com/servekit/go-common/dbx"
	"github.com/servekit/go-common/lifecycle"
	"github.com/servekit/go-common/redisx"
	messageservice "github.com/servekit/message-service/pkg"
	messageconfig "github.com/servekit/message-service/pkg/config"
	messageoption "github.com/servekit/message-service/pkg/option"
	storageservice "github.com/servekit/storage-service/pkg"
	storageconfig "github.com/servekit/storage-service/pkg/config"
	stoption "github.com/servekit/storage-service/pkg/option"
	userservice "github.com/servekit/user-service/pkg"
	userconfig "github.com/servekit/user-service/pkg/config"
	usroption "github.com/servekit/user-service/pkg/option"

	"github.com/servekit/testkit-service/internal/jobs"
	"github.com/servekit/testkit-service/internal/jwt"
	"github.com/servekit/testkit-service/internal/service/auth"
	dashboardsvc "github.com/servekit/testkit-service/internal/service/dashboard"
	gidsvc "github.com/servekit/testkit-service/internal/service/gid"
	"github.com/servekit/testkit-service/internal/service/message"
	"github.com/servekit/testkit-service/internal/service/storage"
	"github.com/servekit/testkit-service/internal/service/user"
	thirdcallgid "github.com/servekit/testkit-service/internal/thirdcall/gid"
	thirdcallmessage "github.com/servekit/testkit-service/internal/thirdcall/message"
	thirdcallstorage "github.com/servekit/testkit-service/internal/thirdcall/storage"
	thirdcalluser "github.com/servekit/testkit-service/internal/thirdcall/user"
	"github.com/servekit/testkit-service/pkg/config"
	"github.com/servekit/testkit-service/pkg/xcodes"
)

// New constructs a Service from config. All resources are self-built from cfg
// and registered with the internal Manager; Stop stops them in reverse order.
// Resolve order: shared redis + db → gid → message → storage → user. On partial
// failure, already-registered components are stopped before returning the error.
func New(cfg *config.Config) (*Service, error) {
	mgr := lifecycle.NewManager()

	rdb, err := resolveRedis(cfg, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	db, err := resolveDB(cfg, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}

	svc := &Service{
		cfg:       cfg,
		mgr:       mgr,
		redis:     rdb,
		db:        db,
		startedAt: time.Now().UnixMilli(),
	}

	// Embed the four downstreams in dependency order, wiring shared db/redis and
	// the raw upstream handlers down the chain (module mode only).
	gidSvc, gidRaw, err := resolveGID(cfg.ThirdParty.GID, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.gid = gidSvc

	msgSvc, msgRaw, err := resolveMessage(cfg.ThirdParty.Message, db, rdb, gidRaw, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.message = msgSvc

	stSvc, err := resolveStorage(cfg.ThirdParty.Storage, db, rdb, gidRaw, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.storage = stSvc

	usrSvc, err := resolveUser(cfg.ThirdParty.User, db, rdb, gidRaw, msgRaw, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.user = usrSvc

	// JWT manager (stateless; not registered with mgr).
	jwtMgr, err := jwt.NewManager(cfg.JWT.Secret, cfg.JWT.TTL)
	if err != nil {
		return nil, rollback(mgr, fmt.Errorf("init jwt: %w", err))
	}

	// P1 auth domain: forward to user-service + issue testkit JWT.
	svc.auth = auth.New(jwtMgr, auth.WithUserClient(usrSvc))

	// P2 user domain.
	svc.userSvc = user.New(usrSvc, jwtMgr)

	// P3 storage domain.
	svc.storageSvc = storage.New(stSvc)

	// P4 message domain. sender_id is a service label injected on every Send —
	// fail fast on empty rather than sending with a blank label.
	if cfg.Message.SenderID == "" {
		return nil, rollback(mgr, xcodes.ErrSenderNotConfigured.New())
	}
	svc.messageSvc = message.New(msgSvc, message.WithSenderID(cfg.Message.SenderID))

	// P5 gid + dashboard domains.
	svc.gidSvc = gidsvc.New(gidSvc)
	svc.dashboardSvc = dashboardsvc.New(usrSvc, stSvc, msgSvc)

	if err := svc.setupJobs(); err != nil {
		return nil, rollback(mgr, err)
	}
	return svc, nil
}

// resolveGID returns testkit's GIDService and, in module mode, the raw
// *gidservice.Handler so module-mode downstreams can share it. grpc mode
// returns a nil raw (no in-process Handler to share).
func resolveGID(cfg *config.RemoteServiceConfig[*gidconfig.Config], mgr *lifecycle.Manager) (thirdcallgid.GIDService, *gidservice.Handler, error) {
	if cfg == nil {
		return nil, nil, fmt.Errorf("third_party.gid: not configured")
	}
	switch cfg.Mode {
	case "grpc":
		if cfg.Target == "" {
			return nil, nil, fmt.Errorf("third_party.gid.target required when mode=grpc")
		}
		g, err := thirdcallgid.NewGRPC(cfg.Target)
		if err != nil {
			return nil, nil, fmt.Errorf("init gid-service: %w", err)
		}
		mgr.AddStopper("gid", lifecycle.StopFunc(func() { _ = g.Close() }))
		return g, nil, nil
	case "module", "":
		if cfg.Config == nil {
			return nil, nil, fmt.Errorf("third_party.gid: module config required")
		}
		hdl, err := gidservice.NewModule(cfg.Config)
		if err != nil {
			return nil, nil, fmt.Errorf("init gid-service: %w", err)
		}
		g := thirdcallgid.NewModule(hdl, true)
		mgr.AddStopper("gid", lifecycle.StopFunc(func() { _ = g.Close() }))
		return g, hdl, nil
	default:
		return nil, nil, fmt.Errorf("third_party.gid: unknown mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}

// resolveMessage returns testkit's MessageService and, in module mode, the raw
// *messageservice.Handler so module-mode user can share it. gidRaw (non-nil in
// module mode) is shared into message-service via WithGIDHandler.
func resolveMessage(cfg *config.RemoteServiceConfig[*messageconfig.Config], db *gorm.DB, rdb *redis.Client, gidRaw *gidservice.Handler, mgr *lifecycle.Manager) (thirdcallmessage.MessageService, *messageservice.Handler, error) {
	if cfg == nil {
		return nil, nil, fmt.Errorf("third_party.message: not configured")
	}
	switch cfg.Mode {
	case "grpc":
		if cfg.Target == "" {
			return nil, nil, fmt.Errorf("third_party.message.target required when mode=grpc")
		}
		m, err := thirdcallmessage.NewGRPC(cfg.Target)
		if err != nil {
			return nil, nil, fmt.Errorf("init message-service: %w", err)
		}
		mgr.AddStopper("message", lifecycle.StopFunc(func() { _ = m.Close() }))
		return m, nil, nil
	case "module", "":
		if cfg.Config == nil {
			return nil, nil, fmt.Errorf("third_party.message: module config required")
		}
		opts := []messageoption.Option{
			messageoption.WithDB(db),
			messageoption.WithRedis(rdb),
		}
		if gidRaw != nil {
			opts = append(opts, messageoption.WithGIDHandler(gidRaw))
		}
		hdl, err := messageservice.NewModule(cfg.Config, opts...)
		if err != nil {
			return nil, nil, fmt.Errorf("init message-service: %w", err)
		}
		m := thirdcallmessage.NewModule(hdl, true)
		mgr.AddStopper("message", lifecycle.StopFunc(func() { _ = m.Close() }))
		return m, hdl, nil
	default:
		return nil, nil, fmt.Errorf("third_party.message: unknown mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}

// resolveStorage returns testkit's StorageService. gidRaw shared in module mode.
func resolveStorage(cfg *config.RemoteServiceConfig[*storageconfig.Config], db *gorm.DB, rdb *redis.Client, gidRaw *gidservice.Handler, mgr *lifecycle.Manager) (thirdcallstorage.StorageService, error) {
	if cfg == nil {
		return nil, fmt.Errorf("third_party.storage: not configured")
	}
	switch cfg.Mode {
	case "grpc":
		if cfg.Target == "" {
			return nil, fmt.Errorf("third_party.storage.target required when mode=grpc")
		}
		s, err := thirdcallstorage.NewGRPC(cfg.Target)
		if err != nil {
			return nil, fmt.Errorf("init storage-service: %w", err)
		}
		mgr.AddStopper("storage", lifecycle.StopFunc(func() { _ = s.Close() }))
		return s, nil
	case "module", "":
		if cfg.Config == nil {
			return nil, fmt.Errorf("third_party.storage: module config required")
		}
		opts := []stoption.Option{
			stoption.WithDB(db),
			stoption.WithRedis(rdb),
		}
		if gidRaw != nil {
			opts = append(opts, stoption.WithGIDHandler(gidRaw))
		}
		hdl, err := storageservice.NewModule(cfg.Config, opts...)
		if err != nil {
			return nil, fmt.Errorf("init storage-service: %w", err)
		}
		s := thirdcallstorage.NewModule(hdl, true)
		mgr.AddStopper("storage", lifecycle.StopFunc(func() { _ = s.Close() }))
		return s, nil
	default:
		return nil, fmt.Errorf("third_party.storage: unknown mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}

// resolveUser returns testkit's UserService. gidRaw + msgRaw shared in module
// mode. cfg.Config is normalized first (thirdcall/user.normalizeConfig) because
// user-service dereferences Session/RBAC/OAuth unconditionally at startup.
func resolveUser(cfg *config.RemoteServiceConfig[*userconfig.Config], db *gorm.DB, rdb *redis.Client, gidRaw *gidservice.Handler, msgRaw *messageservice.Handler, mgr *lifecycle.Manager) (thirdcalluser.UserService, error) {
	if cfg == nil {
		return nil, fmt.Errorf("third_party.user: not configured")
	}
	switch cfg.Mode {
	case "grpc":
		if cfg.Target == "" {
			return nil, fmt.Errorf("third_party.user.target required when mode=grpc")
		}
		u, err := thirdcalluser.NewGRPC(cfg.Target)
		if err != nil {
			return nil, fmt.Errorf("init user-service: %w", err)
		}
		mgr.AddStopper("user", lifecycle.StopFunc(func() { _ = u.Close() }))
		return u, nil
	case "module", "":
		opts := []usroption.Option{
			usroption.WithDB(db),
			usroption.WithRedis(rdb),
		}
		if gidRaw != nil {
			opts = append(opts, usroption.WithGIDHandler(gidRaw))
		}
		if msgRaw != nil {
			opts = append(opts, usroption.WithMessageHandler(msgRaw))
		}
		hdl, err := userservice.NewModule(thirdcalluser.NormalizeConfig(cfg.Config), opts...)
		if err != nil {
			return nil, fmt.Errorf("init user-service: %w", err)
		}
		u := thirdcalluser.NewModule(hdl, true)
		mgr.AddStopper("user", lifecycle.StopFunc(func() { _ = u.Close() }))
		return u, nil
	default:
		return nil, fmt.Errorf("third_party.user: unknown mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}

// resolveDB builds the shared PostgreSQL pool from cfg and registers a Stopper.
func resolveDB(cfg *config.Config, mgr *lifecycle.Manager) (*gorm.DB, error) {
	db, err := dbx.New(cfg.Database)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	mgr.AddStopper("db", lifecycle.StopFunc(func() {
		sqlDB, err := db.DB()
		if err != nil {
			slog.Warn("get sql db for close", "error", err)
			return
		}
		if err := sqlDB.Close(); err != nil {
			slog.Warn("close db", "error", err)
		}
	}))
	return db, nil
}

// resolveRedis builds the shared Redis client from cfg and registers a Stopper.
func resolveRedis(cfg *config.Config, mgr *lifecycle.Manager) (*redis.Client, error) {
	rdb, err := redisx.New(cfg.Redis)
	if err != nil {
		return nil, fmt.Errorf("init redis: %w", err)
	}
	mgr.AddStopper("redis", lifecycle.StopFunc(func() {
		if err := rdb.Close(); err != nil {
			slog.Warn("close redis", "error", err)
		}
	}))
	return rdb, nil
}

// setupJobs builds the jobs.Scheduler, registers it on s.mgr, and wires periodic
// jobs (empty by default).
func (s *Service) setupJobs() error {
	scheduler, err := jobs.New(&jobs.Deps{
		Config: &cronx.Config{
			Timezone:      s.cfg.Cron.Timezone,
			OverlapPolicy: "skip",
		},
	})
	if err != nil {
		return fmt.Errorf("init jobs: %w", err)
	}
	s.mgr.Add("jobs", scheduler)
	return nil
}

// rollback stops all components registered so far and joins the stop error with
// the triggering error. Used by New on partial failure.
func rollback(mgr *lifecycle.Manager, err error) error {
	if cerr := mgr.Stop(); cerr != nil {
		return errors.Join(err, fmt.Errorf("rollback: %w", cerr))
	}
	return err
}
```

> **注意**：`init.go` 用到 `cronx.Config`，需补 import `"github.com/servekit/go-common/cronx"`（上面 import 块里加上）。`thirdcalluser.NormalizeConfig` 见 Step 1.4 后的 config.go 调整。
> **`normalizeConfig` 导出**：Step 1.4 后需把 `internal/thirdcall/user/config.go` 里的 `normalizeConfig` 改名为 `NormalizeConfig`（导出），供 `resolveUser` 调用。把函数名与 `resolveUser` 里保持一致即可。

- [ ] **`internal/thirdcall/user/config.go`：把 `normalizeConfig` 重命名为 `NormalizeConfig`**（导出），其余不动。

### Step 1.6: 瘦身 `internal/service/service.go`

**Files:** Rewrite `internal/service/service.go`（整体替换为：package doc + Service 结构体 + Start/Stop/Ping + facade 访问器；删除原 New/resolve*/setupJobs/rollback——已移至 init.go）

- [ ] **写 `internal/service/service.go`**（完整）：

```go
// Package service contains testkit-service business logic.
//
// Layering: this file is the runtime surface — the Service struct, Start/Stop,
// Ping, and one-line facade accessors (one per domain). All construction +
// dependency injection lives in init.go. Business logic lives in SUBPACKAGES
// (internal/service/<domain>/). handler calls service.X; service.X is a one-line
// facade that calls s.<domain>.X in the subpackage.
//
// testkit is a single-process BFF: it embeds gid/message/storage/user-service
// (module mode, in-process) or dials them (grpc mode), decided per downstream by
// cfg.ThirdParty.<svc>.Mode. Each downstream is reached exclusively through the
// thirdcall interface (internal/thirdcall/<svc>).
package service

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/servekit/go-common/lifecycle"
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/internal/service/auth"
	dashboardsvc "github.com/servekit/testkit-service/internal/service/dashboard"
	gidsvc "github.com/servekit/testkit-service/internal/service/gid"
	"github.com/servekit/testkit-service/internal/service/message"
	"github.com/servekit/testkit-service/internal/service/storage"
	"github.com/servekit/testkit-service/internal/service/user"
	"github.com/servekit/testkit-service/internal/version"
	thirdcallgid "github.com/servekit/testkit-service/internal/thirdcall/gid"
	thirdcallmessage "github.com/servekit/testkit-service/internal/thirdcall/message"
	thirdcallstorage "github.com/servekit/testkit-service/internal/thirdcall/storage"
	thirdcalluser "github.com/servekit/testkit-service/internal/thirdcall/user"
	pkauth "github.com/servekit/testkit-service/pkg/auth"
	"github.com/servekit/testkit-service/pkg/config"
	userv1 "github.com/servekit/user-service/gen/user/v1"
)

// Service holds testkit-service runtime state: the four downstream thirdcall
// clients plus the six domain services. Construction + DI is in init.go.
type Service struct {
	cfg   *config.Config
	mgr   *lifecycle.Manager
	redis *redis.Client
	db    *gorm.DB

	// The four embedded downstreams (thirdcall interfaces: full RPC method set
	// + Close). Built + lifecycle-registered in init.go.
	gid     thirdcallgid.GIDService
	message thirdcallmessage.MessageService
	storage thirdcallstorage.StorageService
	user    thirdcalluser.UserService

	auth *auth.Service
	userSvc *user.Service
	storageSvc *storage.Service
	messageSvc *message.Service
	gidSvc *gidsvc.Service
	dashboardSvc *dashboardsvc.Service

	startedAt int64
}

// Start starts all owned components concurrently.
func (s *Service) Start() error { return s.mgr.Start() }

// Stop stops all owned components in reverse registration order.
func (s *Service) Stop() error { return s.mgr.Stop() }

// Ping is a health-check RPC. Returns only public, non-sensitive info.
func (s *Service) Ping(_ context.Context) (*testkitv1.Pong, error) {
	v := version.Get()
	return &testkitv1.Pong{
		Service:   "testkit-service",
		Version:   v.Version,
		GitCommit: v.GitCommit,
		GitBranch: v.GitBranch,
		BuildTime: v.BuildTime,
		GoVersion: v.GoVersion,
		Status:    "SERVING",
		Now:       time.Now().UnixMilli(),
		StartedAt: s.startedAt,
	}, nil
}

// --- accessors ---

// DB returns the shared PostgreSQL pool (used by the unified migrator).
func (s *Service) DB() *gorm.DB { return s.db }

// SessionResolver builds the auth-interceptor seam from the embedded
// user-service: session_id -> user_id via GetSession. This is testkit's wiring
// decision (how it uses user-service), not user-service's transport concern —
// hence it lives on the service root, not in internal/thirdcall/user. pkg/auth
// (aliased pkauth here to avoid clashing with the internal/service/auth domain)
// stays gen-free.
func (s *Service) SessionResolver() pkauth.SessionResolver {
	return func(ctx context.Context, sessionID string) (int64, error) {
		resp, err := s.user.GetSession(ctx, &userv1.GetSessionRequest{SessionId: sessionID})
		if err != nil {
			return 0, fmt.Errorf("user get-session %q: %w", sessionID, err)
		}
		return resp.GetUserId(), nil
	}
}

func (s *Service) Auth() *auth.Service                 { return s.auth }
func (s *Service) User() *user.Service                 { return s.userSvc }
func (s *Service) Storage() *storage.Service           { return s.storageSvc }
func (s *Service) Message() *message.Service           { return s.messageSvc }
func (s *Service) Gid() *gidsvc.Service                 { return s.gidSvc }
func (s *Service) Dashboard() *dashboardsvc.Service    { return s.dashboardSvc }
```

> **import 说明**：上面的 import 块已含 `redis`/`gorm`/`lifecycle`（字段类型）与 `SessionResolver()` 需要的 `fmt`、`userv1`、`pkauth`。
> `pkg/auth` 与子域 `internal/service/auth` 同名（包名都叫 `auth`），故 `pkg/auth` 用别名 **`pkauth`**（子域保持 `auth`，与 init.go 一致）。
> **删除** `GIDHandler/MessageHandler/StorageHandler/UserHandler` 四个访问器——无外部消费者（resolver 现走 `SessionResolver()`，不再依赖 `UserHandler()`）。`thirdcalluser` import 仍保留（结构体字段 `user thirdcalluser.UserService` 用到）。

### Step 1.7: 子域改造——删本地接口（auth / gid / dashboard）

**Files:** Modify `internal/service/auth/auth.go`、`internal/service/gid/gid.go`、`internal/service/dashboard/dashboard.go`

- [ ] **`auth/auth.go`**：
  - 删除本地 `UserClient` interface（第 30–44 行整段）。
  - import 加 `thirdcalluser "github.com/servekit/testkit-service/internal/thirdcall/user"`；删 `userv1` import 中仅为 `UserClient` 用的部分（注意 `Logout`/`RefreshSession` 方法体仍用 `userv1.LogoutRequest`/`userv1.RefreshSessionRequest`，所以 `userv1` import **保留**）。
  - `type Service struct { jwt *jwt.Manager; user UserClient }` → `user thirdcalluser.UserService`。
  - `func WithUserClient(c UserClient) Option` → `func WithUserClient(c thirdcalluser.UserService) Option`。
  - 方法体（`s.user.Login(...)` 等）**不变**——thirdcall 接口有这些方法。

- [ ] **`gid/gid.go`**：
  - 删除本地 `Client` interface（含 `NextID/BatchNextID/Decompose`）。
  - import 加 `thirdcallgid "github.com/servekit/testkit-service/internal/thirdcall/gid"`。
  - `type Service struct { client Client }` → `client thirdcallgid.GIDService`。
  - `func New(client Client) *Service` → `func New(client thirdcallgid.GIDService) *Service`。
  - 方法体不变。

- [ ] **`dashboard/dashboard.go`**：
  - 删除本地 `UserClient`/`StorageClient`/`MessageClient` 三个 interface。
  - import 加三个 thirdcall 包别名：`thirdcalluser`、`thirdcallstorage`、`thirdcallmessage`。`messagev1`/`storagev1`/`userv1` import 保留（converter 用）。
  - `type Service struct { user UserClient; storage StorageClient; message MessageClient }` → `user thirdcalluser.UserService; storage thirdcallstorage.StorageService; message thirdcallmessage.MessageService`。
  - `func New(user UserClient, storage StorageClient, message MessageClient)` → `func New(user thirdcalluser.UserService, storage thirdcallstorage.StorageService, message thirdcallmessage.MessageService)`。
  - 方法体（`GetDashboard` + converters）不变。

### Step 1.8: 子域改造——字段类型改 thirdcall 接口（user / storage / message）

**Files:** Modify `internal/service/user/user.go`、`internal/service/storage/storage.go`、`internal/service/message/message.go`

- [ ] **`user/user.go`**：
  - import 加 `thirdcalluser "github.com/servekit/testkit-service/internal/thirdcall/user"`（`userv1` 保留——converter 用）。
  - `type Service struct { user userv1.UserServiceServer; jwt *jwt.Manager }` → `user thirdcalluser.UserService`。
  - `func WithUserClient(c userv1.UserServiceServer) Option` → `func WithUserClient(c thirdcalluser.UserService) Option`。
  - `func New(userClient userv1.UserServiceServer, jwtMgr *jwt.Manager, opts ...Option)` → `func New(userClient thirdcalluser.UserService, jwtMgr *jwt.Manager, opts ...Option)`。
  - 方法体不变。

- [ ] **`storage/storage.go`**：字段 `storage storagev1.StorageServiceServer` → `storage thirdcallstorage.StorageService`；`New` 入参同步改 `thirdcallstorage.StorageService`。import 加 `thirdcallstorage`，保留 `storagev1`。

- [ ] **`message/message.go`**：字段 `message messagev1.MessageServiceServer` → `message thirdcallmessage.MessageService`；`New` 入参同步改。import 加 `thirdcallmessage`，保留 `messagev1`。

### Step 1.9: 删除 `pkg/thirdcall/`、`pkg/option/`、`pkg/module.go`、`internal/adapter/`

- [ ] **删除目录/文件**：

```bash
cd /Users/moss/code/servekit/testkit-service
rm -rf internal/adapter pkg/thirdcall pkg/option
rm -f pkg/module.go
```

### Step 1.10: 瘦身 `pkg/server.go`

**Files:** Modify `pkg/server.go`

- [ ] **改 `pkg/server.go`**：
  - 删 `ServerOption` / `serverOptions` / `WithServiceOptions` 三段。
  - import：删 `internal/adapter`、`pkg/option`。**不再加** `internal/thirdcall/user`——resolver 现由 service 根提供。
  - `func NewServer(cfg *config.Config, opts ...ServerOption) (*Server, error)` → `func NewServer(cfg *config.Config) (*Server, error)`；函数体开头删 `var so serverOptions; for _, opt := range opts { opt(&so) }`。
  - `svc, err := service.New(cfg, so.serviceOpts...)` → `svc, err := service.New(cfg)`。
  - `resolver := adapter.NewSessionResolver(svc.UserHandler())` → `resolver := svc.SessionResolver()`。
  - 其余（拦截器链、gateway、jwtMgr 构造、Start/Stop）不变。

- [ ] **改 `cmd/server/main.go`**（若有 `pkg.NewServer(cfg)` 之外的 ServerOption 传入——检查；当前只 `pkg.NewServer(cfg)`，**无需改动**）。确认：

```bash
grep -n "NewServer" cmd/server/main.go   # 应为 pkg.NewServer(cfg)，无 opts
```

### Step 1.11: 删除失效测试文件

- [ ] **删测试**：

```bash
rm -f internal/adapter/user_test.go pkg/thirdcall/gid_test.go
```

> 其余 domain 测试在 Task 2 逐个修。先删这两个已无对应包的。

### Step 1.12: 编译 + 跑可编译域的测试 + 提交

- [ ] **编译全仓**（预期此时除 domain 测试桩缺 `Close()` 外，非测试代码应编译通过）：

```bash
cd /Users/moss/code/servekit/testkit-service
go build ./...
```

- [ ] **预期失败点**：domain 测试桩（`*_test.go`）当前 embed `Unimplemented*Server` 但没有 `Close()`，不满足新的 thirdcall 接口；且 `WithUserClient` 等入参类型变了。**先修非测试编译错误**（若有），测试错误留给 Task 2。
  - 若 `go build ./...` 报非测试错误：按报错修（多半是 import 别名/未用 import）。修到 `go build ./...` 通过。

- [ ] **跑非测试包的 vet**（忽略测试编译错误）：

```bash
go vet $(go list ./... | grep -v '/auth$\|/gid$\|/dashboard$\|/user$\|/storage$\|/message$')
```
预期通过。

- [ ] **提交**（结构性置换）：

```bash
git add -A
git commit -m "refactor(thirdcall): rewrite thirdcall to user-service pattern + centralize DI in init.go

- internal/thirdcall/<svc>: hand-written interface + Close + NewModule(h,owns) wrap + real grpc backend
- internal/service/init.go: instantiate db/redis/downstreams from cfg, share raw handlers, AddStopper(Close), inject thirdcall interfaces into domains
- internal/service/service.go: runtime surface only (struct + Start/Stop/Ping + facades + SessionResolver())
- domains: drop local client interfaces, consume thirdcall interfaces
- delete internal/adapter (SessionResolver -> service.Service.SessionResolver()), pkg/thirdcall, pkg/option, pkg/module.go
- pkg/server: drop ServerOption; resolver via svc.SessionResolver()

Lifestyle follows user-service: mgr.AddStopper(Close), owns=true.
Domain test stubs updated in follow-up."
```

---

## Task 2: 修复 domain 测试桩

domain 测试桩需满足新的 thirdcall 接口（含 `Close()`），且 `WithUserClient`/`New` 入参类型变了。

### Step 2.1: 通用规则——给桩加 `Close()`

所有 embed `Unimplemented*Server` 的测试桩需补一个 no-op `Close()`：

- [ ] **每个 domain 测试桩**（`auth_test.go`、`gid/gid_test.go`、`dashboard/dashboard_test.go`、`user/user_test.go`、`user/admin_test.go`、`storage/storage_test.go`、`storage/converters_internal_test.go` 若有桩、`message/message_test.go`）：
  - 桩类型加方法 `func (<s> <StubType>) Close() error { return nil }`。
  - 桩现在满足对应 thirdcall 接口（embed `Unimplemented*Server` 提供 RPC 方法 + 新增 `Close()`）。

### Step 2.2: 逐 domain 验证测试编译 + 通过

- [ ] **auth**：

```bash
go test ./internal/service/auth/...
```
预期 PASS。若 `WithUserClient` 调用处类型不匹配，把传参桩确认实现了 `thirdcalluser.UserService`（embed `userv1.UnimplementedUserServiceServer` + override 用到的方法 + `Close()`）。

- [ ] **gid**：

```bash
go test ./internal/service/gid/...
```
预期 PASS（桩需 embed `gidv1.UnimplementedGidServiceServer` + `Close()`）。

- [ ] **dashboard**：

```bash
go test ./internal/service/dashboard/...
```
预期 PASS（三个桩各 embed 对应 `Unimplemented*Server` + `Close()`）。

- [ ] **user**（含 admin_test.go）：

```bash
go test ./internal/service/user/...
```
预期 PASS。

- [ ] **storage**（含 converters_internal_test.go）：

```bash
go test ./internal/service/storage/...
```
预期 PASS。

- [ ] **message**：

```bash
go test ./internal/service/message/...
```
预期 PASS。

### Step 2.3: 其余测试 + 提交

- [ ] **跑 thirdcall 包测试**（config_test 等）：

```bash
go test ./internal/thirdcall/...
```
预期 PASS（`user/config_test.go` 仍测 `NormalizeConfig`——若它调用旧名 `normalizeConfig`，改为 `NormalizeConfig`）。

- [ ] **跑 pkg 测试**（config/auth/interceptor 等）：

```bash
go test ./pkg/...
```
预期 PASS。

- [ ] **提交**：

```bash
git add -A
git commit -m "test: update domain stubs for thirdcall interfaces (add Close(), fix param types)"
```

---

## Task 3: 全量验证

- [ ] **race + coverage 测试**：

```bash
make test
```
预期全 PASS。

- [ ] **lint**：

```bash
make lint
```
预期无错。若有 unused import / 命名问题，修后重跑。

- [ ] **fmt**：

```bash
make fmt
```

- [ ] **vet + build**：

```bash
go build ./... && go vet ./...
```
预期通过。

- [ ] **确认删除项无残留引用**：

```bash
grep -rn "pkg/thirdcall\|pkg/option\|pkg.NewModule\|internal/adapter\|thirdcall.GIDService\|thirdcall.UserService\|thirdcall.MessageService\|thirdcall.StorageService" --include=*.go . || echo "clean"
```
预期 `clean`（只剩 `internal/thirdcall/<svc>` 的新类型引用）。

- [ ] **若 fmt/lint 改动了文件，提交**：

```bash
git add -A && git commit -m "chore: fmt/lint after thirdcall restructure" || echo "nothing to commit"
```

---

## Self-Review（写计划后自查）

**Spec coverage（对照 spec 各节）：**
- §2 目标结构 → Task 1 全部步骤 + 删除清单。✓
- §3 thirdcall 手写 interface + module + grpc → Step 1.1–1.4。✓
- §4 init.go resolve/DI + 裸 handler 共享 → Step 1.5。✓
- §5 生命周期 AddStopper(Close) owns=true → Step 1.5 各 resolve。✓
- §6 删 adapter → `Service.SessionResolver()`（service 根）→ Step 1.6(SessionResolver 方法) + 1.9(rm adapter) + 1.10(server 走 svc.SessionResolver())。✓
- §7 删除清单 → Step 1.9。✓
- §8 pkg/server 瘦身 → Step 1.10。✓
- §9 子域改造 → Step 1.7–1.8。✓
- §10 config 不动 → 无 task（确认）。✓
- §11 测试影响 → Task 2。✓

**Placeholder scan：** Step 1.3/1.4 的 grpc.go 用「逐方法一行转发 + 全列方法名 + 模板」描述——这是确定性机械生成（方法名全列、签名照 interface、模板给出），非占位。gid/message 给了完整代码作金标准。其余步骤均给完整代码。

**Type consistency：** 接口类型名 `GIDService/MessageService/StorageService/UserService`、包别名 `thirdcallgid/...`、`NewModule(h, owns)`、`NewGRPC(target)`、`NormalizeConfig` 在 service.go/init.go/domains/thirdcall 间一致。`Service.SessionResolver()` 调 `s.user.GetSession`（`user` 字段为 `thirdcalluser.UserService`，含 GetSession），返回 `pkauth.SessionResolver`；`pkg/server` 用 `svc.SessionResolver()` 喂 `auth.NewInterceptor`。`service.New(cfg)` 单参与 `pkg/server` 调用匹配。

**已知风险（实现时留意）：**
1. Step 1.3/1.4 grpc.go 必须覆盖 interface **全部**方法，漏一个 → `var _ StorageService = (*grpcStorage)(nil)` 编译失败（这正是断言的目的，安全网）。
2. `storage.go`/`user.go` interface 里 `*emptypb.Empty` 方法需在 grpc.go 转发时照搬该入参类型（带 `emptypb` import）。
3. `init.go` import 块需含 `cronx`、`lifecycle`、`dbx`、`redisx`、各下游 pkg + config + option、各 thirdcall 包、各 domain 包、`jobs`、`jwt`、`config`、`xcodes`。
4. `service.go` import 需含 `redis`/`gorm`/`lifecycle`（字段类型）+ `fmt`/`userv1`/`pkauth`（SessionResolver 用）。`pkg/auth` 别名 **`pkauth`** 避开与子域 `internal/service/auth`（别名 `auth`）同名冲突。
5. 若 `cmd/server/migrate.go` 或 docker 依赖被删包——`migrate.go` 用 `dbx.New` + 下游 `pkg.Migrate`，不依赖被删包，无需改。
